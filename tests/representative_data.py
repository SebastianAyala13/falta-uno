import importlib.util,json,subprocess
from postgres_fixture import Postgres,ROOT
spec=importlib.util.spec_from_file_location('generator',ROOT/'scripts/db/generate_fixture.py');g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
with Postgres() as db:
    db.bootstrap();db.migrate()
    result=g.generate(db,courts=12,players=600,reservations=2400,matches=300,payments=12000,posts=1200)
    c=result['counts'];assert [c[k] for k in ['canchas','jugadores','reservas','partidos','pagos','posts']]==[12,600,2400,300,12000,1200]
    assert all(c[k]>0 for k in ['suspendidos','caducados','retiros_pendientes','reportes','turnos_08','turnos_23'])
    preflight=db.sql((ROOT/'scripts/preflight-fiabilidad.sql').read_text())
    assert all(row.split('|')[1]=='0' for row in preflight.splitlines())
    before=db.sql('select count(*) from public.reservas')
    try:g.generate(db,courts=12,players=600,reservations=2400,matches=300,payments=12000,posts=1200)
    except ValueError:pass
    else:raise AssertionError('Second generation should refuse existing data')
    assert db.sql('select count(*) from public.reservas')==before
    assert db.sql('select count(*) from public.posts where like_count<>1 or comment_count<>1')=='0'
    result['preflight_zero']=True;result['rejects_nonempty']=True;result['social_counters_exact']=True
    (ROOT/'docs/auditoria/datos-representativos-2026-10-06.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))
