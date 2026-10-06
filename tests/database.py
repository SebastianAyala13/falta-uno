"""PostgreSQL 17 regression/concurrency tests. Requires Docker, no production access.

Uses the complete application migrations, with auth stubs matching the JWT GUCs.
Only the unused Supabase Vault extension declaration is omitted in the test copy.
Does not emulate HTTP Auth/Realtime/Storage or certify their deployment.
"""
import concurrent.futures
import json
import pathlib
import subprocess
import time
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[1]
CONTAINER = f"faltauno-regression-{uuid.uuid4().hex[:8]}"


def sql(query, user=None, role="authenticated", ok=True, database="postgres"):
    if user is not None:
        query = f"set role {role}; set request.jwt.claim.sub = '{user}'; set request.jwt.claim.role = '{role}';\n" + query
    result = subprocess.run(
        ["docker", "exec", "-i", CONTAINER, "psql", "-h", "127.0.0.1", "-X", "-qAt", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-d", database],
        input=query, text=True, capture_output=True,
    )
    if ok and result.returncode:
        raise AssertionError(result.stderr)
    if not ok:
        assert result.returncode != 0, "Operation unexpectedly succeeded"
    return result


def uid(n):
    return str(uuid.UUID(int=n))


def scalar(query, **kwargs):
    return sql(query, **kwargs).stdout.strip()


def parallel(tasks):
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
        return list(pool.map(lambda task: task(), tasks))


def check(label, fn):
    fn()
    print(f"PASS {label}", flush=True)


def main():
    subprocess.run(["docker", "run", "--rm", "--name", CONTAINER, "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "-d", "postgres:17-alpine"], check=True, capture_output=True)
    try:
        for _ in range(50):
            ready = subprocess.run(["docker", "exec", CONTAINER, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"], capture_output=True)
            if ready.returncode == 0:
                break
            time.sleep(0.2)
        sql("""
          create schema auth; create schema extensions; create schema vault;
          -- Minimal Storage tables for testing policy/migration SQL; HTTP Storage
          -- upload restrictions and object deletion are tested separately.
          create schema storage;
          create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
          create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner uuid,owner_id text,primary key(bucket_id,name));
          alter table storage.objects enable row level security;
          create function storage.foldername(name text) returns text[] language sql immutable as $$
            select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;

          create role anon; create role authenticated; create role service_role bypassrls;
          create table auth.users(id uuid primary key);
          create function auth.uid() returns uuid language sql stable as $$
            select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
          create function auth.role() returns text language sql stable as $$
            select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),nullif(current_setting('role',true),'none')) $$;
          grant usage on schema auth,public to anon,authenticated,service_role;
          grant execute on all functions in schema auth to anon,authenticated,service_role;
          grant usage on schema storage to anon,authenticated,service_role;
          grant select,insert,delete on storage.objects to anon,authenticated,service_role;
          grant execute on function storage.foldername(text) to anon,authenticated,service_role;
          create publication supabase_realtime;
        """)
        # A separate disposable database keeps conflicting preflight fixtures out of
        # the regression database. No production records are deleted or altered.
        sql("create database preflight_fixture template postgres")
        for path in sorted((ROOT / "supabase/migrations").glob("*.sql")):
            if path.name >= "20261005200000":
                break
            migration = path.read_text().replace('CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";', '-- Test-only Vault stub.')
            sql(migration, database="preflight_fixture")
        sql(f"""
          insert into auth.users values ('{uid(1)}');
          insert into public.profiles(id,nombre,email,posicion,nivel) values ('{uid(1)}','Fixture','fixture@example.test','Portero','Casual');
          insert into public.canchas(id,owner_id,nombre,direccion,zona) values ('{uid(200)}','{uid(1)}','Fixture','Fixture','Centro');
          insert into public.reservas(id,cancha_id,jugador_id,fecha,hora_inicio,hora_fin,precio,referencia) values
            ('{uid(201)}','{uid(200)}','{uid(1)}','2099-10-05','09:00','10:00',50000,'DUPLICATE'),
            ('{uid(202)}','{uid(200)}','{uid(1)}','2099-10-05','09:30','10:30',50000,'DUPLICATE'),
            ('{uid(203)}','{uid(200)}','{uid(1)}','2099-10-05','12:00','11:00',50000,'INVALID');
          insert into public.cancha_disponibilidad(cancha_id,dia_semana,hora_apertura,hora_cierre,duracion_min,precio)
            values ('{uid(200)}',1,'10:00','09:00',0,-1);
        """, database="preflight_fixture")
        preflight = (ROOT / "scripts/preflight-fiabilidad.sql").read_text()
        output = sql(preflight, database="preflight_fixture").stdout.strip()
        rows = [row.split("|",2) for row in output.splitlines()]
        assert len(rows)==4 and all(row[1]=='1' for row in rows), output
        assert uid(201) in output and uid(203) in output
        assert sql(preflight, database="preflight_fixture").stdout.strip()==output
        sql("begin read only; update public.reservas set precio=0;", database="preflight_fixture",ok=False)
        print("PASS idempotent read-only preflight with intentional conflicts:\n"+output,flush=True)
        sql(f"""insert into public.reservas(id,cancha_id,jugador_id,fecha,hora_inicio,hora_fin,precio,comision,estado,medio,referencia)
          values ('{uid(204)}','{uid(200)}','{uid(1)}','2099-10-06','09:00','10:00',50000,5000,'confirmada','online','LEGACY-ATTACK');
          update public.reservas set precio=0 where id='{uid(204)}';
          update public.reservas set comision=0 where id='{uid(204)}';""",user=uid(1),database="preflight_fixture")
        assert scalar(f"select estado||'|'||precio||'|'||comision from public.reservas where id='{uid(204)}'",database="preflight_fixture")=="confirmada|0|0"
        print("PASS isolated pre-migration reproduction: forged online confirmation, price and commission",flush=True)

        for path in sorted((ROOT / "supabase/migrations").glob("*.sql")):
            migration = path.read_text().replace('CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";', '-- Unused Vault extension unavailable in vanilla PostgreSQL test image.')
            sql(migration)
        print("PASS all application migrations on PostgreSQL 17", flush=True)
        for n in range(1, 54):
            sql(f"insert into auth.users values ('{uid(n)}'); insert into public.profiles(id,nombre,email,posicion,nivel,roles) values ('{uid(n)}','Jugador {n}','j{n}@example.test','Portero','Casual',ARRAY['{'admin' if n == 53 else 'jugador'}']);")

        def partido(n, capacidad=10):
            sql(f"insert into public.partidos(id,organizador_id,cancha,zona,fecha,hora,formato,nivel,precio,cupos_totales) values ('{uid(100+n)}','{uid(1)}','Cancha','Centro','2099-10-05','20:00','5v5','Casual',10000,{capacidad});")
            return uid(100+n)

        def enroll(p, n, medio="efectivo", ref=None, ok=True):
            return sql(f"select public.inscribirse_partido('{p}','{medio}','{ref or 'TEST-'+uuid.uuid4().hex}');", user=uid(n), ok=ok)

        def capacity():
            p = partido(1, 4)
            # Return failures as data, so we can assert exactly three successful seats.
            def attempt(n):
                try:
                    enroll(p, n)
                    return True
                except AssertionError as error:
                    assert "lleno" in str(error), error
                    return False
            outcomes = parallel([lambda n=n: attempt(n) for n in range(2,34)])
            assert sum(outcomes) == 3, outcomes
            assert scalar(f"select cupos_ocupados from public.partidos where id='{p}'") == "4"
            assert scalar(f"select count(*) from public.pagos where partido_id='{p}'") == "3"
        check("32 concurrent enrollments: 3 free places, 3 payments, no overselling", capacity)

        def retries():
            p = partido(2)
            results = parallel([lambda: enroll(p,2) for _ in range(12)])
            pagos = [json.loads(r.stdout)["pago"] for r in results]
            assert len({pago["id"] for pago in pagos}) == 1
            assert pagos[0]["monto"] == 10000 and pagos[0]["comision"] == 0
            assert scalar(f"select cupos_ocupados from public.partidos where id='{p}'") == "2"
        check("12 simultaneous retries return the same cash receipt", retries)

        def rollback():
            p = partido(3)
            other = partido(4)
            enroll(other,2,ref="SAME-REFERENCE")
            result = enroll(p,3,ref="SAME-REFERENCE",ok=False)
            assert "unique" in result.stderr or "duplic" in result.stderr
            assert scalar(f"select cupos_ocupados from public.partidos where id='{p}'") == "1"
            assert scalar(f"select count(*) from public.partido_jugadores where partido_id='{p}'") == "0"
        check("failed payment insert rolls back inscription and seat", rollback)

        cancha = uid(200)
        sql(f"insert into public.canchas(id,owner_id,nombre,direccion,zona) values ('{cancha}','{uid(1)}','Cancha','Dirección','Centro'); insert into public.cancha_disponibilidad(cancha_id,dia_semana,hora_apertura,hora_cierre,duracion_min,precio) values ('{cancha}',extract(dow from date '2099-10-05'),'08:00','23:00',60,50000);")

        def reserve(n, start="09:00", end="10:00", medio="efectivo", ok=True):
            return sql(f"insert into public.reservas(cancha_id,jugador_id,fecha,hora_inicio,hora_fin,precio,comision,estado,medio,referencia) values ('{cancha}','{uid(n)}','2099-10-05','{start}','{end}',1,0,'{"pendiente" if medio == "online" else "confirmada"}','{medio}','RES-{uuid.uuid4().hex}') returning id,precio,comision,estado;", user=uid(n), ok=ok)

        def reservations():
            first = reserve(2)
            rid = first.stdout.strip().split('|')[0]
            assert first.stdout.strip().endswith("50000|0|confirmada"), first.stdout
            reserve(3,ok=False)
            # Even trusted/backend writes cannot overlap the reserved interval.
            sql(f"insert into public.reservas(cancha_id,jugador_id,fecha,hora_inicio,hora_fin,precio,referencia) values ('{cancha}','{uid(3)}','2099-10-05','09:30','10:30',50000,'OVERLAP')",ok=False)
            sql(f"update public.reservas set estado='cancelada' where id='{rid}'",user=uid(2))
            reserve(3)
            hours = scalar(f"select * from public.horarios_ocupados('{cancha}','2099-10-05')",user=uid(4))
            assert "09:00:00|10:00:00" in hours
            assert scalar("select count(*) from public.reservas",user=uid(4)) == "0"
        check("server prices, overlap prevention, rebooking cancelled slots, public occupancy without PII", reservations)

        def availability():
            bad = '[{"dia_semana":1,"hora_apertura":"08:00","hora_cierre":"20:00","duracion_min":0,"precio":10}]'
            sql(f"select public.reemplazar_disponibilidad('{cancha}','{bad}')",user=uid(1),ok=False)
            assert scalar(f"select count(*) from public.cancha_disponibilidad where cancha_id='{cancha}'") == "1"
        check("invalid schedule replacement preserves existing schedule", availability)

        def withdrawals():
            sql(f"insert into public.movimientos_cancha(cancha_id,tipo,monto) values ('{cancha}','ajuste',10000)")
            def attempt():
                try:
                    sql(f"insert into public.retiros(cancha_id,monto) values ('{cancha}',7000)",user=uid(1))
                    return True
                except AssertionError as error:
                    assert 'saldo' in str(error), error
                    return False
            outcomes = parallel([attempt for _ in range(8)])
            assert sum(outcomes) == 1, outcomes
            assert scalar(f"select public.saldo_cancha('{cancha}')",user=uid(1)) == "3000"
            rid = scalar(f"select id from public.retiros where cancha_id='{cancha}'")
            sql(f"select public.admin_procesar_retiro('{rid}','pagado')",user=uid(53))
            assert scalar(f"select public.saldo_cancha('{cancha}')",user=uid(1)) == "3000"
            sql(f"select public.admin_procesar_retiro('{rid}','pagado')",user=uid(53),ok=False)
        check("8 concurrent withdrawals cannot overspend; processing is idempotent", withdrawals)

        def webhook():
            p = partido(5)
            pago = json.loads(enroll(p,2,"online","ONLINE-REFERENCE").stdout)["pago"]
            assert pago['monto'] == 10800
            for amount,currency in [(10000,"COP"),(10800,"USD")]:
                sql(f"select public.confirmar_pago_online('ONLINE-REFERENCE',{amount},'{currency}')",user=uid(2),role='service_role',ok=False)
            sql("select public.confirmar_pago_online('ONLINE-REFERENCE',10800,'COP')",user=uid(2),ok=False)
            parallel([lambda: sql("select public.confirmar_pago_online('ONLINE-REFERENCE',10800,'COP')",user=uid(2),role='service_role') for _ in range(8)])
            assert scalar(f"select confirmado from public.partido_jugadores where partido_id='{p}'") == 't'
            assert scalar(f"select cupos_ocupados from public.partidos where id='{p}'") == '2'
            reserve(4,'11:00','12:00','online')
            rref = scalar(f"select referencia from public.reservas where hora_inicio='11:00' and cancha_id='{cancha}'")
            parallel([lambda: sql(f"select public.confirmar_pago_online('{rref}',50000,'COP')",user=uid(2),role='service_role') for _ in range(8)])
            assert scalar(f"select count(*) from public.movimientos_cancha where reserva_id=(select id from public.reservas where referencia='{rref}')") == '2'
            assert scalar(f"select sum(monto) from public.movimientos_cancha where reserva_id=(select id from public.reservas where referencia='{rref}')") == '45000'
            sql(f"update public.reservas set estado='confirmada' where referencia='{rref}'",user=uid(4),ok=False)
        check("parallel webhooks verify amount/currency, confirm membership, book ledger exactly once", webhook)

        def negative_security():
            # Exact production-reported attacks, now with authenticated JWT GUCs.
            forged=f"insert into public.reservas(cancha_id,jugador_id,fecha,hora_inicio,hora_fin,precio,comision,estado,medio,referencia) values ('{cancha}','{uid(2)}','2099-10-05','13:00','14:00',0,0,'confirmada','online','FORGED-ONLINE')"
            result=sql(forged,user=uid(2),ok=False)
            assert 'sólo lo confirma' in result.stderr
            rid=reserve(2,'13:00','14:00','online').stdout.strip().split('|')[0]
            for column in ['precio','comision']:
                result=sql(f"update public.reservas set {column}=0 where id='{rid}'",user=uid(2),ok=False)
                assert 'permission denied' in result.stderr
            sql(f"update public.reservas set estado='confirmada' where id='{rid}'",user=uid(2),ok=False)
            assert scalar(f"select precio||'|'||comision||'|'||estado from public.reservas where id='{rid}'")=='50000|5000|pendiente'
            sql(f"update public.profiles set roles=ARRAY['admin','jugador'] where id='{uid(2)}'",user=uid(2),ok=False)
            pid=scalar(f"select id from public.pagos where jugador_id='{uid(2)}' limit 1")
            sql(f"update public.pagos set estado='aprobado' where id='{pid}'",user=uid(2),ok=False)
            sql(f"select public.admin_procesar_retiro((select id from public.retiros limit 1),'pagado')",user=uid(2),ok=False)
            # Own withdrawal too: neither the owner nor an unrelated player can approve it.
            sql(f"update public.retiros set estado='pagado' where cancha_id='{cancha}'",user=uid(1),ok=False)
            sql(f"insert into public.canchas(owner_id,nombre,direccion,zona) values ('{uid(1)}','Fake','Fake','Centro')",user=uid(2),ok=False)
            sql(f"update public.canchas set owner_id='{uid(2)}' where id='{cancha}'",user=uid(1),ok=False)
            # RLS SELECT correctly filters to zero rows; PostgreSQL need not raise.
            assert scalar(f"select count(*) from public.reservas where id='{rid}'",user=uid(3))=='0'
            assert scalar(f"select count(*) from public.reservas where id='{rid}'",user=uid(1))=='1'
            assert scalar(f"select owner_id from public.canchas where id='{cancha}'")==uid(1)
            assert scalar(f"select 'admin'=any(roles) from public.profiles where id='{uid(2)}'")=='f'
        check("authenticated attacks cannot forge confirmation/prices/commission/admin/payment/withdrawal/owner or read another reservation",negative_security)


        def chat_access():
            p = uid(102)
            query = f"insert into public.mensajes(partido_id,autor_id,autor_nombre,texto) values ('{p}','{uid(4)}','Jugador','Hola')"
            sql(query,user=uid(4),ok=False)
            sql(f"insert into public.mensajes(partido_id,autor_id,autor_nombre,texto) values ('{p}','{uid(2)}','Jugador','Hola')",user=uid(2))
        check("non-members cannot write to match chats", chat_access)

        def feed():
            sql(f"insert into public.posts(autor_id,autor_nombre,tipo,texto,created_at) select '{uid(1)}','Jugador','pregunta','Post '||n,'2026-10-05T20:00:00Z' from generate_series(1,65) n")
            first = json.loads(scalar("select public.feed_posts(p_limite=>30)",user=uid(2)))
            assert len(first) == 30
            last = first[-1]
            second = json.loads(scalar(f"select public.feed_posts('{last['created_at']}','{last['id']}',30)",user=uid(2)))
            assert len(second) == 30
            assert not {p['id'] for p in first} & {p['id'] for p in second}
            post = first[0]['id']
            sql(f"insert into public.post_likes(post_id,user_id) values ('{post}','{uid(2)}')",user=uid(2))
            sql(f"insert into public.comentarios(post_id,autor_id,autor_nombre,texto) values ('{post}','{uid(3)}','Jugador','Hola')",user=uid(3))
            detail = json.loads(scalar(f"select public.feed_posts(p_post=>'{post}')",user=uid(2)))[0]
            assert detail['like_count'] == 1 and detail['comment_count'] == 1 and detail['likes'] == [uid(2)]
            guest = json.loads(scalar(f"select public.feed_posts(p_post=>'{post}')",user='',role='anon'))[0]
            assert guest['like_count'] == 1 and guest['likes'] == []
        check("feed pagination with tied timestamps and correct aggregate counts", feed)
        def counters():
            post = scalar("select id from public.posts order by id limit 1")
            parallel([lambda n=n: sql(f"select public.set_post_like('{post}',true)",user=uid(n)) for n in range(4,20)])
            parallel([lambda: sql(f"select public.set_post_like('{post}',true)",user=uid(4)) for _ in range(8)])
            assert scalar(f"select like_count from public.posts where id='{post}'") == scalar(f"select count(*) from public.post_likes where post_id='{post}'")
            sql(f"select public.set_post_like('{post}',false)",user=uid(4))
            sql(f"update public.posts set like_count=999 where id='{post}'",user=uid(1),ok=False)
            assert scalar(f"select like_count from public.posts where id='{post}'") == scalar(f"select count(*) from public.post_likes where post_id='{post}'")
            sql(f"insert into public.comentarios(post_id,autor_id,autor_nombre,texto) values ('{post}','{uid(3)}','Jugador','Segundo')",user=uid(3))
            sql(f"delete from public.comentarios where post_id='{post}'")
            assert scalar(f"select comment_count from public.posts where id='{post}'") == '0'
        check("parallel reactions maintain accurate protected counters", counters)

        def admin_totals():
            metrics=json.loads(scalar("select public.admin_metricas()",user=uid(53)))
            assert metrics['usuarios'] == 53 and metrics['canchas'] == 1
            assert metrics['gmv'] == 10800 and metrics['pagosAprobados'] == 1
            sql("select public.admin_metricas()",user=uid(2),ok=False)
            sql(f"insert into public.calificaciones(partido_id,autor_id,estrellas,organizador_estrellas,hubo_no_show,comentario) values ('{uid(102)}','{uid(2)}',5,5,false,'Antes de jugar')",user=uid(2),ok=False)
        check("exact admin aggregates are private and premature ratings are rejected", admin_totals)
        def media_policies():
            sql(f"insert into storage.objects(bucket_id,name,owner_id) values ('media','{uid(2)}/own.jpg','{uid(2)}')",user=uid(2))
            sql(f"insert into storage.objects(bucket_id,name,owner_id) values ('media','{uid(3)}/fake.jpg','{uid(2)}')",user=uid(2),ok=False)
            sql(f"delete from storage.objects where name='{uid(2)}/own.jpg'",user=uid(3))
            assert scalar("select count(*) from storage.objects") == '1'
            sql(f"select public.archivos_usuario('{uid(2)}')",user=uid(2),ok=False)
            assert scalar(f"select count(*) from public.archivos_usuario('{uid(2)}')",user=uid(2),role='service_role') == '1'
            assert scalar(f"select count(*) from public.archivos_usuario('{uid(3)}')",user=uid(3),role='service_role') == '0'
            sql(f"delete from storage.objects where name='{uid(2)}/own.jpg'",user=uid(2))
            assert scalar("select count(*) from storage.objects") == '0'
        check("Storage ownership policies and private deletion inventory", media_policies)
        def complete_moderation():
            p=partido(9)
            enroll(p,2)
            sql(f"insert into storage.objects(bucket_id,name,owner_id) values ('media','{uid(1)}/reported.jpg','{uid(1)}'),('media','{uid(4)}/unrelated.jpg','{uid(4)}'); update public.partidos set foto_url='https://example.test/storage/v1/object/public/media/{uid(1)}/reported.jpg' where id='{p}'")
            sql(f"insert into public.reportes(tipo,contenido_id,autor_id,reportado_por,motivo,texto,foto_url) values ('partido','{p}','{uid(4)}','{uid(3)}','sexual','Fake text','https://evil.test/fake.jpg')",user=uid(3))
            report=scalar(f"select id from public.reportes where contenido_id='{p}'")
            assert scalar(f"select autor_id from public.reportes where id='{report}'")==uid(1)
            assert scalar(f"select foto_url from public.reportes where id='{report}'")==f'https://example.test/storage/v1/object/public/media/{uid(1)}/reported.jpg'
            sql(f"select public.archivos_reporte('{report}')",user=uid(53),ok=False)
            assert scalar(f"select count(*) from public.archivos_reporte('{report}')",user=uid(53),role='service_role')=='1'
            sql(f"select public.admin_resolver_reporte('{report}','resuelto',true)",user=uid(3),ok=False)
            sql(f"select public.admin_resolver_reporte('{report}','resuelto',true)",user=uid(53))
            assert scalar(f"select count(*) from public.partidos where id='{p}'",user='',role='anon')=='0'
            assert scalar(f"select count(*) from public.partidos where id='{p}'",user=uid(2))=='1'
            assert scalar(f"select count(*) from public.pagos where partido_id='{p}'")=='1'
            sql(f"select public.inscribirse_partido('{p}','efectivo','HIDDEN-REF')",user=uid(4),ok=False)
            sql(f"update public.partidos set oculto=false where id='{p}'",user=uid(1),ok=False)
            sql(f"insert into public.reportes(tipo,contenido_id,autor_id,reportado_por,motivo,texto) values ('perfil','{uid(4)}','{uid(1)}','{uid(3)}','acoso','Fake')",user=uid(3))
            profile_report=scalar(f"select id from public.reportes where tipo='perfil' and contenido_id='{uid(4)}'")
            sql(f"select public.admin_resolver_reporte('{profile_report}','resuelto',true)",user=uid(53))
            assert scalar(f"select suspendido from public.profiles where id='{uid(4)}'")=='t'
            court=uid(200)
            sql(f"insert into public.reportes(tipo,contenido_id,autor_id,reportado_por,motivo,texto) values ('cancha','{court}','{uid(4)}','{uid(3)}','sexual','Fake')",user=uid(3))
            court_report=scalar(f"select id from public.reportes where tipo='cancha' and contenido_id='{court}'")
            sql(f"select public.admin_resolver_reporte('{court_report}','resuelto',true)",user=uid(53))
            assert scalar(f"select count(*) from public.canchas where id='{court}'",user='',role='anon')=='0'
            sql(f"update public.canchas set oculto=false where id='{court}'",user=uid(1),ok=False)
        check("Reports derive actual author; moderation hides matches/courts without deleting payments and suspends profiles", complete_moderation)

        def expiry_and_late_confirmation():
            p=partido(20,2)
            old=json.loads(enroll(p,2,'online','EXPIRY-OLD').stdout)['pago']
            sql(f"update public.pagos set caduca_at=now()-interval '1 minute' where id='{old['id']}'")
            sql("select public.caducar_pagos_pendientes()",user=uid(2),ok=False)
            sql("select public.caducar_pagos_pendientes()",user=uid(2),role='service_role')
            assert scalar(f"select estado from public.pagos where id='{old['id']}'")=='caducado'
            assert scalar(f"select cupos_ocupados from public.partidos where id='{p}'")=='1'
            enroll(p,3,'efectivo','EXPIRY-NEW')
            parallel([lambda:sql("select public.confirmar_pago_online('EXPIRY-OLD',10800,'COP','provider-old')",user=uid(2),role='service_role') for _ in range(6)])
            assert scalar(f"select cupos_ocupados from public.partidos where id='{p}'")=='2'
            assert scalar(f"select count(*) from public.partido_jugadores where partido_id='{p}' and jugador_id='{uid(2)}'")=='0'
            assert scalar("select count(*) from public.conciliaciones_pago where referencia='EXPIRY-OLD'")=='1'
            assert scalar("select estado from public.pagos where referencia='EXPIRY-OLD'")=='reembolso_pendiente'
            # Race at an already elapsed deadline must always queue a refund,
            # regardless of which transaction acquires the match lock first.
            race=partido(21,2)
            payment=json.loads(enroll(race,2,'online','EXPIRY-RACE').stdout)['pago']
            sql(f"update public.pagos set caduca_at=now()-interval '1 minute' where id='{payment['id']}'")
            parallel([lambda:sql("select public.caducar_pagos_pendientes()",user=uid(2),role='service_role'),lambda:sql("select public.confirmar_pago_online('EXPIRY-RACE',10800,'COP','provider-race')",user=uid(2),role='service_role')])
            assert scalar(f"select cupos_ocupados from public.partidos where id='{race}'")=='1'
            assert scalar("select estado from public.pagos where referencia='EXPIRY-RACE'")=='reembolso_pendiente'
            court=uid(300)
            sql(f"insert into public.canchas(id,owner_id,nombre,direccion,zona) values ('{court}','{uid(1)}','Expiry','Fixture','Centro'); insert into public.cancha_disponibilidad(cancha_id,dia_semana,hora_apertura,hora_cierre,duracion_min,precio) values ('{court}',extract(dow from date '2099-10-05'),'08:00','23:00',60,50000)")
            rid=scalar(f"insert into public.reservas(cancha_id,jugador_id,fecha,hora_inicio,hora_fin,precio,medio,referencia) values ('{court}','{uid(2)}','2099-10-05','09:00','10:00',50000,'online','RES-EXPIRY') returning id",user=uid(2))
            sql(f"update public.reservas set caduca_at=now()-interval '1 minute' where id='{rid}'")
            parallel([lambda:sql("select public.caducar_pagos_pendientes()",user=uid(2),role='service_role'),lambda:sql("select public.confirmar_pago_online('RES-EXPIRY',50000,'COP','provider-res')",user=uid(2),role='service_role')])
            assert scalar(f"select estado||'|'||estado_pago from public.reservas where id='{rid}'")=='cancelada|reembolso_pendiente'
            assert scalar(f"select count(*) from public.movimientos_cancha where reserva_id='{rid}'")=='0'
            sql(f"insert into public.reservas(cancha_id,jugador_id,fecha,hora_inicio,hora_fin,precio,medio,estado,referencia) values ('{court}','{uid(3)}','2099-10-05','09:00','10:00',50000,'efectivo','confirmada','RES-AFTER-EXPIRY')",user=uid(3))
            # Independent refund consumers cannot claim the same debt.
            claims=parallel([lambda:sql("select public.tomar_reembolso()",user=uid(2),role='service_role') for _ in range(6)])
            jobs=[json.loads(r.stdout) for r in claims if r.stdout.strip()]
            assert len(jobs)==3 and len({j['id'] for j in jobs})==3
            for j in jobs:
                sql(f"select public.registrar_reembolso('{j['id']}','{uid(999)}','reembolsado','fake')",user=uid(2),role='service_role',ok=False)
                sql(f"select public.registrar_reembolso('{j['id']}','{j['lease_token']}','reembolsado','refund-{j['id']}')",user=uid(2),role='service_role')
            assert scalar("select estado_pago from public.reservas where referencia='RES-EXPIRY'")=='reembolsado'
            assert scalar("select estado from public.pagos where referencia='EXPIRY-OLD'")=='reembolsado'
            assert int(scalar("select count(*) from public.ejecuciones_caducidad"))>=3
            assert scalar("select count(*) from public.conciliaciones_pago",user=uid(2))=='0'
            assert scalar("select count(*) from public.conciliaciones_pago",user=uid(53))=='3'
        check("expiry/late-webhook race frees seats and slots, queues refunds once, leases debt and preserves exact ledger",expiry_and_late_confirmation)

        def atomic_establishment_and_reservation():
            data={'direccion':'Fixture','zona':'Centro','ciudad':'Pereira','amenidades':{},'legal_version':'2026-07-07','canchas':[{'nombre':'Atomic One','formato':'5v5','precio':50000,'duracion':60,'fotos':[]},{'nombre':'Atomic Two','formato':'7v7','precio':70000,'duracion':60,'fotos':[]}],'horarios':[{'dia_semana':int(scalar("select extract(dow from date '2099-10-05')")),'hora_apertura':'08:00','hora_cierre':'23:00'}]}
            call=f"select public.crear_establecimiento('ATOMIC-ESTABLISHMENT','{json.dumps(data)}'::jsonb)"
            results=parallel([lambda:sql(call,user=uid(3)) for _ in range(6)])
            courts=[json.loads(r.stdout) for r in results]
            assert all(courts[0]==c for c in courts) and len(courts[0])==2
            assert scalar(f"select count(*) from public.canchas where owner_id='{uid(3)}'")=='2'
            assert scalar(f"select 'cancha'=any(roles) from public.profiles where id='{uid(3)}'")=='t'
            changed=json.loads(json.dumps(data));changed['canchas'][1]['duracion']=0
            sql(f"select public.crear_establecimiento('ATOMIC-FAIL','{json.dumps(changed)}')",user=uid(3),ok=False)
            assert scalar(f"select count(*) from public.canchas where owner_id='{uid(3)}'")=='2'
            assert scalar("select count(*) from public.operaciones_idempotentes where referencia='ATOMIC-FAIL'")=='0'
            sql(f"select public.crear_establecimiento('ATOMIC-ESTABLISHMENT','{json.dumps(changed)}')",user=uid(3),ok=False)
            court=courts[0][0]['id']
            def book(ref,start='09:00',end='10:00',medio='efectivo'):
                return f"select public.reservar_con_partido('{ref}','{court}','2099-10-05','{start}','{end}','{medio}','{{\"formato\":\"5v5\",\"nivel\":\"Casual\"}}')"
            receipts=parallel([lambda:sql(book('ATOMIC-BOOK'),user=uid(2)) for _ in range(6)])
            rows=[json.loads(r.stdout) for r in receipts]
            assert all(rows[0]['id']==r['id'] and rows[0]['partido_id']==r['partido_id'] for r in rows)
            assert rows[0]['precio']==50000 and rows[0]['partido_id']
            assert scalar(f"select precio from public.partidos where id='{rows[0]['partido_id']}'")=='5000'
            sql(book('ATOMIC-BOOK','10:00','11:00'),user=uid(2),ok=False)
            sql(book('ATOMIC-BOOK'),user=uid(5),ok=False) # cannot take another caller's receipt
            # Failure in party insertion rolls the preceding reservation and journal back.
            sql("""create function public.test_fail_party() returns trigger language plpgsql as $$begin if new.cancha='Atomic One' then raise exception 'test intermediate failure'; end if; return new; end$$;
              create trigger zz_test_fail_party before insert on public.partidos for each row execute function public.test_fail_party();""")
            sql(book('ATOMIC-BOOK-FAIL','11:00','12:00'),user=uid(2),ok=False)
            assert scalar("select count(*) from public.reservas where referencia='ATOMIC-BOOK-FAIL'")=='0'
            assert scalar("select count(*) from public.operaciones_idempotentes where referencia='ATOMIC-BOOK-FAIL'")=='0'
            sql("drop trigger zz_test_fail_party on public.partidos; drop function public.test_fail_party()")
            recovered=json.loads(scalar(book('ATOMIC-BOOK-FAIL','11:00','12:00'),user=uid(2)))
            assert recovered['partido_id']
            pending=json.loads(scalar(book('ATOMIC-ONLINE','13:00','14:00','online'),user=uid(2)))
            assert pending['estado']=='pendiente' and pending['partido_id'] is None
            parallel([lambda:sql("select public.confirmar_pago_online('ATOMIC-ONLINE',50000,'COP','provider-atomic')",user=uid(2),role='service_role') for _ in range(4)])
            confirmed=json.loads(scalar(book('ATOMIC-ONLINE','13:00','14:00','online'),user=uid(2)))
            assert confirmed['id']==pending['id'] and confirmed['estado']=='confirmada' and confirmed['partido_id']
            assert scalar(f"select count(*) from public.partidos where id='{confirmed['partido_id']}'")=='1'
            assert scalar(f"select count(*) from public.movimientos_cancha where reserva_id='{confirmed['id']}'")=='2'
            sql(f"update public.reservas set partido_id='{rows[0]['partido_id']}' where id='{recovered['id']}'",user=uid(2),ok=False)
        check("atomic establishment and reservation-party retry/failure rollback; online publication waits for actual confirmation",atomic_establishment_and_reservation)

        def paginated_histories_and_plans():
            # 20,000 rows and many equal timestamps, not an empty EXPLAIN fixture.
            p=partido(30)
            sql(f"insert into public.pagos(partido_id,jugador_id,medio,monto,comision,estado,referencia,created_at) select '{p}',case when n<=1200 then '{uid(50)}'::uuid else '{uid(6)}'::uuid end,'efectivo',10000,0,'pendiente','HISTORY-'||n,'2026-10-01T12:00:00Z'::timestamptz+(n/10)*interval '1 second' from generate_series(1,20000) n; analyze public.pagos;")
            seen=set();cursor=None;pages=0
            while True:
                params=f"p_tipo=>'pagos',p_limite=>100"+(f",p_antes=>'{cursor['fecha']}',p_antes_id=>'{cursor['id']}'" if cursor else '')
                result=json.loads(scalar(f"select public.historial_paginado({params})",user=uid(50)))
                ids={r['id'] for r in result['filas']}
                assert not seen & ids and all(r['jugador_id']==uid(50) for r in result['filas'])
                seen|=ids;pages+=1
                if not result['hay_mas']: break
                cursor=result['cursor'];assert cursor
            assert len(seen)==1200 and pages==12
            first=json.loads(scalar("select public.historial_paginado('pagos',p_limite=>50)",user=uid(53)))
            assert first['filas']==[] # admin's 'propio' does not become a global list
            admin=json.loads(scalar("select public.historial_paginado('pagos','admin',p_limite=>100,p_estado=>'pendiente')",user=uid(53)))
            assert len(admin['filas'])==100 and admin['hay_mas']
            sql("select public.historial_paginado('pagos','admin')",user=uid(50),ok=False)
            sql("select public.historial_paginado('pagos',p_limite=>101)",user=uid(50),ok=False)
            sql(f"select public.historial_paginado('pagos',p_antes_id=>'{uid(1)}')",user=uid(50),ok=False)
            sql("select public.historial_paginado('pagos; drop table pagos')",user=uid(50),ok=False)
            sql(f"select public.historial_paginado('reservas','cancha','{uid(300)}')",user=uid(50),ok=False)
            assert json.loads(scalar(f"select public.historial_paginado('reservas','cancha','{uid(300)}')",user=uid(1)))['filas']
            users=json.loads(scalar("select public.historial_paginado('usuarios','admin',p_busqueda=>'Jugador 5')",user=uid(53)))
            assert users['filas'] and all('Jugador 5' in r['nombre'] for r in users['filas'])
            # RLS-aware plans of the actual RPC queries, including a deep cursor.
            pivot=scalar(f"select created_at||'|'||id from public.pagos where jugador_id='{uid(50)}' order by created_at desc,id desc offset 900 limit 1").split('|')
            queries={
              'private_first':f"select * from public.pagos where jugador_id='{uid(50)}' order by created_at desc,id desc limit 101",
              'private_deep':f"select * from public.pagos where jugador_id='{uid(50)}' and (created_at,id)<('{pivot[0]}','{pivot[1]}') order by created_at desc,id desc limit 101",
              'admin_state':"select * from public.pagos where estado='pendiente' order by created_at desc,id desc limit 101"
            }
            plans=[]
            for label,query in queries.items():
                owner=uid(53) if label=='admin_state' else uid(50)
                raw=scalar('explain (analyze,buffers,format json) '+query,user=owner)
                plan=json.loads(raw)[0]
                def nodes(node):
                    return [node]+[n for child in node.get('Plans',[]) for n in nodes(child)]
                assert any('Index' in node['Node Type'] for node in nodes(plan['Plan'])),raw
                plans.append('### '+label+'\n\n```json\n'+json.dumps(plan,indent=2)+'\n```\n')
            metrics=json.loads(scalar("select public.admin_metricas()",user=uid(53)))
            assert metrics['usuarios']==int(scalar('select count(*) from public.profiles'))
            assert metrics['gmv']==int(scalar("select coalesce(sum(monto),0) from public.pagos where estado='aprobado'"))
            # Large ledger saldo stays exact irrespective of API page size.
            sql(f"insert into public.movimientos_cancha(cancha_id,tipo,monto) select '{uid(300)}','ajuste',1 from generate_series(1,2000); analyze public.movimientos_cancha")
            expected=int(scalar(f"select sum(monto) from public.movimientos_cancha where cancha_id='{uid(300)}'"))
            assert int(scalar(f"select public.saldo_cancha('{uid(300)}')",user=uid(1)))==expected
            ledger=json.loads(scalar(f"select public.historial_paginado('movimientos','cancha','{uid(300)}',p_limite=>50)",user=uid(1)))
            assert len(ledger['filas'])==50 and ledger['hay_mas']
            ledger_query=f"select * from public.movimientos_cancha where cancha_id='{uid(300)}' order by created_at desc,id desc limit 51"
            raw=scalar('explain (analyze,buffers,format json) '+ledger_query,user=uid(1));plans.append('### court_ledger\n\n```json\n'+json.dumps(json.loads(raw)[0],indent=2)+'\n```\n')
            output=ROOT/'docs/auditoria/planes-historiales-2026-10-06.md'
            output.write_text('# EXPLAIN ANALYZE de historiales\n\nPostgreSQL 17 aislado, 20.000 pagos (1.200 del usuario de pruebas),\n2.000 movimientos nuevos, RLS authenticated/JWT simulado activa.\nConsultas con los filtros/orden/cursor ejecutados por historial_paginado.\nTiempos locales: no constituyen SLA de producción. Regenerado por tests/database.py.\n\n'+ '\n'.join(plans))
        check("keyset private/admin/owner histories exceed 1000 rows, reject invalid access and use indexed EXPLAIN on representative data",paginated_histories_and_plans)
        print("All database regression groups passed", flush=True)
    finally:
        subprocess.run(["docker", "stop", CONTAINER], capture_output=True, check=False)


if __name__ == '__main__':
    main()
