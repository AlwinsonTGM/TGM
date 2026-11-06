// Disposable feasibility probe, not production approval or concurrency code.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const vault = path.join(__dirname, 'vault');
fs.mkdirSync(path.join(vault, 'Subject'), {recursive: true});
const index = path.join(vault, 'Subject', 'Subject.md');
const reviewer = path.join(vault, 'Subject', 'Reviewer.md');
fs.writeFileSync(index, '---\ntitle: Subject\ncustom: preserve-me\n---\n\n# Subject\n\nExisting content.\n');
if (fs.existsSync(reviewer)) fs.unlinkSync(reviewer);

const hash = file => fs.existsSync(file) ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null;
const makeDraft = () => ({
  edits: [
    {file: index, base: hash(index), content: fs.readFileSync(index, 'utf8') + '\n- [[Subject/Reviewer|Reviewer]]\n'},
    {file: reviewer, base: hash(reviewer), content: '---\ntitle: Reviewer\n---\n\n# Reviewer\n\n> [!note] Core idea\n> A short example from a study session.\n\nSee [[Subject/Subject|Subject]].\n'}
  ], status: 'pending'
});
const apply = draft => {
  if (draft.status !== 'approved') return 'approval-required';
  if (draft.edits.some(edit => hash(edit.file) !== edit.base)) return 'conflict';
  for (const edit of draft.edits) fs.writeFileSync(edit.file, edit.content);
  draft.status = 'applied';
  return 'applied';
};
const reject = draft => {draft.status = 'rejected';};
const original = fs.readFileSync(index, 'utf8');
const draft = makeDraft();
assert.equal(apply(draft), 'approval-required');
assert.equal(fs.readFileSync(index, 'utf8'), original);
assert.equal(fs.existsSync(reviewer), false);
reject(draft);
assert.equal(apply(draft), 'approval-required');
assert.equal(fs.readFileSync(index, 'utf8'), original);
console.log('PASS: pending or rejected draft does not change either note');

const stale = makeDraft();
fs.appendFileSync(index, '\nExternal edit before approval.\n');
stale.status = 'approved';
assert.equal(apply(stale), 'conflict');
assert.match(fs.readFileSync(index, 'utf8'), /External edit before approval/);
assert.equal(fs.existsSync(reviewer), false);
console.log('PASS: changed existing note blocks the whole draft before writing');

const collision = makeDraft();
fs.writeFileSync(reviewer, 'Someone else created this file.\n');
collision.status = 'approved';
assert.equal(apply(collision), 'conflict');
assert.equal(fs.readFileSync(reviewer, 'utf8'), 'Someone else created this file.\n');
console.log('PASS: new-file collision blocks draft and preserves the new file');
fs.unlinkSync(reviewer);

const fresh = makeDraft();
fresh.status = 'approved';
assert.equal(apply(fresh), 'applied');
assert.match(fs.readFileSync(index, 'utf8'), /custom: preserve-me/);
assert.match(fs.readFileSync(index, 'utf8'), /External edit before approval/);
assert.match(fs.readFileSync(index, 'utf8'), /\[\[Subject\/Reviewer\|Reviewer\]\]/);
assert.match(fs.readFileSync(reviewer, 'utf8'), /> \[!note\]/);
console.log('PASS: newly reviewed approved draft writes reviewer and link while preserving existing content');
console.log('Disposable vault:', vault);
console.log('LIMIT: sequential local writes are not an atomic transaction; a crash or edit between check and write is not protected.');
