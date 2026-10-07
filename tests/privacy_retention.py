"""Actual deletion/retention safeguards in disposable PostgreSQL 17 only."""
import json
import subprocess
import concurrent.futures,time
from libpq_local import Connection,QueryError,endpoint
from postgres_fixture import Postgres,ROOT

def rejected(db,query,needle):
    try:db.sql(query)
    except RuntimeError as error:
        assert needle in str(error),str(error)
        return True
    raise AssertionError('Expected SQL rejection')

def main():
    checks={}
    with Postgres(capacity=True) as db:
        db.bootstrap();db.migrate()
        db.sql("""insert into auth.users(id) select md5('ret-user-'||n)::uuid from generate_series(1,4)n;
        insert into public.profiles(id,nombre,email,ciudad,posicion,nivel,roles)
        select md5('ret-user-'||n)::uuid,'Fixture','fixture@example.test','Pereira','Portero','Casual',case when n=3 then array['admin','jugador'] when n=1 then array['cancha','jugador'] else array['jugador'] end from generate_series(1,4)n;
        insert into public.canchas(id,owner_id,nombre,direccion,zona,ciudad,formatos) values(md5('ret-court')::uuid,md5('ret-user-1')::uuid,'Fixture','Ficticia','Centro','Pereira',array['5v5']);
        insert into public.cancha_disponibilidad(cancha_id,dia_semana,hora_apertura,hora_cierre,duracion_min,precio) select md5('ret-court')::uuid,n,'08:00','23:00',60,100 from generate_series(0,6)n;
        insert into public.partidos(id,organizador_id,cancha,zona,fecha,hora,formato,nivel,precio,cupos_totales) values(md5('ret-match')::uuid,md5('ret-user-1')::uuid,'Fixture','Centro',current_date-1,'20:00','5v5','Casual',100,10);
        insert into public.pagos(id,partido_id,jugador_id,medio,monto,estado,referencia) values(md5('ret-pay')::uuid,md5('ret-match')::uuid,md5('ret-user-2')::uuid,'online',100,'aprobado','RET-PAY');
        insert into public.reservas(id,cancha_id,jugador_id,fecha,hora_inicio,hora_fin,precio,medio,estado,referencia) values(md5('ret-res')::uuid,md5('ret-court')::uuid,md5('ret-user-2')::uuid,current_date-1,'08:00','09:00',100,'online','confirmada','RET-RES');
        update public.reservas set estado_pago='confirmado' where referencia='RET-RES';
        insert into public.movimientos_cancha(cancha_id,tipo,monto,reserva_id) values(md5('ret-court')::uuid,'ingreso_reserva',100,md5('ret-res')::uuid),(md5('ret-court')::uuid,'comision',-10,md5('ret-res')::uuid);
        insert into public.retiros(cancha_id,monto,estado) values(md5('ret-court')::uuid,90,'solicitado');
        insert into public.posts(id,autor_id,autor_nombre,tipo,texto,foto_url) values(md5('ret-post')::uuid,md5('ret-user-2')::uuid,'Fixture','pregunta','Texto sensible ficticio','https://example.test/photo.jpg');
        begin;select set_config('request.jwt.claim.sub',md5('ret-user-3')::uuid::text,true);select set_config('request.jwt.claim.role','service_role',true);
        insert into public.reportes(tipo,contenido_id,reportado_por,motivo) values('post',md5('ret-post')::uuid::text,md5('ret-user-3')::uuid,'acoso');commit;
        insert into public.reservas(id,cancha_id,jugador_id,fecha,hora_inicio,hora_fin,precio,medio,estado,referencia) values(md5('ret-future')::uuid,md5('ret-court')::uuid,md5('ret-user-2')::uuid,current_date+1,'08:00','09:00',100,'efectivo','confirmada','RET-FUTURE');
        insert into public.conciliaciones_pago(referencia,tipo,monto,estado) values('RET-PAY','partido',100,'pendiente');""")
        player=json.loads(db.sql("select public.solicitar_eliminacion(md5('ret-user-2')::uuid)"))
        checks['request_always_recorded']=not player['lista'] and 'reservas_futuras' in player['motivos'] and 'devoluciones_pendientes' in player['motivos']
        checks['blocked_auth_cascade']=rejected(db,"delete from auth.users where id=md5('ret-user-2')::uuid",'Solicitud de borrado pendiente')
        checks['blocked_delete_preserves_money']=db.sql("select count(*) from public.pagos where referencia='RET-PAY'")=='1'
        checks['pending_request_no_new_booking']=rejected(db,"insert into public.reservas(cancha_id,jugador_id,fecha,hora_inicio,hora_fin,precio,referencia) values(md5('ret-court')::uuid,md5('ret-user-2')::uuid,current_date+2,'08:00','09:00',100,'NEW')",'solicitud de borrado')
        checks['pending_request_no_new_blob']=rejected(db,"insert into storage.objects(bucket_id,name,owner) values('media',md5('ret-user-2')::uuid::text||'/new.jpg',md5('ret-user-2')::uuid)",'solicitud de borrado')
        owner=json.loads(db.sql("select public.solicitar_eliminacion(md5('ret-user-1')::uuid)"))
        checks['owner_balance_and_withdrawal_block']=not owner['lista'] and 'saldo_por_liquidar' in owner['motivos'] and 'retiros_en_curso' in owner['motivos']
        checks['owner_request_blocks_other_players']=rejected(db,"insert into public.reservas(cancha_id,jugador_id,fecha,hora_inicio,hora_fin,precio,referencia) values(md5('ret-court')::uuid,md5('ret-user-4')::uuid,current_date+2,'08:00','09:00',100,'OTHER')",'solicitud de borrado')
        checks['direct_profile_delete_blocked']=rejected(db,"delete from public.profiles where id=md5('ret-user-1')::uuid",'Solicitud de borrado pendiente')
        checks['player_cannot_prepare_others']=rejected(db,"set role authenticated;select set_config('request.jwt.claim.sub',md5('ret-user-4')::uuid::text,false);select public.solicitar_eliminacion(md5('ret-user-1')::uuid)",'permission denied')
        # Simulated settlement, not erasing obligations: cancel future booking,
        # record refund terminal state, pay withdrawal through the actual admin RPC.
        db.sql("""update public.reservas set estado='cancelada' where referencia='RET-FUTURE';
        update public.conciliaciones_pago set estado='reembolsado' where referencia='RET-PAY';
        begin;select set_config('request.jwt.claim.sub',md5('ret-user-3')::uuid::text,true);select set_config('request.jwt.claim.role','authenticated',true);
        select public.admin_procesar_retiro((select id from public.retiros limit 1),'pagado');commit;""")
        checks['settlement_ledger_zero']=db.sql("select sum(monto) from public.movimientos_cancha")=='0'
        checks['settled_request_ready']=json.loads(db.sql("select public.solicitar_eliminacion(md5('ret-user-1')::uuid)"))['lista']
        db.sql("delete from auth.users where id=md5('ret-user-1')::uuid")
        checks['owner_removed_but_archive_preserved']=db.sql("select count(*) from public.profiles where id=md5('ret-user-1')::uuid")=='0' and int(db.sql('select count(*) from public.archivo_contable'))>=7
        checks['archive_contains_no_deleted_identity']=db.sql("select count(*) from public.archivo_contable where titular_vigente=md5('ret-user-1')::uuid or datos::text like '%fixture@example.test%' or datos ?| array['jugador_id','owner_id','nombre','documento','numero','texto','descripcion']")=='0'
        checks['surviving_player_can_read_own_archive']=int(db.sql("set role authenticated;select set_config('request.jwt.claim.sub',md5('ret-user-2')::uuid::text,false);select count(*) from public.archivo_contable").splitlines()[-1])>=3
        checks['other_player_cannot_read_archive']=db.sql("set role authenticated;select set_config('request.jwt.claim.sub',md5('ret-user-4')::uuid::text,false);select count(*) from public.archivo_contable").splitlines()[-1]=='0'
        db.sql("select public.solicitar_eliminacion(md5('ret-user-2')::uuid);delete from auth.users where id=md5('ret-user-2')::uuid")
        checks['report_snapshot_scrubbed']=db.sql("select count(*) from public.reportes where autor_id is null and texto is null and foto_url is null and contenido_id<>md5('ret-post')::uuid::text and desidentificado_at is not null")=='1'
        checks['receipt_scrubbed_and_bounded']=db.sql("select count(*) from public.solicitudes_eliminacion where usuario_id is null and estado='completada' and conservar_hasta<=completada_at+interval '91 days'")=='2'
        checks['archive_ten_year_deadline']=db.sql("select count(*) from public.archivo_contable where conservar_hasta between archivado_at+interval '10 years'-interval '1 minute' and archivado_at+interval '10 years'+interval '1 minute'")==db.sql('select count(*) from public.archivo_contable')
        first=json.loads(db.sql('select public.aplicar_retencion(1000)'))
        checks['no_premature_purge']=all(v==0 for v in first.values())
        # Age just the synthetic records to exercise policy expiration; no real rows.
        db.sql("""update public.archivo_contable set conservar_hasta=now()-interval '1 day';
        update public.reportes set created_at=now()-interval '91 days';
        update public.solicitudes_eliminacion set conservar_hasta=now()-interval '1 day';
        update public.conciliaciones_pago set updated_at=now()-interval '11 years';
        insert into public.conciliaciones_pago(referencia,tipo,monto,estado,created_at,updated_at) values('UNRESOLVED','partido',1,'pendiente',now()-interval '11 years',now()-interval '11 years');""")
        final=json.loads(db.sql('select public.aplicar_retencion(1000)'))
        checks['expired_policy_records_purged']=final['archivo']>=7 and final['reportes']==1 and final['solicitudes']==2 and final['devoluciones']==1
        checks['old_unresolved_debt_not_purged']=db.sql("select count(*) from public.conciliaciones_pago where referencia='UNRESOLVED'")=='1'
        checks['invalid_purge_limit_rejected']=rejected(db,'select public.aplicar_retencion(0)','Límite inválido')
        # Real overlapping transactions, no sleep-based synchronization: first
        # hold a request row lock, observe blocked writer via pg_stat_activity,
        # then commit and require rejection. Reverse order must preserve booking.
        db.sql("insert into auth.users(id) values(md5('race-owner')::uuid),(md5('race-player')::uuid);insert into public.profiles(id,nombre,email,ciudad,posicion,nivel,roles) select id,'Race','race@example.test','Pereira','Portero','Casual',array['jugador','cancha'] from auth.users where id in (md5('race-owner')::uuid,md5('race-player')::uuid);insert into public.canchas(id,owner_id,nombre,direccion,zona,ciudad,formatos) values(md5('race-court')::uuid,md5('race-owner')::uuid,'Race','Ficticia','Centro','Pereira',array['5v5']);")
        host,port=endpoint(db);a=Connection(host,port);b=Connection(host,port)
        try:
            a.query("begin;select public.solicitar_eliminacion(md5('race-owner')::uuid)")
            def booking():
                try:b.query("insert into public.reservas(cancha_id,jugador_id,fecha,hora_inicio,hora_fin,precio,referencia) values(md5('race-court')::uuid,md5('race-player')::uuid,current_date+1,'08:00','09:00',100,'RACE')");return False
                except QueryError as e:return e.state=='23514'
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                future=pool.submit(booking)
                deadline=time.monotonic()+5
                waiting=False
                while time.monotonic()<deadline:
                    if db.sql("select count(*) from pg_stat_activity where application_name='faltauno_isolated_measure' and wait_event_type='Lock'")!='0':waiting=True;break
                    time.sleep(.02)
                a.query('commit')
                checks['concurrent_new_booking_waits_then_rejects']=waiting and future.result(timeout=10)
            # Reverse ordering: on a separate owner, a live booking wins first;
            # the later request must see it and block deletion, not erase it.
            db.sql("insert into auth.users(id) values(md5('race-owner-2')::uuid);insert into public.profiles(id,nombre,email,ciudad,posicion,nivel,roles) values(md5('race-owner-2')::uuid,'Race','race@example.test','Pereira','Portero','Casual',array['jugador','cancha']);insert into public.canchas(id,owner_id,nombre,direccion,zona,ciudad,formatos) values(md5('race-court-2')::uuid,md5('race-owner-2')::uuid,'Race','Ficticia','Centro','Pereira',array['5v5']);")
            b.query("begin;insert into public.reservas(cancha_id,jugador_id,fecha,hora_inicio,hora_fin,precio,referencia) values(md5('race-court-2')::uuid,md5('race-player')::uuid,current_date+1,'08:00','09:00',100,'RACE-2')")
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                future=pool.submit(a.query,"select public.solicitar_eliminacion(md5('race-owner-2')::uuid)")
                deadline=time.monotonic()+5;waiting=False
                while time.monotonic()<deadline:
                    if db.sql("select count(*) from pg_stat_activity where application_name='faltauno_isolated_measure' and wait_event_type='Lock'")!='0':waiting=True;break
                    time.sleep(.02)
                b.query('commit')
                response=json.loads(future.result(timeout=10))
                checks['concurrent_booking_first_blocks_deletion']=waiting and not response['lista'] and 'reservas_futuras' in response['motivos']
        finally:a.close();b.close()
        db.sql("insert into public.movimientos_cancha(cancha_id,tipo,monto) values(md5('race-court')::uuid,'ajuste',1)")
        checks['late_balance_after_ready_still_blocks_auth']=rejected(db,"delete from auth.users where id=md5('race-owner')::uuid",'Solicitud de borrado pendiente') and db.sql("select sum(monto) from public.movimientos_cancha where cancha_id=md5('race-court')::uuid")=='1'
        db.sql("create schema cron;create table cron.job(jobid bigint generated always as identity primary key,jobname text unique,schedule text,command text);create function cron.schedule(name text,schedule text,command text) returns bigint language plpgsql as $$declare id bigint;begin insert into cron.job(jobname,schedule,command) values(name,schedule,command) on conflict(jobname) do update set schedule=excluded.schedule,command=excluded.command returning jobid into id;return id;end$$;")
        install=(ROOT/'scripts/db/programar_retencion.sql').read_text();db.sql(install);db.sql(install)
        checks['purge_schedule_installer_idempotent']=db.sql("select count(*) from cron.job where jobname='faltauno-retencion' and schedule='15 8 * * *'")=='1'
        checks['purge_execution_counts_visible']=int(db.sql('select count(*) from public.ejecuciones_retencion'))==2
        assert all(checks.values()),checks
        report={'scope':'PostgreSQL 17 isolated, real migrations, Auth ID stubs, Storage metadata and cron SQL doubles only; no cron worker, real Auth/Storage or PSP payment; settlement synthetic','checks':checks,'count':len(checks),'passed':all(checks.values())}
        (ROOT/'docs/auditoria/retencion-cuenta-2026-10-06.json').write_text(json.dumps(report,indent=2)+'\n')
        print(json.dumps(report,indent=2))
if __name__=='__main__':main()
