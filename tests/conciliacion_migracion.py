"""Migration 19 fresh/legacy preservation and real collision rejections, isolated."""
import json,subprocess
from postgres_fixture import Postgres,ROOT
from backup_restore import state
from tanda1_fixture import migrate17

migration=(ROOT/'supabase/migrations/20261007120000_conciliacion_programada.sql').read_text()
preflight=(ROOT/'scripts/preflight-fiabilidad.sql').read_text()
installer='\n'.join(x for x in (ROOT/'scripts/db/programar_conciliacion.sql').read_text().splitlines() if not x.startswith('\\set'))+'\n'
old=subprocess.check_output(['git','show','fab60c0:scripts/db/programar_conciliacion.sql']).decode()
legacy='BEGIN;SET LOCAL check_function_bodies=off;'+old[old.index('CREATE TABLE'):old.index('-- Repeated install')]+'COMMIT;'
checks={};cases=[]
with Postgres() as db:
    db.bootstrap();migrate17(db)
    db.sql((ROOT/'supabase/migrations/20261006200000_retencion_eliminacion.sql').read_text())
    db.sql("insert into supabase_migrations.schema_migrations values('20261006200000')")
    def probe(database='postgres'):
        before=state(db,database);output=db.sql(preflight,database)
        rows={parts[0]:{'cantidad':int(parts[1]),'detalles':json.loads(parts[2])} for parts in (line.split('|',2) for line in output.splitlines())}
        assert state(db,database)==before
        assert len(rows)==20,rows
        return rows
    clean=probe()
    inventory=clean['conciliacion_inventario']['detalles']
    checks['preflight_18_reports_five_objects_absent']=len(inventory)==5 and all(not r['existe'] for r in inventory)
    checks['preflight_18_all_zero']=all(r['cantidad']==0 for r in clean.values())
    db.sql(migration)
    checks['migration_without_cron_net_vault']=db.sql("select to_regclass('cron.job') is null and to_regclass('net._http_response') is null and to_regclass('vault.decrypted_secrets') is null")=='t'
    checks['migration_did_not_schedule_or_invoke']=db.sql('select count(*) from public.ejecuciones_conciliacion')=='0'
    adopted=probe();checks['compatible_objects_not_false_collisions']=all(r['cantidad']==0 for r in adopted.values()) and all(r['existe'] for r in adopted['conciliacion_inventario']['detalles'])
    db.sql("insert into public.ejecuciones_conciliacion(request_id,estado,error_codigo) values(123,'fallida','ISOLATED_FIXTURE')")
    prior=state(db,'postgres');db.sql(migration)
    checks['repeat_migration_preserves_rows_and_catalog']=state(db,'postgres')==prior
    db.sql("insert into supabase_migrations.schema_migrations values('20261007120000')")
    checks['history_has_19']=db.sql('select count(*) from supabase_migrations.schema_migrations')=='19'
    checks['recorded_19_preflight_zero']=all(r['cantidad']==0 for r in probe().values())
    checks['effective_execute_roles']=db.sql("select count(*) from pg_proc p where oid in (to_regprocedure('public.observar_conciliacion()'),to_regprocedure('public.encolar_conciliacion()'),to_regprocedure('public.estado_conciliacion()')) and not has_function_privilege('anon',oid,'EXECUTE') and has_function_privilege('service_role',oid,'EXECUTE') and has_function_privilege('authenticated',oid,'EXECUTE')=(oid=to_regprocedure('public.estado_conciliacion()'))")=='3'
    try:db.sql(installer)
    except RuntimeError as e:assert 'Habilitar pg_cron, pg_net y Vault' in str(e)
    else:raise AssertionError('No scheduler without extensions')
    checks['editor_requires_extensions']=True
    # Independent databases, not cleaning or deleting records to force a pass.
    setups=[
      ('conciliacion_relacion_incompatible','create view public.ejecuciones_conciliacion as select 1 as id',False),
      ('conciliacion_tipo_incompatible','create domain public.ejecuciones_conciliacion as text',False),
      ('conciliacion_columna_incompatible','alter table public.ejecuciones_conciliacion alter column http_status type text',True),
      ('conciliacion_columna_incompatible','alter table public.ejecuciones_conciliacion add column required_fixture text not null',True),
      ('conciliacion_default_incompatible','alter table public.ejecuciones_conciliacion alter column encolada_at set default now()',True),
      ('conciliacion_restriccion_incompatible','alter table public.ejecuciones_conciliacion drop constraint ejecuciones_conciliacion_request_id_key',True),
      ('conciliacion_indice_incompatible','create index conciliacion_ejecuciones_fecha_idx on public.profiles(id)',False),
      ('conciliacion_rpc_incompatible','create function public.observar_conciliacion() returns integer language sql as $$select 1$$',False),
      ('conciliacion_rpc_incompatible','create function public.encolar_conciliacion() returns setof bigint language sql as $$select 1::bigint$$',False),
      ('conciliacion_politica_incompatible','create policy fixture_open on public.ejecuciones_conciliacion for select to authenticated using(true)',True),
    ]
    for number,(kind,ddl,with_legacy) in enumerate(setups):
        name='collision19_'+str(number);db.sql('create database '+name);db.bootstrap(name)
        db.sql('create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key);',name)
        for path in sorted((ROOT/'supabase/migrations').glob('*.sql')):
            if path.name<'20261007120000':
                db.sql(path.read_text().replace('CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";','-- isolated fixture'),name)
                db.sql("insert into supabase_migrations.schema_migrations values('"+path.name.split('_')[0]+"')",name)
        if with_legacy:db.sql(legacy,name)
        db.sql(ddl,name);rows=probe(name)
        assert rows[kind]['cantidad']>0,(kind,rows)
        before=state(db,name)
        try:db.sql(migration,name)
        except RuntimeError as e:assert 'Colisión:' in str(e)
        else:raise AssertionError('Expected actual rejection: '+kind)
        assert state(db,name)==before
        cases.append({'case':kind,'detected':True,'actual_migration_rejected':True,'rollback_equal':True})
    db.sql('create database legacy19');db.bootstrap('legacy19')
    for path in sorted((ROOT/'supabase/migrations').glob('*.sql')):
        if path.name<'20261007120000':db.sql(path.read_text().replace('CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";','-- isolated'),'legacy19')
    db.sql(legacy,'legacy19')
    db.sql("alter table public.ejecuciones_conciliacion add column optional_fixture text;alter table public.ejecuciones_conciliacion add column default_fixture text not null default 'fixture';create policy fixture_admin_only on public.ejecuciones_conciliacion for select to authenticated using(public.is_admin());insert into public.ejecuciones_conciliacion(request_id,estado,error_codigo) values(321,'fallida','OLD_INSTALLER_FIXTURE');",'legacy19')
    before=db.sql("select to_jsonb(t)::text from public.ejecuciones_conciliacion t",'legacy19');db.sql(migration,'legacy19')
    checks['old_installer_rows_and_compatible_extras_preserved']=db.sql("select to_jsonb(t)::text from public.ejecuciones_conciliacion t",'legacy19')==before
    checks['old_installer_also_no_cron_activation']=db.sql("select to_regclass('cron.job') is null",'legacy19')=='t'
    assert all(checks.values()),checks
    report={'scope':'PostgreSQL 17 isolated, 18 to 19 real migrations plus former installer objects; no production, live cron/HTTP/Vault/Windows','checks':checks,'count':len(checks),'passed':True,'preflight_18_inventory':inventory,'collision_cases':cases,'collision_count':len(cases),'migration_no_activation':True}
    (ROOT/'docs/auditoria/conciliacion-migracion19-local-2026-10-06.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'checks':len(checks),'passed':True,'collision_cases':len(cases),'migration_no_activation':True}))
