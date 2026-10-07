"""18-migration probe and meaningful failure controls, disposable local DB only."""
import json
from postgres_fixture import Postgres,ROOT
from tanda1_fixture import seed_targets,migrate17
from backup_restore import state

def snapshot(db):
    result=state(db,'postgres')
    for table in ['auth.users','storage.objects','supabase_migrations.schema_migrations']:
        result[table]=db.sql(f"select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from {table} t")
    if db.sql("select to_regclass('cron.job') is not null")=='t':
        result['cron']=db.sql("select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from cron.job t")
    result['storage_catalog']=db.sql("select coalesce(jsonb_agg(pg_get_triggerdef(oid) order by tgname),'[]') from pg_trigger where tgrelid='storage.objects'::regclass and not tgisinternal")
    return result

def probe(db,script):
    before=snapshot(db);output=db.sql(script)
    rows=[dict(zip(['nombre','estado','detalle'],line.split('|',2))) for line in output.splitlines()]
    assert snapshot(db)==before,'Probe persisted changes'
    assert db.sql("select count(*) from pg_class where relname='verificacion_tanda2'")=='0'
    return rows

with Postgres() as db:
    db.bootstrap();migrate17(db);seed_targets(db)
    script=(ROOT/'scripts/db/verificar_produccion_tanda2.sql').read_text()
    uninstalled=probe(db,script)
    assert {'migraciones_18','ultima_migracion','negativas'}<={r['nombre'] for r in uninstalled if r['estado']=='falla'}
    db.sql((ROOT/'supabase/migrations/20261006200000_retencion_eliminacion.sql').read_text())
    db.sql("insert into supabase_migrations.schema_migrations values('20261006200000')")
    rows=probe(db,script)
    assert rows and all(r['estado']=='ok' for r in rows),[r for r in rows if r['estado']!='ok']
    db.sql("create schema cron;create table cron.job(jobid bigint,jobname text,command text,active boolean);")
    cron_empty=probe(db,script);assert all(r['estado']=='ok' for r in cron_empty)
    db.sql("insert into cron.job values(1,'faltauno-retencion','select public.aplicar_retencion(1000);',false);alter table storage.objects disable trigger a_guard_eliminacion_storage;alter table public.profiles disable trigger a_retencion_perfil;grant insert on public.archivo_contable to authenticated;create policy probe_bad_insert on public.archivo_contable for insert to authenticated with check(true);create policy probe_bad_select on public.solicitudes_eliminacion for select to authenticated using(true);create policy probe_bad_archive_select on public.archivo_contable for select to authenticated using(true);grant insert on public.ejecuciones_retencion to authenticated;create policy probe_bad_execution on public.ejecuciones_retencion for insert to authenticated with check(true);")
    bad=probe(db,script);failures={r['nombre'] for r in bad if r['estado']=='falla'}
    expected={'purgador_no_programado','trigger.storage.objects.a_guard_eliminacion_storage','trigger.public.profiles.a_retencion_perfil','negativa.leer_solicitud_ajena','negativa.leer_archivo_ajeno','negativa.insertar_ejecucion','negativa.insertar_archivo','guard_cierre_auth','politica.public.solicitudes_eliminacion','politica.public.archivo_contable','permisos.public.archivo_contable'}
    assert expected<=failures,(expected-failures,bad)
    report={'scope':'PostgreSQL 17 isolated with 18 real migrations; Auth/Storage metadata and cron catalog stubs, no production, cron worker or real Auth/Storage','checks':rows,'count':len(rows),'all_ok':True,'rows_catalog_auth_storage_history_rollback_equal':True,'temporary_objects_gone':True,'cron_absent_and_empty_verified':True,'uninstalled_ninth_reports_failures_without_aborting':True,'negative_control_failures':sorted(failures),'unexpected_successful_insert_and_auth_cascade_rolled_back':True}
    (ROOT/'docs/auditoria/tanda2-verificacion-local-2026-10-06.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'checks':len(rows),'all_ok':True,'rollback':True,'negative_controls':sorted(failures)}))
