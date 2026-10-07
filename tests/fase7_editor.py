"""Execute the guide's SQL blocks in order, with explicit cron/net/Vault doubles."""
import ast,json,re
from postgres_fixture import Postgres,ROOT
from tanda1_fixture import seed_targets

doc=(ROOT/'docs/auditoria/PASOS-FASE-7.md').read_text()
blocks=dict(re.findall(r'<!-- SQL: ([a-z_]+) -->\s*```sql\n(.*?)```',doc,re.S))
assert set(blocks)=={'requisitos','programar_conciliacion','programar_retencion','verificar_conciliacion','pausa'}
for name,sql in blocks.items():
    assert not any(line.lstrip().startswith('\\') for line in sql.splitlines()),name
for name in ['programar_conciliacion','programar_retencion','verificar_conciliacion']:
    source='\n'.join(line for line in (ROOT/f'scripts/db/{name}.sql').read_text().splitlines() if not line.startswith('\\set'))+'\n'
    assert blocks[name]==source,'Guide block differs from current SQL: '+name

tree=ast.parse((ROOT/'tests/scheduler_sql.py').read_text())
setup=next(n.args[0].value for n in ast.walk(tree) if isinstance(n,ast.Call) and isinstance(n.func,ast.Attribute) and n.func.attr=='sql' and n.args and isinstance(n.args[0],ast.Constant) and isinstance(n.args[0].value,str) and 'create schema cron;' in n.args[0].value)
checks={};cycles=[]
with Postgres() as db:
    db.bootstrap();db.migrate();seed_targets(db);db.sql(setup)
    db.sql("create view vault.secrets as select name from vault.decrypted_secrets;create function cron.alter_job(job_id bigint,active boolean) returns void language sql as $$update cron.job set active=$2 where jobid=$1$$;set cron.timezone='GMT';set cron.log_run='on';")
    db.sql("insert into vault.decrypted_secrets values ('faltauno_conciliacion_url','https://fixture.supabase.co/functions/v1/conciliar-pagos'),('faltauno_conciliacion_secret','EDITOR_FIXTURE_NOT_A_REAL_SECRET')")
    requirements=db.sql(blocks['requisitos'])
    checks['requirements_sql_editor_syntax']=all(name+'|true' in requirements for name in ['cron','pg_net','vault','novena'])
    # Per-session custom GUCs above do not persist into a new psql connection.
    # Only test-prescribed timezone/log settings in the isolated DB, not globals.
    timezone=db.sql("set cron.timezone='GMT';set cron.log_run='on';"+blocks['requisitos'])
    checks['timezone_and_logging_probe']='zona_cron|GMT' in timezone and 'historial_cron|on' in timezone
    db.sql(blocks['programar_conciliacion']);db.sql(blocks['programar_retencion'])
    checks['two_unique_active_jobs']=db.sql('select count(*) from cron.job where active')=='2'
    checks['no_http_or_purge_during_install']=db.sql('select count(*) from net.requests')=='0' and db.sql('select count(*) from public.ejecuciones_retencion')=='0'
    checks['daily_retention_schedule']=db.sql("select schedule from cron.job where jobname='faltauno-retencion'")=='15 8 * * *'
    db.sql(blocks['programar_conciliacion']);db.sql(blocks['programar_retencion'])
    checks['repeat_install_no_duplicate_jobs']=db.sql('select count(*) from cron.job')=='2'
    db.sql("set request.jwt.claim.role='service_role';update public.reservas set caduca_at=now()-interval '1 hour' where referencia='FIXTURE-TANDA1';")
    def verify():
        output=db.sql(blocks['verificar_conciliacion'])
        assert 'EDITOR_FIXTURE_NOT_A_REAL_SECRET' not in output and 'Authorization' not in output
        rows=dict((name,json.loads(value) if value else None) for name,value in (line.split('|',1) for line in output.splitlines()))
        assert sorted(rows)==['01_jobs','02_estado','03_ultimas_conciliaciones','04_historial_cron','05_devoluciones','06_ultima_retencion']
        assert rows['06_ultima_retencion'] is None
        return rows
    initial=verify();checks['single_result_six_rows_before_first_cycle']=initial['03_ultimas_conciliaciones']==[] and initial['04_historial_cron']==[]
    command=db.sql("select command from cron.job where jobname='faltauno-conciliacion'")
    for cycle in range(1,4):
        # Drive job SQL directly; this is not a live cron worker. HTTP responses
        # arrive after job commit and become visible to observer on next cycle.
        db.sql(command)
        db.sql("insert into cron.job_run_details select jobid,'succeeded',clock_timestamp(),clock_timestamp() from cron.job where jobname='faltauno-conciliacion'")
        rows=verify();states=[e['estado'] for e in rows['03_ultimas_conciliaciones']]
        assert states.count('encolada')==1 and states.count('ok')==cycle-1,states
        assert len(rows['04_historial_cron'])==cycle
        if cycle==1:assert rows['02_estado']['ultimo_ok'] is None
        else:
            assert rows['02_estado']['ultimo_ok'] and not rows['02_estado']['alarma']
            assert all(e['http_status']==200 and e['reembolso_estado']=='desactivados' for e in rows['03_ultimas_conciliaciones'] if e['estado']=='ok')
        cycles.append({'cycle':cycle,'encolada':states.count('encolada'),'ok':states.count('ok'),'cron_succeeded':len(rows['04_historial_cron']),'last_success_present':rows['02_estado']['ultimo_ok'] is not None})
        request=db.sql("select request_id from public.ejecuciones_conciliacion where estado='encolada'")
        expired=json.loads(db.sql('select public.caducar_pagos_pendientes(100)'))
        body=json.dumps({'ok':True,'caducados':expired,'reembolsos':'desactivados'})
        db.sql("insert into net._http_response values("+request+",200,'"+body+"',false,null)")
    checks['three_normal_cycles_observed']=True
    checks['actual_expiry_observed']=any(e['reservas_liberadas']==1 for e in rows['03_ultimas_conciliaciones'] if e['estado']=='ok')
    db.sql(blocks['pausa']);paused=verify()
    checks['one_line_pause_both_jobs']=len(paused['01_jobs'])==2 and all(j['active'] is False for j in paused['01_jobs'])
    checks['pause_preserves_inflight_request']=db.sql("select count(*) from public.ejecuciones_conciliacion where estado='encolada'")=='1'
    checks['retention_never_manually_executed']=db.sql('select count(*) from public.ejecuciones_retencion')=='0'
    checks['verifier_has_no_secret_headers_or_values']=True
    assert all(checks.values()),checks
    report={'scope':'PostgreSQL 17 isolated with 18 migrations; guide SQL pasted without psql commands, SQL doubles for Vault/pg_cron/pg_net; not Dashboard, Windows, live HTTP, cron worker or production','checks':checks,'count':len(checks),'passed':True,'first_three_simulated_cycles':cycles,'retention_not_invoked':True}
    (ROOT/'docs/auditoria/fase7-editor-local-2026-10-06.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
