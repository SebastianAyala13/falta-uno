"""Pure read preflight, exact-17 baseline, real collision failures, no data purges."""
import json
from postgres_fixture import Postgres,ROOT
from tanda1_fixture import migrate17,seed_targets
from backup_restore import state
with Postgres() as db:
    db.bootstrap();migrate17(db);seed_targets(db)
    script=(ROOT/'scripts/preflight-fiabilidad.sql').read_text()
    migration=(ROOT/'supabase/migrations/20261006200000_retencion_eliminacion.sql').read_text()
    def run():return {line.split('|',2)[0]:{'cantidad':int(line.split('|',2)[1]),'detalles':json.loads(line.split('|',2)[2])} for line in db.sql(script).splitlines()}
    db.sql("insert into public.movimientos_cancha(cancha_id,tipo,monto) values('a0e00000-0000-4000-b000-000000000001','ajuste',100);insert into public.retiros(cancha_id,monto,estado) values('a0e00000-0000-4000-b000-000000000001',50,'solicitado');update public.profiles set suspendido=true where id='a0e00000-0000-4000-a000-000000000005';insert into storage.objects(bucket_id,name,owner) values('canchas','legacy-fixture.jpg',null);")
    before=state(db,'postgres');healthy=run();assert all(row['cantidad']==0 for row in healthy.values()),healthy
    assert state(db,'postgres')==before
    cases=[('retencion_relacion_existente','create index reportes_retencion_idx on public.reportes(created_at)'),
      ('retencion_tipo_existente','create domain public.archivo_contable as text'),
      ('retencion_columna_existente','alter table public.reportes add column desidentificado_at timestamptz'),
      ('retencion_funcion_existente','create function public.solicitar_eliminacion(uuid) returns jsonb language sql as $$ select null::jsonb $$'),
      ('retencion_trigger_existente','create trigger a_retencion_perfil before delete on public.profiles for each row execute function public.fn_guard_roles()')]
    checks=[]
    # Every case runs in its own separate DB: no cleanup/delete to make it pass.
    for kind,ddl in cases:
        name='collision'+str(len(checks));db.sql('create database '+name);db.bootstrap(name)
        for path in sorted((ROOT/'supabase/migrations').glob('*.sql')):
            if path.name<'20261006200000':db.sql(path.read_text().replace('CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";','-- stub'),name)
        db.sql(ddl,name)
        rows=db.sql(script,name);assert kind+'|1|' in rows,(kind,rows)
        try:db.sql(migration,name)
        except RuntimeError:pass
        else:raise AssertionError('Preflight collision must cause real migration failure')
        checks.append({'case':kind,'preflight_detected':True,'actual_migration_rejected':True})
    # Confirm legitimate schema/data do not block installation. Completed history
    # must not report collisions for its own objects on repeat workflow.
    db.sql(migration);db.sql("insert into supabase_migrations.schema_migrations values('20261006200000')")
    done=run();assert all(row['cantidad']==0 for row in done.values()),done
    report={'scope':'PostgreSQL 17 isolated; before-9th baseline has exactly 17 migrations; no production','healthy_17_all_zero':healthy,'read_only_state_equal':True,'collisions':checks,'pending_money_suspended_profile_legacy_storage_no_false_positive':True,'healthy_actual_migration_passed':True,'recorded_18th_no_false_collision':True,'limits':'Does not predict permissions, missing extensions, locks/timeouts, SQL edits or cloud-managed trigger restrictions; money outstanding is NOT an install conflict'}
    (ROOT/'docs/auditoria/preflight-retencion-local-2026-10-06.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'healthy':True,'collision_cases':len(checks),'applied_recheck_zero':True}))
