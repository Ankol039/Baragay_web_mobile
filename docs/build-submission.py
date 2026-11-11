#!/usr/bin/env python3
"""Build a clean submission copy without deleting/changing working files."""
from pathlib import Path
import hashlib, json, re, sys, zipfile
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = Path(sys.argv[1] if len(sys.argv) > 1 else '/private/tmp/barangay-firebase-submission.zip').resolve()
SKIP = {'node_modules', '.git', '.expo', '.firebase', 'dist', 'dist-ssr', 'out', 'output', 'verification', '__pycache__'}
ROOT_FILES = ['README.md', 'AGENTS.md', '.gitignore', '.firebaserc', 'firebase.json', 'firestore.rules', 'firestore.indexes.json', 'index.php', 'landing.php', 'login.php']
DIRECTORIES = ['frontend', 'mobile', 'api', 'docs', 'includes', 'assets', 'resident', 'staff', 'migration']
selected = []
for name in ROOT_FILES:
    p = ROOT / name
    if p.is_file(): selected.append(p)
helper = ROOT / 'config/functions.php'
if helper.is_file(): selected.append(helper)
for name in DIRECTORIES:
    for p in (ROOT / name).rglob('*'):
        rel = p.relative_to(ROOT)
        if not p.is_file() or p.is_symlink() or any(part in SKIP for part in rel.parts): continue
        if p.name == '.DS_Store' or p.suffix.lower() in {'.zip', '.log', '.pem', '.key'}: continue
        if p.name.startswith('.env') and p.name != '.env.example': continue
        if re.search(r'(service.?account|adminsdk|credentials|private.?key).*\.json$', p.name, re.I):
            raise SystemExit('Credential-like filename excluded: ' + str(rel))
        selected.append(p)
selected = sorted(set(selected))
assert all(p != ROOT / 'config/db.php' and '/uploads/' not in str(p.relative_to(ROOT)) for p in selected)
for p in selected:
    if p.suffix.lower() in {'.js', '.mjs', '.jsx', '.json', '.php', '.md', '.example', '.py'}:
        data = p.read_bytes()
        if re.search(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|"type"\s*:\s*"service_account"|AIza[0-9A-Za-z_-]{30,}', data):
            raise SystemExit('Credential-like source content blocked: ' + str(p.relative_to(ROOT)))
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
manifest = {'files': [{'path': str(p.relative_to(ROOT)), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in selected],
            'excluded': ['real .env variants', 'Admin/service account keys', 'config/db.php', 'database rows/SQL dumps', 'uploads', 'migration/out', 'dependencies', 'generated bundles', 'old archives', 'Git metadata'],
            'status': 'Source/evidence candidate; physical-phone, console and final video evidence must be checked in docs/deliverables-checklist.md.'}
with zipfile.ZipFile(OUTPUT, 'w', zipfile.ZIP_DEFLATED) as z:
    for p in selected: z.write(p, Path('barangay_survey_system') / p.relative_to(ROOT))
    z.writestr('barangay_survey_system/SUBMISSION-MANIFEST.json', json.dumps(manifest, indent=2) + '\n')
with zipfile.ZipFile(OUTPUT) as z:
    assert z.testzip() is None
    assert len(z.namelist()) == len(selected) + 1
print(json.dumps({'artifact': str(OUTPUT), 'sourceFiles': len(selected), 'zipIntegrity': 'PASS', 'credentialPatternCheck': 'PASS'}))
