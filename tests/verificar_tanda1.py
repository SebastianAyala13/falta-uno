"""17-migration catalog/role probe, including safe failure paths and rollback."""
import json
from postgres_fixture import Postgres,ROOT
from tanda1_fixture import migrate17,seed_targets
from backup_restore import state
with Postgres() as db:
    db.bootstrap();migrate17(db);seed_targets(db)
    script=(ROOT/'scripts/db/verificar_produccion_tanda1.sql').read_text()
    before=state(db,'postgres')
    output=db.sql(script)
    rows=[dict(zip(['nombre','estado','detalle'],line.split('|',2))) for line in output.splitlines()]
    assert rows and all(r['estado']=='ok' for r in rows),[r for r in rows if r['estado']!='ok']
    assert state(db,'postgres')==before
    assert db.sql("select count(*) from pg_class where relname='verificacion_tanda1'")=='0'
    # Catalog history incomplete and permissive price grant must actually fail.
    db.sql("update supabase_migrations.schema_migrations set version='00000000000000' where version='20261006180000';grant update(precio) on public.reservas to authenticated;alter table public.reservas disable trigger trg_validar_reserva;")
    altered=state(db,'postgres');bad=db.sql(script)
    assert 'migraciones_17|falla|' in bad and 'negativa.cambiar_precio_reserva|falla|UPDATE aceptado (filas=1)' in bad
    assert state(db,'postgres')==altered
    report={'scope':'PostgreSQL 17 isolated, exactly 17 migrations; history/Auth/Storage stubs, seed UUIDs with synthetic fields; not production SQL Editor or real Supabase','checks':rows,'rollback_state_equal':True,'temporary_objects_gone':True,'wrong_history_detected':True,'successful_unauthorized_update_reported_failure':True,'failure_paths_rollback_equal':True}
    (ROOT/'docs/auditoria/tanda1-verificacion-local-2026-10-06.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'checks':len(rows),'all_ok':True,'rollback':True,'negative_controls':True}))
