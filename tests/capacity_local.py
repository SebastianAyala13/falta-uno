"""PostgreSQL LOCAL only, emulated JWT/RLS. Does not measure Supabase or user capacity."""
import concurrent.futures,importlib.util,json,math,os,pathlib,queue,statistics,subprocess,threading,time,uuid
from postgres_fixture import Postgres,ROOT
from libpq_local import Connection,QueryError,endpoint
spec=importlib.util.spec_from_file_location('generator',ROOT/'scripts/db/generate_fixture.py');g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
def percentile(values,p):
    values=sorted(values);return round(values[min(len(values)-1,max(0,math.ceil(p*len(values))-1))],3) if values else None
def role_query(uid,q):
    return f"begin;set local role authenticated;select set_config('request.jwt.claim.sub','{uid}',true);select set_config('request.jwt.claim.role','authenticated',true);{q};commit;"
def summary(records):
    v=[x['ms'] for x in records];bad=[x for x in records if x['outcome']=='unexpected_error']
    return {'requests':len(records),'p50_ms':percentile(v,.50),'p95_ms':percentile(v,.95),'p99_ms':percentile(v,.99),'unexpected_error_rate':len(bad)/len(records) if records else None,'business_rejections':sum(x['outcome']=='business_rejection' for x in records),'errors_by_sqlstate':{key:sum(x.get('sqlstate')==key for x in bad) for key in sorted({x.get('sqlstate') for x in bad})}}
