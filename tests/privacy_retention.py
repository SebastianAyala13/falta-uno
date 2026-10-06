"""Exercise actual FK retention in disposable PostgreSQL; not real Auth/Storage."""
import json
import pathlib
import sys
from postgres_fixture import Postgres, ROOT
sys.path.insert(0,str(ROOT/'scripts/db'))
from generate_fixture import generate

def main():
    with Postgres() as db:
        db.bootstrap(); db.migrate()
        generate(db,courts=3,players=12,reservations=90,matches=10,payments=40,posts=20)
        db.sql("""insert into public.conciliaciones_pago(referencia,tipo,monto,proveedor_pago_id) values('FIXTURE-PAY-4','partido',10000,'fixture-provider');
        insert into public.movimientos_cancha(cancha_id,tipo,monto,reserva_id,descripcion)
        select cancha_id,'ajuste',1,id,'Fixture retention' from public.reservas where jugador_id=md5('fixture-user-4')::uuid limit 1;
        update public.reportes set foto_url='https://example.test/fixture.jpg' where autor_id=md5('fixture-user-4')::uuid;
        delete from auth.users where id=md5('fixture-user-4')::uuid;""")
        result=json.loads(db.sql("""select jsonb_build_object(
         'profile_removed',not exists(select 1 from public.profiles where id=md5('fixture-user-4')::uuid),
         'auth_stub_removed',not exists(select 1 from auth.users where id=md5('fixture-user-4')::uuid),
         'posts_removed',not exists(select 1 from public.posts where autor_id=md5('fixture-user-4')::uuid),
         'payments_removed',not exists(select 1 from public.pagos where jugador_id=md5('fixture-user-4')::uuid),
         'reservations_removed',not exists(select 1 from public.reservas where jugador_id=md5('fixture-user-4')::uuid),
         'report_snapshot_retained',exists(select 1 from public.reportes where contenido_id=md5('fixture-post-4')::uuid::text and autor_id is null and texto is not null and foto_url='https://example.test/fixture.jpg'),
         'refund_reference_retained',exists(select 1 from public.conciliaciones_pago where referencia='FIXTURE-PAY-4'),
         'owner_ledger_retained_unlinked',exists(select 1 from public.movimientos_cancha where descripcion='Fixture retention' and reserva_id is null))"""))
        assert all(result.values()),result
        db.sql("delete from auth.users where id=md5('fixture-user-1')::uuid;")
        result.update(json.loads(db.sql("""select jsonb_build_object(
        'deleted_owner_court_removed',not exists(select 1 from public.canchas where id=md5('fixture-court-1')::uuid),
        'deleted_owner_ledger_removed',not exists(select 1 from public.movimientos_cancha where cancha_id=md5('fixture-court-1')::uuid),
        'deleted_owner_withdrawals_removed',not exists(select 1 from public.retiros where cancha_id=md5('fixture-court-1')::uuid))""")))
        assert all(result.values()),result
        report={'scope':'PostgreSQL 17 local, actual migrations; Auth ID stubs only, no Auth HTTP/Storage blobs','passed':result,'deletions':'Only synthetic Auth fixtures, specifically to test deletion semantics; no migration workaround'}
        (ROOT/'docs/auditoria/privacidad-retencion-2026-10-06.json').write_text(json.dumps(report,indent=2)+'\n')
        print(json.dumps(report,indent=2))
if __name__=='__main__':main()
