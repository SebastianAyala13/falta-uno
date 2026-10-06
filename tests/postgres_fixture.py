"""Disposable PostgreSQL 17 fixture; no remote DSN or production credentials."""
import ast
import importlib.util
import pathlib
import subprocess
import time
import uuid

ROOT=pathlib.Path(__file__).resolve().parents[1]
class Postgres:
    def __init__(self):
        self.container='faltauno-isolated-'+uuid.uuid4().hex[:10]
    def __enter__(self):
        subprocess.run(['docker','run','--rm','--label','faltauno.isolated-test=true','--name',self.container,'-e','POSTGRES_HOST_AUTH_METHOD=trust','-d','postgres:17-alpine'],check=True,capture_output=True)
        for _ in range(100):
            if subprocess.run(['docker','exec',self.container,'pg_isready','-h','127.0.0.1','-U','postgres'],capture_output=True).returncode==0: break
            time.sleep(.1)
        else: raise RuntimeError('PostgreSQL fixture did not start')
        return self
    def __exit__(self,*args):
        subprocess.run(['docker','stop',self.container],capture_output=True)
    def command(self,cmd,data=None):
        r=subprocess.run(['docker','exec','-i',self.container]+cmd,input=data,capture_output=True)
        if r.returncode: raise RuntimeError('Isolated PostgreSQL command failed: '+r.stderr.decode()[:2000])
        return r.stdout
    def sql(self,query,database='postgres'):
        return self.command(['psql','-h','127.0.0.1','-X','-qAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],query.encode()).decode().strip()
    def bootstrap(self,database='postgres'):
        # Reuse the existing regression bootstrap instead of silently diverging.
        tree=ast.parse((ROOT/'tests/database.py').read_text())
        main=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='main')
        constants=[n.args[0].value for n in ast.walk(main) if isinstance(n,ast.Call) and isinstance(n.func,ast.Name) and n.func.id=='sql' and n.args and isinstance(n.args[0],ast.Constant) and isinstance(n.args[0].value,str)]
        setup=next(s for s in constants if 'create schema auth;' in s)
        for role in ['anon','authenticated','service_role']:
            statement='create role '+role+(' bypassrls' if role=='service_role' else '')+';'
            setup=setup.replace(statement,"do $$begin if not exists(select 1 from pg_roles where rolname='"+role+"') then "+statement+" end if; end$$;")
        self.sql(setup,database)
    def migrate(self,database='postgres'):
        for p in sorted((ROOT/'supabase/migrations').glob('*.sql')):
            self.sql(p.read_text().replace('CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";','-- Isolated fixture has no Vault HTTP service.'),database)
