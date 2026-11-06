import json
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

LIMIT = 40


def open_db(path):
    return sqlite3.connect(path, timeout=5, isolation_level=None)


def serve(path, bound_project):
    db = open_db(path)
    for line in sys.stdin:
        req = json.loads(line)
        result = {}
        try:
            method, params = req['method'], req.get('params', {})
            if method == 'initialize':
                result = {'protocolVersion': params['protocolVersion'], 'capabilities': {'tools': {}}, 'serverInfo': {'name': 'scope-probe', 'version': '1'}}
            elif method == 'tools/list':
                result = {'tools': [{'name': 'read_memory', 'inputSchema': {'type': 'object', 'properties': {}, 'additionalProperties': False}}, {'name': 'propose_memory', 'inputSchema': {'type': 'object', 'properties': {'text': {'type': 'string'}}, 'required': ['text'], 'additionalProperties': False}}]}
            elif method == 'tools/call':
                name, args = params['name'], params.get('arguments', {})
                if name == 'read_memory' and args == {}:
                    text = db.execute('select memory from projects where id=?', (bound_project,)).fetchone()[0]
                    result = {'content': [{'type': 'text', 'text': text}]}
                elif name == 'propose_memory' and set(args) == {'text'} and isinstance(args['text'], str):
                    text = args['text']
                    old, rev = db.execute('select memory,revision from projects where id=?', (bound_project,)).fetchone()
                    if not text.strip() or len((old + text).encode('utf-8')) > LIMIT:
                        raise ValueError('empty text or budget exceeded')
                    db.execute('insert into drafts(project,text,base_revision) values(?,?,?)', (bound_project, text, rev))
                    result = {'content': [{'type': 'text', 'text': 'draft only'}]}
                else:
                    raise ValueError('tool or arguments not allowed')
            else:
                raise ValueError('unknown method')
            response = {'jsonrpc': '2.0', 'id': req['id'], 'result': result}
        except Exception as error:
            response = {'jsonrpc': '2.0', 'id': req.get('id'), 'error': {'code': -32602, 'message': str(error)}}
        print(json.dumps(response), flush=True)


def approve(db, draft_id):
    # Simulates a trusted app action; it is deliberately unavailable as an MCP tool.
    db.execute('begin immediate')
    try:
        row = db.execute('select project,text,base_revision from drafts where id=?', (draft_id,)).fetchone()
        if row is None:
            raise ValueError('missing draft')
        project, text, base = row
        old, revision = db.execute('select memory,revision from projects where id=?', (project,)).fetchone()
        if base != revision or len((old + text).encode('utf-8')) > LIMIT:
            raise ValueError('stale draft or budget exceeded')
        db.execute('update projects set memory=?, revision=revision+1 where id=?', (old + text, project))
        db.execute('delete from drafts where id=?', (draft_id,))
        db.execute('commit')
    except BaseException:
        db.execute('rollback')
        raise


def call(process, method, **params):
    process.stdin.write(json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params}) + '\n')
    process.stdin.flush()
    return json.loads(process.stdout.readline())


def tool(process, name, arguments=None):
    return call(process, 'tools/call', name=name, arguments=arguments or {})


def main():
    with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as directory:
        path = str(Path(directory) / 'synthetic.sqlite')
        db = open_db(path)
        db.executescript("create table projects(id text primary key, memory text not null, revision integer not null); create table drafts(id integer primary key, project text, text text, base_revision integer); insert into projects values('alpha','alpha:',0),('beta','beta:',0);")
        processes = [subprocess.Popen([sys.executable, __file__, 'serve', path, project], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True) for project in ('alpha', 'beta')]
        alpha, beta = processes
        try:
            for process in processes:
                assert 'result' in call(process, 'initialize', protocolVersion='2025-03-26')
                tools = call(process, 'tools/list')['result']['tools']
                assert {item['name'] for item in tools} == {'read_memory', 'propose_memory'}
            assert tool(alpha, 'read_memory')['result']['content'][0]['text'] == 'alpha:'
            assert tool(beta, 'read_memory')['result']['content'][0]['text'] == 'beta:'
            assert 'error' in tool(alpha, 'read_memory', {'project': 'beta'})
            assert 'error' in tool(alpha, 'propose_memory', {'project': 'beta', 'text': 'steal'})
            assert 'error' in tool(alpha, 'approve_memory', {'draft_id': 1})
            assert 'error' in tool(alpha, 'propose_memory', {'text': '😊' * 10})
            assert 'result' in tool(alpha, 'propose_memory', {'text': 'draft'})
            assert tool(alpha, 'read_memory')['result']['content'][0]['text'] == 'alpha:'
            assert tool(beta, 'read_memory')['result']['content'][0]['text'] == 'beta:'
            draft = db.execute('select id from drafts where project=?', ('alpha',)).fetchone()[0]
            approve(db, draft)
            assert tool(alpha, 'read_memory')['result']['content'][0]['text'] == 'alpha:draft'
            assert tool(beta, 'read_memory')['result']['content'][0]['text'] == 'beta:'
            assert 'result' in tool(alpha, 'propose_memory', {'text': 'next'})
            draft = db.execute('select id from drafts where project=?', ('alpha',)).fetchone()[0]
            db.execute('update projects set revision=revision+1 where id=?', ('alpha',))
            try:
                approve(db, draft)
            except ValueError:
                pass
            else:
                raise AssertionError('stale approval was allowed')
            assert tool(alpha, 'read_memory')['result']['content'][0]['text'] == 'alpha:draft'
            db.execute('delete from drafts')
            assert 'result' in tool(alpha, 'propose_memory', {'text': 'ok'})
            draft = db.execute('select id from drafts where project=?', ('alpha',)).fetchone()[0]
            db.execute('update projects set memory=? where id=?', ('x' * LIMIT, 'alpha'))
            try:
                approve(db, draft)
            except ValueError:
                pass
            else:
                raise AssertionError('over-budget approval was allowed')
            assert tool(alpha, 'read_memory')['result']['content'][0]['text'] == 'x' * LIMIT
            print('PASS: two JSON-RPC processes bound to separate projects; cross-project arguments rejected; no MCP approval tool; byte cap; draft-only write; trusted approval; stale draft rejected')
        finally:
            for process in processes:
                process.stdin.close()
                process.wait(timeout=5)
            db.close()


if __name__ == '__main__':
    serve(sys.argv[2], sys.argv[3]) if len(sys.argv) > 1 else main()
