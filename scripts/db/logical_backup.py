#!/usr/bin/env python3
"""Public application schema/data only. Connection via PG env/service, never a DSN argument."""
import argparse,hashlib,json,os,pathlib,re,subprocess,time

def run(args,command,data=None):
    prefix=['docker','exec','-i',args.container] if args.container else []
    result=subprocess.run(prefix+command,input=data,capture_output=True)
    if result.returncode:
        # pg errors may contain connection details; never print provider stderr.
        raise RuntimeError('PostgreSQL operation failed; inspect securely without publishing credentials')
    return result.stdout

def connection(args):
    return ['-U','postgres','-d',args.database] if args.container else ['-d',args.database] if args.database else []

def main():
    p=argparse.ArgumentParser();p.add_argument('--container');p.add_argument('--database');p.add_argument('--output',required=True);args=p.parse_args()
    out=pathlib.Path(args.output)
    if out.exists(): raise SystemExit('Output exists: refusing to overwrite a backup')
    out.mkdir(parents=True,mode=0o700);os.chmod(out,0o700)
    started=time.perf_counter()
    try:
        dump=run(args,['pg_dump','--format=custom','--schema=public','--no-owner']+connection(args))
        # UUID dependency anchors are not an Auth backup: no hashes/tokens/emails.
        ids=run(args,['psql','-X','-qAt','-v','ON_ERROR_STOP=1']+connection(args),b'SET row_security=off; SELECT id FROM public.profiles ORDER BY id;').decode().splitlines()
        if any(not re.fullmatch(r'[0-9a-f-]{36}',x) for x in ids): raise RuntimeError('Unexpected identity output')
        for name,data in [('application.dump',dump),('auth-anchors.json',json.dumps(ids).encode())]:
            (out/name).write_bytes(data);os.chmod(out/name,0o600)
        manifest={'format':1,'scope':'public schema/data incl. RLS/ACL; excludes Auth/Storage/Vault/globals','sha256':{n:hashlib.sha256((out/n).read_bytes()).hexdigest() for n in ['application.dump','auth-anchors.json']},'seconds':round(time.perf_counter()-started,3)}
        (out/'manifest.json').write_text(json.dumps(manifest,indent=2));os.chmod(out/'manifest.json',0o600)
        print(json.dumps({'ok':True,'bytes':len(dump),'seconds':manifest['seconds'],'scope':manifest['scope']}))
    except Exception:
        raise SystemExit('Backup incomplete; keep existing backups and inspect the failure securely')
if __name__=='__main__': main()