def main():
    with Postgres(capacity=True) as db:
        db.bootstrap();db.migrate();data=g.generate(db)
        host,port=endpoint(db)
        ids=db.sql("select id from public.profiles where not suspendido and roles=array['jugador'] order by id limit 500").splitlines();assert len(ids)==500
        owner=db.sql("select owner_id from public.canchas where nombre='Cancha fixture 1'");court=db.sql("select id from public.canchas where nombre='Cancha fixture 1'")
        admin=db.sql("select id from public.profiles where 'admin'=any(roles)")
        plans={}
        queries={
          'feed_equivalent_rls':(ids[0],"select p.id,p.texto,p.like_count,p.comment_count from public.posts p where not exists(select 1 from public.bloqueos b where b.usuario_id=auth.uid() and b.bloqueado_id=p.autor_id) order by p.created_at desc,p.id desc limit 30"),
          'feed_rpc':(ids[0],"select public.feed_posts(p_limite=>30)"),
          'search_matches':(ids[0],"select * from public.partidos where not oculto and fecha>='2026-10-06' and (cancha ilike '%fixture%' or zona ilike '%fixture%') order by fecha,hora,id limit 30"),
          'search_courts':(ids[0],"select * from public.canchas where estado='activa' and not oculto and '5v5'=any(formatos) order by created_at desc,id desc limit 31"),
          'private_history':(db.sql("select id from public.profiles where nombre='Jugador fixture 41'"),"select * from public.pagos where jugador_id=auth.uid() order by created_at desc,id desc limit 51"),
          'owner_agenda':(owner,f"select * from public.reservas where cancha_id='{court}' and fecha='2026-10-06' order by created_at desc,id desc limit 51"),
          'admin_payments':(admin,"select * from public.pagos where estado='pendiente' order by created_at desc,id desc limit 51"),
          'admin_reservations':(admin,"select * from public.reservas where estado='pendiente' order by created_at desc,id desc limit 51"),
          'admin_reports':(admin,"select * from public.reportes where estado='pendiente' order by created_at desc,id desc limit 51")}
        for name,(user,q) in queries.items():
            raw=db.sql(f"set role authenticated;set request.jwt.claim.sub='{user}';set request.jwt.claim.role='authenticated';explain (analyze,buffers,format json) {q}")
            plans[name]={'query':q,'role':'authenticated','plan':json.loads(raw)[0]}
        stages=[]
        for count in [50,100,500]:
            match_ids=[str(uuid.uuid5(uuid.NAMESPACE_URL,f'faltauno-local-{count}-{n}')) for n in range(20)]
            for mid in match_ids:db.sql(f"insert into public.partidos(id,organizador_id,cancha,zona,fecha,hora,formato,nivel,precio,cupos_totales) values ('{mid}','{owner}','Stress local','Centro','2099-01-01','20:00','5v5','Casual',10000,10)")
            gate=threading.Event();ready=queue.Queue();records=[];connections=[]
            def actor(n):
                start=time.perf_counter()
                try:c=Connection(host,port)
                except QueryError as e:ready.put(False);return {'connection_ms':(time.perf_counter()-start)*1000,'connected':False,'records':[]}
                connect_ms=(time.perf_counter()-start)*1000;ready.put(True);gate.wait(timeout=30)
                hour=8+n%15;date=f'2099-01-{1+[50,100,500].index(count):02d}'
                ops=[('feed',ids[n],"select public.feed_posts(p_limite=>30)"),('search',ids[n],queries['search_matches'][1]),('history',ids[n],"select public.historial_paginado('pagos')"),('agenda',owner,f"select public.historial_paginado('reservas','cancha','{court}',p_fecha=>'2026-10-06')"),('admin',admin,"select public.historial_paginado('pagos','admin',p_estado=>'pendiente')"),('enrollment',ids[n],f"select public.inscribirse_partido('{match_ids[n%20]}','efectivo','LOAD-{count}-{n}')"),('reservation',ids[n],f"select public.reservar_con_partido('LOAD-RES-{count}-{n}','{court}','{date}','{hour:02d}:00','{hour+1:02d}:00','efectivo')")]
                local=[]
                try:
                    for kind,user,q in ops:
                        begin=time.perf_counter();outcome='ok';state=None
                        try:c.query(role_query(user,q))
                        except QueryError as e:
                            outcome='business_rejection' if e.expected else 'unexpected_error';state=e.state
                            try:c.query('rollback')
                            except QueryError:pass
                        local.append({'type':kind,'ms':(time.perf_counter()-begin)*1000,'outcome':outcome,'sqlstate':state})
                finally:c.close()
                return {'connected':True,'connection_ms':connect_ms,'records':local}
            start=time.perf_counter()
            with concurrent.futures.ThreadPoolExecutor(max_workers=count) as pool:
                futures=[pool.submit(actor,n) for n in range(count)]
                admitted=sum(ready.get(timeout=30) for _ in range(count))
                before=db.sql("select jsonb_build_object('sessions',(select count(*) from pg_stat_activity),'cpu_count_setting',current_setting('max_connections'),'shared_buffers',current_setting('shared_buffers'))")
                sampler_stop=threading.Event();samples=[];resources=[]
                def sample():
                    while not sampler_stop.wait(.25):
                        try:samples.append(json.loads(db.sql("select jsonb_build_object('active',(select count(*) from pg_stat_activity where state='active'),'lock_waits',(select count(*) from pg_stat_activity where wait_event_type='Lock'),'lwlock_waits',(select count(*) from pg_stat_activity where wait_event_type='LWLock'),'wait_events',(select jsonb_object_agg(event,n) from (select coalesce(wait_event_type,'CPU')||':'||coalesce(wait_event,'running') event,count(*) n from pg_stat_activity where state='active' group by wait_event_type,wait_event) e))")))
                        except RuntimeError:pass
                def resource_sample():
                    while not sampler_stop.is_set():
                        raw=subprocess.run(['docker','stats','--no-stream','--format','{{json .}}',db.container],capture_output=True,text=True)
                        if raw.returncode==0:
                            try:
                                value=json.loads(raw.stdout);resources.append({k:value.get(k) for k in ['CPUPerc','MemUsage','MemPerc','PIDs']})
                            except ValueError:pass
                        sampler_stop.wait(1)
                resource_thread=threading.Thread(target=resource_sample);resource_thread.start()
                sampler=threading.Thread(target=sample);sampler.start();gate.set()
                actors=[f.result() for f in futures];sampler_stop.set();sampler.join();resource_thread.join()
            records=[r for a in actors for r in a['records']]
            assert db.sql("select count(*) from public.partidos where cupos_ocupados>cupos_totales")=='0'
            assert db.sql(f"select count(*) from public.reservas where referencia like 'LOAD-RES-{count}-%'")=='15'
            stage={'simulated_sessions':count,'connected':admitted,'connection_failures':count-admitted,'connection_p95_ms':percentile([a['connection_ms'] for a in actors],.95),'wall_seconds':round(time.perf_counter()-start,3),'summary':summary(records),'by_operation':{kind:summary([r for r in records if r['type']==kind]) for kind in sorted({r['type'] for r in records})},'configuration':json.loads(before),'samples':samples,'resource_samples':resources,'no_overselling':True,'reserved_slots':15}
            stages.append(stage);print(json.dumps({k:v for k,v in stage.items() if k not in ('by_operation','samples','configuration')}),flush=True)
        report={'scope':'POSTGRESQL LOCAL ONLY; NOT USERS SUPPORTED OR SLA','dataset':data,'stages':stages,'explain_analyze_buffers':plans,'environment':{'cpu_visible':os.cpu_count(),'runner_cpu_max':pathlib.Path('/sys/fs/cgroup/cpu.max').read_text().strip(),'runner_memory_max':pathlib.Path('/sys/fs/cgroup/memory.max').read_text().strip(),'postgres':'17-alpine','max_connections':650,'shared_buffers':'128MB'},'limits':['JWT GUC stubs; no real Auth','No Storage HTTP/images/Realtime/CDN/mobile measurements','One burst of seven operations/session, not sustained load; resource sampling adds overhead','Cold vs warm caches not isolated; stages execute sequentially','Local libpq timings include transaction/JWT setup and row transfer','Feed SECURITY DEFINER: equivalent RLS SQL plan and real RPC plan both included']}
        (ROOT/'docs/auditoria/capacidad-postgres-local-2026-10-06.json').write_text(json.dumps(report,indent=2)+'\n')
if __name__=='__main__':main()
