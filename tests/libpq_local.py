"""Minimal libpq wrapper for password-free isolated fixtures; not an app/client SDK."""
import ctypes,ctypes.util,json,socket,subprocess
lib=ctypes.CDLL(ctypes.util.find_library('pq'))
for name,result,args in [('PQconnectdb',ctypes.c_void_p,[ctypes.c_char_p]),('PQstatus',ctypes.c_int,[ctypes.c_void_p]),('PQexec',ctypes.c_void_p,[ctypes.c_void_p,ctypes.c_char_p]),('PQresultStatus',ctypes.c_int,[ctypes.c_void_p]),('PQgetvalue',ctypes.c_char_p,[ctypes.c_void_p,ctypes.c_int,ctypes.c_int]),('PQresultErrorField',ctypes.c_char_p,[ctypes.c_void_p,ctypes.c_int]),('PQresultErrorMessage',ctypes.c_char_p,[ctypes.c_void_p]),('PQclear',None,[ctypes.c_void_p]),('PQfinish',None,[ctypes.c_void_p])]:
    f=getattr(lib,name);f.restype=result;f.argtypes=args
class QueryError(Exception):
    def __init__(self,state,expected=False):self.state=state;self.expected=expected
class Connection:
    def __init__(self,host,port):
        self.handle=lib.PQconnectdb(f'host={host} port={port} user=postgres dbname=postgres connect_timeout=5 application_name=faltauno_isolated_measure'.encode())
        if not self.handle or lib.PQstatus(self.handle)!=0:
            self.close();raise QueryError('connection_failed')
    def close(self):
        if getattr(self,'handle',None):lib.PQfinish(self.handle);self.handle=None
    def query(self,sql):
        result=lib.PQexec(self.handle,sql.encode())
        try:
            status=lib.PQresultStatus(result)
            if status not in (1,2):
                state=(lib.PQresultErrorField(result,67) or b'unknown').decode()
                message=(lib.PQresultErrorMessage(result) or b'').decode()
                raise QueryError(state,state in ('23P01','23505') or state=='P0001' and 'lleno' in message)
            return lib.PQgetvalue(result,0,0).decode() if status==2 else None
        finally:lib.PQclear(result)
def endpoint(db):
    info=json.loads(subprocess.run(['docker','inspect',db.container],check=True,capture_output=True,text=True).stdout)[0]
    port=int(info['NetworkSettings']['Ports']['5432/tcp'][0]['HostPort'])
    candidates=[('127.0.0.1',port)]
    for network in info['NetworkSettings']['Networks'].values():candidates.append((network['IPAddress'],5432))
    for host,port in candidates:
        try:
            c=Connection(host,port);assert c.query('select 1')=='1';c.close();return host,port
        except QueryError:pass
    raise RuntimeError('Fixture TCP unreachable: cannot measure concurrent connections')
