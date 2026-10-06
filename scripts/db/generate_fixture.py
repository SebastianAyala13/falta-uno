#!/usr/bin/env python3
"""Parametrized fake data, ONLY labelled disposable Docker PostgreSQL fixtures."""
import argparse,json,pathlib,subprocess,sys,time
ROOT=pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tests'))
from postgres_fixture import Postgres

def generate(db,courts=40,players=1000,reservations=15000,matches=2000,payments=50000,posts=10000):
    if not (1<=courts<=1000 and courts+2<=players<=20000 and 1<=reservations<=1000000 and 1<=matches<=100000 and 1<=payments<=1000000 and 1<=posts<=100000): raise ValueError('Invalid scale: players must exceed courts by 2')
    label=subprocess.run(['docker','inspect','--format','{{index .Config.Labels "faltauno.isolated-test"}}',db.container],capture_output=True,text=True,check=True).stdout.strip()
    if label!='true': raise ValueError('Refusing a database not explicitly labelled isolated')
    if db.sql('select count(*) from public.profiles')!='0': raise ValueError('Fixture target is not empty; no rows will be deleted')
    start=time.perf_counter()
    q=f"""begin;
    insert into auth.users(id) select md5('fixture-user-'||n)::uuid from generate_series(1,{players}) n;
    insert into public.profiles(id,nombre,email,ciudad,posicion,nivel,roles,suspendido,created_at)
      select md5('fixture-user-'||n)::uuid,'Jugador fixture '||n,'fixture-'||n||'@example.test',case when n%2=0 then 'Pereira' else 'Dosquebradas' end,'Portero','Casual',
        case when n={players} then array['admin','jugador'] when n<={courts} then array['cancha','jugador'] else array['jugador'] end,n%17=0 and n<>{players},now()-(n%365)*interval '1 day' from generate_series(1,{players}) n;
    insert into public.canchas(id,owner_id,nombre,direccion,zona,ciudad,formatos,estado,oculto,created_at)
      select md5('fixture-court-'||n)::uuid,md5('fixture-user-'||n)::uuid,'Cancha fixture '||n,'Dirección ficticia '||n,'Centro','Pereira',array['5v5','7v7'],case when n%7=0 then 'pausada' else 'activa' end,n%13=0,now()-(n%365)*interval '1 day' from generate_series(1,{courts}) n;
    insert into public.cancha_disponibilidad(cancha_id,dia_semana,hora_apertura,hora_cierre,duracion_min,precio)
      select id,d,'08:00','23:00',60,50000 from public.canchas cross join generate_series(0,6) d;
    insert into public.reservas(id,cancha_id,jugador_id,fecha,hora_inicio,hora_fin,precio,comision,medio,estado,referencia,created_at)
      select md5('fixture-res-'||n)::uuid,md5('fixture-court-'||(((n-1)%{courts})+1))::uuid,md5('fixture-user-'||({courts}+1+((n-1)%({players}-{courts}-1))))::uuid,
        date '2026-10-06'-({reservations}/({courts}*30))+((n-1)/({courts}*15)),
        time '08:00'+(((n-1)/{courts})%15)*interval '1 hour',time '09:00'+(((n-1)/{courts})%15)*interval '1 hour',50000,case when n%3=0 then 5000 else 0 end,
        case when n%3=0 then 'online' else 'efectivo' end,case when n%9=0 then 'cancelada' when n%6=0 then 'pendiente' else 'confirmada' end,'FIXTURE-RES-'||n,now()-(n%8760)*interval '1 hour'
      from generate_series(1,{reservations}) n;
    update public.reservas set estado_pago=case estado when 'cancelada' then 'caducado' when 'pendiente' then 'pendiente' else 'confirmado' end,
      caduca_at=case when estado in ('cancelada','pendiente') then now()-interval '1 day' else created_at+interval '15 minutes' end where medio='online';
    insert into public.partidos(id,organizador_id,cancha,zona,fecha,hora,formato,nivel,precio,cupos_totales,created_at)
      select md5('fixture-match-'||n)::uuid,md5('fixture-user-'||(((n-1)%{courts})+1))::uuid,'Cancha fixture '||(((n-1)%{courts})+1),'Centro',date '2026-10-06'+(n%365)-180,'20:00','5v5','Casual',10000,10,now()-(n%8760)*interval '1 hour' from generate_series(1,{matches}) n;
    insert into public.partido_jugadores(partido_id,jugador_id,posicion,confirmado)
      select md5('fixture-match-'||n)::uuid,md5('fixture-user-'||({courts}+1+((n-1)%({players}-{courts}-1))))::uuid,'Portero',n%2=0 from generate_series(1,{matches}) n;
    insert into public.pagos(id,partido_id,jugador_id,medio,monto,comision,estado,referencia,created_at)
      select md5('fixture-pay-'||n)::uuid,md5('fixture-match-'||(((n-1)%{matches})+1))::uuid,
        md5('fixture-user-'||case when n<={payments}/4 then {courts}+1 else {courts}+1+((n-1)%({players}-{courts}-1)) end)::uuid,
        case when n%3=0 then 'online' else 'efectivo' end,case when n%3=0 then 10800 else 10000 end,case when n%3=0 then 800 else 0 end,
        case when n%9=0 then 'caducado' when n%3=0 and n%4=0 then 'aprobado' when n%5=0 then 'rechazado' else 'pendiente' end,'FIXTURE-PAY-'||n,now()-(n%8760)*interval '1 hour' from generate_series(1,{payments}) n;
    update public.pagos set caduca_at=now()-interval '1 day' where medio='online' and estado in ('caducado','pendiente');
    insert into public.movimientos_cancha(cancha_id,tipo,monto,descripcion) select id,'ajuste',1000000,'Saldo ficticio de prueba' from public.canchas;
    insert into public.movimientos_cancha(cancha_id,tipo,monto,reserva_id,descripcion) select cancha_id,'ingreso_reserva',precio,id,'Ingreso fixture' from public.reservas where medio='online' and estado='confirmada';
    insert into public.movimientos_cancha(cancha_id,tipo,monto,reserva_id,descripcion) select cancha_id,'comision',-comision,id,'Comisión fixture' from public.reservas where medio='online' and estado='confirmada';
    insert into public.retiros(cancha_id,monto,estado) select id,1000,'solicitado' from public.canchas;
    insert into public.posts(id,autor_id,autor_nombre,tipo,texto,created_at) select md5('fixture-post-'||n)::uuid,md5('fixture-user-'||(((n-1)%{players})+1))::uuid,'Autor fixture','pregunta','Contenido ficticio '||n,now()-(n%8760)*interval '1 hour' from generate_series(1,{posts}) n;
    insert into public.post_likes(post_id,user_id) select id,md5('fixture-user-1')::uuid from public.posts;
    insert into public.comentarios(post_id,autor_id,autor_nombre,texto) select id,md5('fixture-user-2')::uuid,'Fixture','Comentario de prueba' from public.posts;
    select set_config('request.jwt.claim.sub',md5('fixture-user-3')::uuid::text,true);
    select set_config('request.jwt.claim.role','service_role',true);
    insert into public.reportes(tipo,contenido_id,autor_id,reportado_por,motivo,texto)
      select 'post',id,autor_id,md5('fixture-user-3')::uuid,'acoso','Reporte ficticio' from public.posts order by id limit least(200,{posts});
    analyze;
    commit;"""
    db.sql(q)
    counts=json.loads(db.sql("select jsonb_build_object('canchas',(select count(*) from public.canchas),'jugadores',(select count(*) from public.profiles),'reservas',(select count(*) from public.reservas),'partidos',(select count(*) from public.partidos),'pagos',(select count(*) from public.pagos),'posts',(select count(*) from public.posts),'suspendidos',(select count(*) from public.profiles where suspendido),'caducados',(select count(*) from public.pagos where estado='caducado'),'retiros_pendientes',(select count(*) from public.retiros where estado='solicitado'),'reportes',(select count(*) from public.reportes),'turnos_08',(select count(*) from public.reservas where hora_inicio='08:00'),'turnos_23',(select count(*) from public.reservas where hora_fin='23:00'))"))
    return {'parameters':{'courts':courts,'players':players,'reservations':reservations,'matches':matches,'payments':payments,'posts':posts},'counts':counts,'seconds':round(time.perf_counter()-start,3),'anchor_date':'2026-10-06','fake_only':True}

def main():
    p=argparse.ArgumentParser();p.add_argument('--container',required=True)
    for key,default in [('courts',40),('players',1000),('reservations',15000),('matches',2000),('payments',50000),('posts',10000)]:p.add_argument('--'+key,type=int,default=default)
    a=p.parse_args();db=Postgres();db.container=a.container
    print(json.dumps(generate(db,**{k:getattr(a,k) for k in ['courts','players','reservations','matches','payments','posts']}),indent=2))
if __name__=='__main__':main()
