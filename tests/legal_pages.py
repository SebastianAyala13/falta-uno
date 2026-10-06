"""Read-only legal source/HTTP audit. No login, cookie, API or deployment calls."""
import argparse
import concurrent.futures
import datetime
import hashlib
import http.server
import json
import pathlib
import re
import subprocess
import threading
import urllib.error
import urllib.request

ROOT=pathlib.Path(__file__).resolve().parents[1]
PAGES=['privacidad.html','terminos.html','eliminar-cuenta.html','normas-comunidad.html','mandato-recaudo.html','terminos-marketplace.html','cancelaciones.html']
MIRROR=ROOT.parent/'falta-uno-legal'
BASES=['https://sebastianayala13.github.io/falta-uno-legal','https://falta-uno.kodarify.com/legal']
def sha(data):return hashlib.sha256(data).hexdigest()
def fetch(url,expected=None):
    row={'url':url,'anonymous':True}
    request=urllib.request.Request(url,headers={'User-Agent':'FaltaUno-legal-audit/1.0'})
    try:
        with urllib.request.urlopen(request,timeout=15) as response:
            data=response.read(2*1024*1024)
            row.update(status=response.status,final_url=response.url,content_type=response.headers.get('Content-Type',''),sha256=sha(data),matches_app_source=sha(data)==expected if expected else None)
            row['static_legal_content']=bool(re.search(r'<title>[^<]*(?:Privacidad|Términos|Eliminar|Normas|Mandato|Cancelaciones)',data.decode('utf-8',errors='replace'),re.I)) and b'<script' not in data.lower()
    except urllib.error.HTTPError as error:row.update(status=error.code,final_url=error.url,error='http_error')
    except urllib.error.URLError as error:
        reason=str(error.reason)
        proxy=re.search(r'Tunnel connection failed: (\d{3})',reason)
        row.update(status=None,error='proxy_connect_rejected' if proxy else 'network_or_tls_error')
        if proxy:row['proxy_connect_status']=int(proxy.group(1))
    except (TimeoutError,OSError):row.update(status=None,error='network_or_tls_error')
    return row
class Quiet(http.server.SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT),**kwargs)
    def log_message(self,*args):pass

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--public-http',action='store_true');a=parser.parse_args()
    source=[]
    for name in PAGES:
        data=(ROOT/'legal'/name).read_bytes(); local=(MIRROR/name).read_bytes() if (MIRROR/name).exists() else None
        remote=subprocess.run(['git','-C',str(MIRROR),'show','origin/main:'+name],capture_output=True)
        content=data.decode()
        links=re.findall(r'href=[\"\']([^\"\']+)',content)
        missing=[link for link in links if not re.match(r'^(?:https?:|mailto:|#)',link) and not (ROOT/'legal'/link.split('#')[0]).exists()]
        assert not missing,(name,missing)
        assert '<script' not in content.lower(),name
        source.append({'file':name,'app_sha256':sha(data),'mirror_worktree_matches':local==data,'mirror_origin_main_exists':remote.returncode==0,'mirror_origin_main_matches':remote.returncode==0 and remote.stdout==data,'missing_relative_links':missing})
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Quiet)
    worker=threading.Thread(target=server.serve_forever,daemon=True);worker.start()
    try:
        local=[fetch(f'http://127.0.0.1:{server.server_port}/legal/'+row['file'],row['app_sha256']) for row in source]
        missing=fetch(f'http://127.0.0.1:{server.server_port}/legal/does-not-exist.html')
        assert missing['status']==404,missing
        assert all(row['status']==200 and row['matches_app_source'] and row['static_legal_content'] for row in local),local
    finally:server.shutdown();server.server_close();worker.join()
    public=[]
    if a.public_http:
        jobs=[(base+'/'+row['file'],row['app_sha256']) for base in BASES for row in source]
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:public=list(pool.map(lambda job:fetch(*job),jobs))
    report={'checked_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'Uncredentialed GET of legal HTML only; no Supabase APIs, login, cookies or mutations. Remote refs fetched separately. Store console values and build env unknown.','review_ready':bool(public) and all(row.get('status')==200 and row.get('matches_app_source') and row.get('static_legal_content') for row in public) and all(row['mirror_origin_main_matches'] for row in source),'source':source,'local_missing_page_status':missing['status'],'local_http':local,'public_http':public,'non_200_urls':[row for row in public if row.get('status')!=200],'not_current_or_not_legal':[row for row in public if row.get('status')==200 and (not row.get('matches_app_source') or not row.get('static_legal_content'))]}
    if a.public_http:(ROOT/'docs/auditoria/legal-urls-2026-10-06.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
if __name__=='__main__':main()
