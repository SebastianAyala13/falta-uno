"""Executable local proof: all public table rows, catalog/ACLs, empty-target guard."""
import hashlib,json,pathlib,subprocess,tempfile,time
from postgres_fixture import Postgres,ROOT

def state(db,name):
    rows={}
    for table in db.sql("select tablename from pg_tables where schemaname='public' order by tablename",name).splitlines():
        data=db.sql(f'''select coalesce(jsonb_agg(x.row order by x.row::text),'[]') from (select to_jsonb(t) row from public."{table}" t) x''',name)
        rows[table]={'rows':len(json.loads(data)),'sha256':hashlib.sha256(data.encode()).hexdigest()}
    catalog=db.sql("""select jsonb_agg(x order by x::text) from (
      select 'constraint' kind,conname name,pg_get_constraintdef(oid) definition from pg_constraint where connamespace='public'::regnamespace
      union all select 'policy',tablename||'.'||policyname,concat(cmd,roles,qual,with_check) from pg_policies where schemaname='public'
      union all select 'function',oid::regprocedure::text,pg_get_functiondef(oid)||coalesce(proacl::text,'') from pg_proc where pronamespace='public'::regnamespace
      union all select 'index',indexname,indexdef from pg_indexes where schemaname='public'
      union all select 'view',viewname,definition from pg_views where schemaname='public'
      union all select 'trigger',tgname,pg_get_triggerdef(oid) from pg_trigger where tgrelid in (select oid from pg_class where relnamespace='public'::regnamespace) and not tgisinternal
      union all select 'acl',relname,coalesce(relacl::text,'') from pg_class where relnamespace='public'::regnamespace
    ) x""",name)
    return {'tables':rows,'catalog_sha256':hashlib.sha256(catalog.encode()).hexdigest()}

def main():
    with Postgres() as db,tempfile.TemporaryDirectory(prefix='faltauno-backup-') as temp:
        db.bootstrap();db.migrate()
        db.sql("""insert into auth.users values ('00000000-0000-0000-0000-000000000001');
          insert into public.profiles(id,nombre,email,posicion,nivel) values ('00000000-0000-0000-0000-000000000001','Backup fixture','fixture@example.test','Portero','Casual');
          insert into public.canchas(owner_id,nombre,direccion,zona) values ('00000000-0000-0000-0000-000000000001','Backup court','Fixture','Centro');
          insert into public.posts(autor_id,autor_nombre,tipo,texto) values ('00000000-0000-0000-0000-000000000001','Fixture','pregunta','Backup test');""")
        before=state(db,'postgres');out=pathlib.Path(temp)/'backup'
        b=subprocess.run(['python3',str(ROOT/'scripts/db/logical_backup.py'),'--container',db.container,'--database','postgres','--output',str(out)],check=True,capture_output=True,text=True)
        db.sql('create database restored');db.bootstrap('restored')
        cmd=['python3',str(ROOT/'scripts/db/logical_restore.py'),'--container',db.container,'--database','restored','--input',str(out),'--isolated-auth-stubs']
        r=subprocess.run(cmd,capture_output=True,text=True)
        if r.returncode: raise AssertionError(r.stdout+r.stderr)
        assert state(db,'restored')==before,'Restored application rows/catalog/ACLs differ'
        assert subprocess.run(cmd,capture_output=True).returncode!=0,'Nonempty restore must be rejected'
        anchors=(out/'auth-anchors.json');original=anchors.read_bytes();anchors.write_bytes(b'[]')
        corrupt=subprocess.run(cmd,capture_output=True,text=True)
        assert corrupt.returncode!=0 and 'checksum mismatch' in corrupt.stderr
        anchors.write_bytes(original)
        assert state(db,'restored')==before

        # No full Auth user exists, just dependency UUID in a disposable stub.
        assert db.sql("select count(*) from information_schema.columns where table_schema='auth' and table_name='users'",'restored')=='1'
        report={'backup':json.loads(b.stdout),'restore':json.loads(r.stdout),'equal_rows_catalog_acl':True,'refuses_nonempty':True,'refuses_corruption':True,'tables':before['tables'],'limits':['Auth credentials/sessions not backed up','Storage metadata and bytes not backed up','Vault/global roles/extensions require separate preparation','Replica/Realtime publication and cron not covered']}
        path=ROOT/'docs/auditoria/respaldo-ensayo-2026-10-06.json';path.write_text(json.dumps(report,indent=2)+'\n')
        print(json.dumps({k:v for k,v in report.items() if k!='tables'},indent=2))
if __name__=='__main__':main()
