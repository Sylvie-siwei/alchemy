import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const ignored = new Set(['node_modules', 'dist', '.wrangler', '.next', '.vinext', 'artifacts']);
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name === '.git') findings.push({ file: '.git', rule: 'unexpected-history' }); else walk(full); }
    else files.push(full);
  }
}
const findings = [];
walk(root);
const rules = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/],
  ['credential', /(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{25,}|AKIA[A-Z0-9]{16})/],
  ['jwt', /eyJ[A-Za-z0-9_-]{15,}[.][A-Za-z0-9_-]{10,}[.][A-Za-z0-9_-]+/],
  ['hosting-project-id', /appgprj_[A-Za-z0-9]+/],
  ['private-network', /\b(?:10[.](?:\d{1,3}[.]){2}\d{1,3}|192[.]168[.]\d{1,3}[.]\d{1,3}|172[.](?:1[6-9]|2\d|3[01])[.]\d{1,3}[.]\d{1,3})\b/],
];
const hosts = new Set(), emails = new Set();
for (const full of files) {
  const file = path.relative(root, full).split(path.sep).join('/');
  if (file === 'scripts/check-public.mjs') continue; // Rules contain their own patterns.
  if (file.startsWith('.env') && file !== '.env.example') findings.push({ file, rule: 'local-env-file' });
  const source = fs.readFileSync(full, 'utf8');
  source.split(/\r?\n/).forEach((line, index) => {
    for (const [rule, pattern] of rules) if (pattern.test(line)) findings.push({ file, line: index + 1, rule });
    for (const match of line.matchAll(/[\w.+-]+@([\w.-]+[.][A-Za-z]{2,})/g)) {
      emails.add(match[0]);
      if (match[1] !== 'example.com') findings.push({ file, line: index + 1, rule: 'non-example-email' });
    }
    for (const match of line.matchAll(/https?:\/\/([^/\s"'<>)\x60]+)/g)) hosts.add(match[1]);
  });
}
console.log(JSON.stringify({ scannedFiles: files.length, findings, hosts: [...hosts].sort(), emails: [...emails].sort(), scope: 'first-party source/config/docs/tests/lockfile; excludes dependencies and generated output; heuristic scan, not a rights clearance' }, null, 2));
if (findings.length) process.exitCode = 1;
