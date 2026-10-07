"""Exactly the first 17 migrations; isolated database only, no full/demo seed run."""
from postgres_fixture import Postgres,ROOT

def migrate17(db):
    files=[p for p in sorted((ROOT/'supabase/migrations').glob('*.sql')) if p.name<'20261006200000']
    assert len(files)==17,len(files)
    db.sql('create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key);')
    for p in files:
        db.sql(p.read_text().replace('CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";','-- isolated Vault stub'))
        db.sql("insert into supabase_migrations.schema_migrations values('"+p.name.split('_')[0]+"')")

def seed_targets(db):
    # UUIDs correspond to seed-demo: Juan (5), owner Andrés (1), court/reserve/party.
    # Only synthetic fields and ID-only Auth, no passwords or destructive seed SQL.
    db.sql("""insert into auth.users values('a0e00000-0000-4000-a000-000000000001'),('a0e00000-0000-4000-a000-000000000005');
    insert into public.profiles(id,nombre,email,posicion,nivel,roles) values
    ('a0e00000-0000-4000-a000-000000000001','Fixture owner','owner@example.test','Portero','Casual',array['jugador','cancha']),
    ('a0e00000-0000-4000-a000-000000000005','Fixture player','player@example.test','Portero','Casual',array['jugador']);
    insert into public.canchas(id,owner_id,nombre,direccion,zona) values('a0e00000-0000-4000-b000-000000000001','a0e00000-0000-4000-a000-000000000001','Fixture','Ficticia','Centro');
    insert into public.partidos(id,organizador_id,cancha,zona,fecha,hora,formato,nivel,precio,cupos_totales) values('a0e00000-0000-4000-c000-000000000004','a0e00000-0000-4000-a000-000000000001','Fixture','Centro',current_date+3,'19:00','5v5','Casual',100,10);
    insert into public.reservas(id,cancha_id,jugador_id,fecha,hora_inicio,hora_fin,precio,medio,estado,referencia) values('a0e00000-0000-4000-d000-000000000004','a0e00000-0000-4000-b000-000000000001','a0e00000-0000-4000-a000-000000000005',current_date+3,'19:00','20:00',100,'online','pendiente','FIXTURE-TANDA1');
    insert into public.pagos(partido_id,jugador_id,medio,monto,estado,referencia) values('a0e00000-0000-4000-c000-000000000004','a0e00000-0000-4000-a000-000000000005','efectivo',100,'pendiente','FIXTURE-PAY');""")
