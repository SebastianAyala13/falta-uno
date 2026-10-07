"""Health aggregate on PostgreSQL 17; cron/net/Vault fixtures, no live service."""
import ast
import json

from backup_restore import state
from postgres_fixture import Postgres, ROOT


def scheduler_fixture():
    tree = ast.parse((ROOT / 'tests/scheduler_sql.py').read_text())
    return next(
        node.args[0].value for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute) and node.func.attr == 'sql'
        and node.args and isinstance(node.args[0], ast.Constant)
        and isinstance(node.args[0].value, str)
        and 'create schema cron;' in node.args[0].value
    )


checks = {}
migration = (ROOT / 'supabase/migrations/20261007130000_estado_salud.sql').read_text()
with Postgres() as db:
    db.bootstrap()
    db.migrate()
    checks['twenty_real_migrations'] = db.sql(
        'select count(*) from supabase_migrations.schema_migrations'
    ) == '20'
    checks['migration_installs_without_cron_and_does_not_schedule'] = db.sql(
        "select to_regclass('cron.job') is null"
    ) == 't'
    checks['missing_cron_returns_false_without_sql_error'] = db.sql(
        "set role service_role;select public.estado_salud()"
    ) == 'f'
    checks['rpc_is_boolean_definer_with_fixed_search_path'] = db.sql(
        "select prorettype='boolean'::regtype and not proretset and prosecdef "
        "and 'search_path=public'=any(proconfig) "
        "from pg_proc where oid='public.estado_salud()'::regprocedure"
    ) == 't'
    checks['service_only_effective_execute'] = db.sql(
        "select has_function_privilege('service_role','public.estado_salud()','EXECUTE') "
        "and not has_function_privilege('anon','public.estado_salud()','EXECUTE') "
        "and not has_function_privilege('authenticated','public.estado_salud()','EXECUTE')"
    ) == 't'
    for role in ['anon', 'authenticated']:
        try:
            db.sql('set role ' + role + ';select public.estado_salud()')
        except RuntimeError as error:
            assert 'permission denied for function estado_salud' in str(error)
        else:
            raise AssertionError(role + ' must not invoke health aggregate')
        checks[role + '_invocation_denied'] = True
    before = state(db, 'postgres')
    db.sql(migration)
    checks['migration_reapply_preserves_rows_and_catalog'] = state(db, 'postgres') == before

    db.sql(scheduler_fixture())
    installer = '\n'.join(
        line for line in (ROOT / 'scripts/db/programar_conciliacion.sql').read_text().splitlines()
        if not line.startswith('\\set')
    )
    db.sql(installer)
    db.sql("insert into public.ejecuciones_conciliacion(estado,terminada_at) values('ok',now())")
    baseline = state(db, 'postgres')
    scheduler_baseline = db.sql('select jsonb_agg(to_jsonb(j) order by jobid) from cron.job j')

    def probe(name, setup='', expected=False):
        # Each adverse state is independent and rolls back. No deletes or cleanup
        # of inconvenient records are used to turn a failed check into success.
        result = db.sql(
            'begin;' + setup
            + "set local role service_role;set local request.jwt.claim.role='service_role';"
            + 'select public.estado_salud();rollback;'
        )
        assert result == ('t' if expected else 'f'), (name, result)
        checks[name] = True

    probe('healthy_before_retention_install', expected=True)
    probe('actual_conciliation_alarm_returns_false',
          "update public.ejecuciones_conciliacion set terminada_at=now()-interval '4 minutes';")
    probe('paused_conciliation_returns_false_even_with_recent_success',
          "update cron.job set active=false where jobname='faltauno-conciliacion';")
    probe('missing_named_conciliation_job_returns_false',
          "update cron.job set jobname='isolated-other-name' where jobname='faltauno-conciliacion';")
    probe('conciliation_db_error_returns_false',
          'alter table public.ejecuciones_conciliacion rename to isolated_unavailable;')
    probe('cron_db_error_returns_false', 'alter table cron.job rename to isolated_unavailable;')
    probe('retention_db_error_returns_false',
          'alter table public.ejecuciones_retencion rename to isolated_unavailable;')

    for name, expression in [
        ('sql_null_alarm_response', 'null::jsonb'),
        ('json_null_alarm_response', "'null'::jsonb"),
        ('missing_alarm_key', "'{}'::jsonb"),
        ('string_false_alarm', "'{\"alarma\":\"false\"}'::jsonb"),
        ('null_alarm_key', "'{\"alarma\":null}'::jsonb"),
        ('array_alarm_response', "'[]'::jsonb"),
    ]:
        probe(name + '_returns_false',
              'create or replace function public.estado_conciliacion() returns jsonb '
              'language sql security definer set search_path=public as $$select '
              + expression + '$$;')
    probe('rpc_query_exception_returns_false_without_detail',
          'create or replace function public.estado_conciliacion() returns jsonb '
          "language plpgsql security definer set search_path=public as $$begin "
          "raise exception 'ISOLATED_ERROR_MUST_NOT_LEAK';end$$;")

    job = ("insert into cron.job(jobname,schedule,command) "
           "values('faltauno-retencion','15 8 * * *','select public.aplicar_retencion(1000);');")
    receipt = "insert into public.ejecuciones_retencion(ejecutada_at,conteos) values({date},'{{}}'::jsonb);"
    probe('newly_installed_retention_waits_for_first_success', job)
    probe('actual_successful_purger_receipt_is_healthy',
          job + 'do $$begin perform public.aplicar_retencion(1000);end$$;', expected=True)
    probe('retention_success_at_26_hour_boundary_is_healthy',
          job + receipt.format(date="now()-interval '26 hours'"), expected=True)
    probe('retention_older_than_26_hours_returns_false',
          job + receipt.format(date="now()-interval '26 hours 1 second'"))
    probe('future_retention_receipt_does_not_count',
          job + receipt.format(date="now()+interval '1 hour'"))
    probe('paused_retention_returns_false_with_recent_receipt',
          job + receipt.format(date='now()')
          + "update cron.job set active=false where jobname='faltauno-retencion';")
    probe('missing_retention_job_with_prior_receipt_returns_false',
          receipt.format(date='now()'))
    probe('recent_and_old_retention_receipts_are_healthy',
          job + receipt.format(date="now()-interval '27 hours'")
          + receipt.format(date="now()-interval '1 hour'"), expected=True)
    checks['all_probes_rollback_public_rows_and_catalog'] = state(db, 'postgres') == baseline
    checks['all_probes_rollback_scheduler_rows'] = (
        db.sql('select jsonb_agg(to_jsonb(j) order by jobid) from cron.job j') == scheduler_baseline
    )
    assert all(checks.values()), checks
    print(json.dumps({
        'scope': 'PostgreSQL 17 isolated, 20 real migrations; cron/net/Vault doubles; '
                 'no production, deployment, live scheduler, Auth, HTTP or monitor service',
        'checks': checks,
        'count': len(checks),
        'passed': True,
    }, indent=2))
