import json
import pathlib
import subprocess

root = pathlib.Path(__file__).resolve().parent
observed = root / 'observed.json'
observed.unlink(missing_ok=True)
result = subprocess.run(['agy', '--model', 'gemini-3.8-flash-low', '--output-format', 'json', '-p', 'Reply only READY.'], cwd=root, capture_output=True, text=True, timeout=120)
print('exit:', result.returncode)
try:
    parsed = json.loads(result.stdout)
    print('status:', parsed.get('status'), 'response:', parsed.get('response'))
except ValueError:
    print('invalid JSON output')
print('hook file exists:', observed.exists())
if observed.exists():
    metadata = json.loads(observed.read_text())
    print('conversation ID present:', bool(metadata.get('conversationId')))
    print('transcript path present:', bool(metadata.get('transcriptPath')))
assert result.returncode == 0 and observed.exists(), 'Expected hook to write metadata'
