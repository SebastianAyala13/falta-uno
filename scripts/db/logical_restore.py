#!/usr/bin/env python3
"""Restore into EMPTY application schema only; never cleans/replaces an existing database."""
import argparse,hashlib,json,pathlib,time
from logical_backup import run,connection

def main():
    p=argparse.ArgumentParser();p.add_argument('--container');p.add_argument('--database');p.add_argument('--input',required=True);p.add_argument('--isolated-auth-stubs',action='store_true');a=p.parse_args()
    root=pathlib.Path(a.input);manifest=json.loads((root/'manifest.json').read_text())
    if manifest.get('format')!=1: raise SystemExit('Unsupported backup format')
    for name in ['application.dump','auth-anchors.json']:
        if hashlib.sha256((root/name).read_bytes()).hexdigest()!=manifest['sha256'][name]: raise SystemExit('Backup checksum mismatch')
    c=connection(a);psql=['psql','-X','-qAt','-v','ON_ERROR_STOP=1']+c
    count=run(a,psql,b"SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S');").decode().strip()
    if count!='0': raise SystemExit('Target public schema is not empty; restore refused without deleting anything')
    anchors=json.loads((root/'auth-anchors.json').read_text());started=time.perf_counter()
    if a.isolated_auth_stubs:
        if not a.container: raise SystemExit('Auth stubs require a labelled disposable Docker fixture')
        import subprocess
        label=subprocess.run(['docker','inspect','--format','{{index .Config.Labels "faltauno.isolated-test"}}',a.container],check=True,capture_output=True,text=True).stdout.strip()
        if label!='true': raise SystemExit('Container is not an isolated test fixture')
        import uuid
        values=','.join("('"+str(uuid.UUID(x))+"')" for x in anchors)
        if values: run(a,psql,('insert into auth.users(id) values '+values+' on conflict do nothing;').encode())
    else:
        # Real Auth must be separately restored/available; never invent real accounts.
        import uuid
        values=','.join("'"+str(uuid.UUID(x))+"'::uuid" for x in anchors) or 'NULL::uuid'
        found=run(a,psql,('select count(*) from auth.users where id in ('+values+');').encode()).decode().strip()
        if int(found)!=len(anchors): raise SystemExit('Auth identities missing: restore Auth separately before application data')
    # Extension dependencies and roles/auth/storage prerequisites must already exist.
    run(a,psql,b'CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;')
    # pg_dump includes CREATE SCHEMA public. Drop only the empty namespace,
    # without CASCADE: any unexpected object makes this fail safely.
    run(a,psql,b'DROP SCHEMA IF EXISTS public;')
    run(a,['pg_restore','--single-transaction','--exit-on-error','--no-owner']+c,(root/'application.dump').read_bytes())
    print(json.dumps({'ok':True,'seconds':round(time.perf_counter()-started,3),'scope':'application only; no Auth users, Storage files or secrets restored'}))
if __name__=='__main__': main()
