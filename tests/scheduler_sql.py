"""Real PostgreSQL SQL logic with explicit cron/net/Vault doubles; no HTTP deployment."""
import json
from postgres_fixture import Postgres,ROOT
with Postgres() as db:
    db.bootstrap();db.migrate()
    db.sql("""
      create schema cron;create schema net;
      create table vault.decrypted_secrets(name text primary key,decrypted_secret text);
      create table cron.job(jobid bigint generated always as identity primary key,jobname text unique,schedule text,command text,active boolean default true);
      create table cron.job_run_details(jobid bigint,status text,start_time timestamptz,end_time timestamptz);
      create function cron.schedule(name text,schedule text,command text) returns bigint language plpgsql as $$declare id bigint;begin insert into cron.job(jobname,schedule,command) values(name,schedule,command) on conflict(jobname) do update set schedule=excluded.schedule,command=excluded.command returning jobid into id;return id;end$$;
      create table net._http_response(id bigint,status_code integer,content text,timed_out boolean,error_msg text);
      create table net.requests(id bigint generated always as identity primary key,url text,headers jsonb,body jsonb);
      create function net.http_post(url text,body jsonb default '{}',params jsonb default '{}',headers jsonb default '{}',timeout_milliseconds integer default 1000) returns bigint language plpgsql as $$declare id bigint;begin insert into net.requests(url,headers,body) values(url,headers,body) returning net.requests.id into id;return id;end$$;
    """)
    install=(ROOT/'scripts/db/programar_conciliacion.sql').read_text()
    db.sql(install);db.sql(install);assert db.sql('select count(*) from cron.job')=='1'
    before=json.loads(db.sql('select public.estado_conciliacion()'));assert before['alarma']
    db.sql('select public.encolar_conciliacion()');assert db.sql("select error_codigo from public.ejecuciones_conciliacion order by encolada_at desc limit 1")=='CONFIGURACION_AUSENTE_O_INVALIDA'
    db.sql("insert into vault.decrypted_secrets values ('faltauno_conciliacion_url','https://fixture.supabase.co/functions/v1/conciliar-pagos'),('faltauno_conciliacion_secret','fixture-only-not-a-real-secret')")
    db.sql("update public.ejecuciones_conciliacion set encolada_at=now()-interval '5 minutes'")
    first=db.sql('select public.encolar_conciliacion()');assert first=='1'
    assert db.sql('select public.encolar_conciliacion()')==''
    db.sql("insert into net._http_response values(1,200,'{\"ok\":true,\"caducados\":{\"pagos\":2,\"reservas\":3},\"reembolsos\":\"desactivados\"}',false,null);select public.observar_conciliacion()")
    assert db.sql('select pagos_liberados||\'|\'||reservas_liberadas from public.ejecuciones_conciliacion where request_id=1')=='2|3'
    assert not json.loads(db.sql('select public.estado_conciliacion()'))['alarma']
    db.sql("update public.ejecuciones_conciliacion set terminada_at=now()-interval '4 minutes' where estado='ok'")
    assert json.loads(db.sql('select public.estado_conciliacion()'))['alarma']
    db.sql("update public.ejecuciones_conciliacion set terminada_at=now() where estado='ok'")
    assert not json.loads(db.sql('select public.estado_conciliacion()'))['alarma']
    db.sql('select public.encolar_conciliacion()')
    db.sql("insert into net._http_response values(2,500,'{}',false,null);select public.observar_conciliacion()")
    assert db.sql('select estado from public.ejecuciones_conciliacion where request_id=2')=='fallida'
    third=db.sql('select public.encolar_conciliacion()');assert third=='3'
    db.sql("update public.ejecuciones_conciliacion set encolada_at=now()-interval '4 minutes' where request_id=3;select public.observar_conciliacion()")
    assert db.sql('select estado from public.ejecuciones_conciliacion where request_id=3')=='sin_respuesta'
    verification=db.sql((ROOT/'scripts/db/verificar_conciliacion.sql').read_text())
    assert 'fixture-only-not-a-real-secret' not in verification
    raw=db.sql('select public.estado_conciliacion()');state=json.loads(raw);assert state['alarma'] and state['ultimo_ok'] and 'fixture-only-not-a-real-secret' not in raw
    db.sql("insert into auth.users values ('00000000-0000-0000-0000-000000000001');insert into public.profiles(id,nombre,email,posicion,nivel) values ('00000000-0000-0000-0000-000000000001','Fixture','fixture@example.test','Portero','Casual')")
    assert db.sql("set role authenticated;set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';set request.jwt.claim.role='authenticated';select public.estado_conciliacion()")==''
    try:db.sql("set role authenticated;select public.encolar_conciliacion()")
    except RuntimeError:pass
    else:raise AssertionError('Player must not invoke scheduler')
    report={'scope':'PostgreSQL logic only; pg_cron/pg_net/Vault doubles, not installed or deployed','read_only_postdeploy_sql_executed':True,'heartbeat_stale_alarm_and_recovery':True,'idempotent_install':True,'one_job':True,'missing_config_visible':True,'counts_observed':{'pagos':2,'reservas':3},'http_failure_visible':True,'missing_response_visible':True,'secrets_absent_from_status':True,'player_denied':True,'final_status':state}
    (ROOT/'docs/auditoria/conciliacion-programacion-2026-10-06.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='final_status'},indent=2))
