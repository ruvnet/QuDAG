import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

if (process.platform === 'win32') {
  test.skip('POSIX executable and signal fixture; Windows requires native qualification');
} else {
// Copy the real built consumer into isolation. Only the native executable is a
// synthetic fixture; no downloader, production process, or live network is used.
const source = process.env.QUDAG_TEST_PACKAGE || path.resolve(__dirname, '..');
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'qudag-process-status-'));
for (const entry of ['bin', 'dist', 'package.json']) {
  fs.cpSync(path.join(source, entry), path.join(fixture, entry), { recursive: true });
}
// npm may hoist a packed package's dependencies into its parent node_modules.
const dependencies = fs.existsSync(path.join(source, 'node_modules'))
  ? path.join(source, 'node_modules') : path.dirname(source);
fs.symlinkSync(dependencies, path.join(fixture, 'node_modules'), 'junction');
const binary = path.join(fixture, 'bin', 'platform', 'qudag');
fs.mkdirSync(path.dirname(binary), { recursive: true });
fs.writeFileSync(binary, `#!${process.execPath}
const [mode, value] = process.argv.slice(2);
if (mode === 'signal') process.kill(process.pid, value);
else if (mode === 'output') {
  process.stdout.write('O'.repeat(262144));
  process.stderr.write('E'.repeat(262144));
  process.exitCode = 0;
} else process.exit(Number(value));
`, { mode: 0o755 });
const api = require(path.join(fixture, 'dist', 'index.js'));
process.on('exit', () => fs.rmSync(fixture, { recursive: true, force: true }));

for (const code of [0, 7]) {
  test(`CLI preserves ordinary exit ${code}`, () => {
    const result = spawnSync(process.execPath, [path.join(fixture, 'bin', 'qudag.js'), 'exit', String(code)], { timeout: 5000 });
    assert.equal(result.error, undefined);
    assert.equal(result.status, code);
  });
  test(`API preserves ordinary exit ${code}`, async () => {
    assert.equal((await api.execute(['exit', String(code)])).code, code);
  });
}

for (const signal of ['SIGTERM', 'SIGINT', 'SIGKILL']) {
  test(`CLI fails on ${signal}`, () => {
    const result = spawnSync(process.execPath, [path.join(fixture, 'bin', 'qudag.js'), 'signal', signal], { timeout: 5000 });
    assert.equal(result.error, undefined);
    assert.ok(result.status !== null && result.status > 0, JSON.stringify(result));
  });
  test(`API fails on ${signal}`, async () => {
    assert.ok((await api.execute(['signal', signal])).code > 0);
  });
}

test('API collects complete stdout and stderr', async () => {
  const result = await api.execute(['output']);
  assert.equal(result.code, 0);
  assert.equal(result.stdout, 'O'.repeat(262144));
  assert.equal(result.stderr, 'E'.repeat(262144));
});

test('CLI and API fail when the installed file is not executable', async () => {
  fs.chmodSync(binary, 0o644);
  try {
    const result = spawnSync(process.execPath, [path.join(fixture, 'bin', 'qudag.js')], { timeout: 5000 });
    assert.equal(result.status, 1);
    await assert.rejects(api.execute([]), { code: 'EACCES' });
  } finally {
    fs.chmodSync(binary, 0o755);
  }
});
}
