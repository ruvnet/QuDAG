import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import type { AddressInfo } from 'node:net';

// Runs the real built installer (dist/install.js) in an isolated copy against a
// local HTTP server standing in for the GitHub release (QUDAG_DOWNLOAD_BASE_URL).
const source = process.env.QUDAG_TEST_PACKAGE || path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'));
const tag = `v${pkg.version}`;
const triple = `${process.arch === 'arm64' ? 'aarch64' : 'x86_64'}-${
  process.platform === 'darwin' ? 'apple-darwin'
    : process.platform === 'win32' ? 'pc-windows-msvc' : 'unknown-linux-gnu'}`;
const exe = process.platform === 'win32' ? 'qudag.exe' : 'qudag';
const archive = `qudag-${tag}-${triple}.tar.gz`;

function fixture(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qudag-installer-'));
  for (const entry of ['bin', 'dist', 'package.json']) {
    fs.cpSync(path.join(source, entry), path.join(dir, entry), { recursive: true });
  }
  fs.rmSync(path.join(dir, 'bin', 'platform'), { recursive: true, force: true });
  const deps = fs.existsSync(path.join(source, 'node_modules'))
    ? path.join(source, 'node_modules') : path.dirname(source);
  fs.symlinkSync(deps, path.join(dir, 'node_modules'), 'junction');
  return dir;
}

function makeArchive(): Buffer {
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'qudag-archive-'));
  fs.writeFileSync(path.join(stage, exe), '#!/bin/sh\necho fake-qudag\n', { mode: 0o755 });
  const out = path.join(stage, archive);
  const r = spawnSync('tar', ['-czf', out, '-C', stage, exe]);
  assert.equal(r.status, 0, String(r.stderr));
  return fs.readFileSync(out);
}

async function serve(files: Record<string, Buffer | string>): Promise<{ base: string; close: () => void }> {
  const server = http.createServer((req, res) => {
    const name = decodeURIComponent((req.url || '').replace(`/${tag}/`, ''));
    if (name in files) { res.writeHead(200); res.end(files[name]); }
    else { res.writeHead(404); res.end('Not Found'); }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return { base: `http://127.0.0.1:${port}`, close: () => server.close() };
}

function runInstall(dir: string, env: Record<string, string>): Promise<{ code: number | null; out: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(dir, 'dist', 'install.js')], {
      env: { ...process.env, ...env },
    });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('close', (code) => resolve({ code, out }));
  });
}

const supported = ['linux', 'darwin', 'win32'].includes(process.platform)
  && ['x64', 'arm64'].includes(process.arch)
  && !(process.platform === 'win32' && process.arch === 'arm64');

test('missing release asset fails the install with a non-zero exit', { skip: !supported }, async () => {
  const srv = await serve({});
  const dir = fixture();
  try {
    const r = await runInstall(dir, { QUDAG_DOWNLOAD_BASE_URL: srv.base });
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /404/);
    assert.match(r.out, /QUDAG_SKIP_BINARY_DOWNLOAD/);
    assert.equal(fs.existsSync(path.join(dir, 'bin', 'platform', exe)), false);
  } finally { srv.close(); }
});

test('checksum mismatch fails the install and installs nothing', { skip: !supported }, async () => {
  const data = makeArchive();
  const srv = await serve({ [archive]: data, [`${archive}.sha256`]: `${'0'.repeat(64)}  ${archive}\n` });
  const dir = fixture();
  try {
    const r = await runInstall(dir, { QUDAG_DOWNLOAD_BASE_URL: srv.base });
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /checksum mismatch/);
    assert.equal(fs.existsSync(path.join(dir, 'bin', 'platform', exe)), false);
  } finally { srv.close(); }
});

test('verified archive installs the binary', { skip: !supported }, async () => {
  const data = makeArchive();
  const digest = crypto.createHash('sha256').update(data).digest('hex');
  const srv = await serve({ [archive]: data, [`${archive}.sha256`]: `${digest}  ${archive}\n` });
  const dir = fixture();
  try {
    const r = await runInstall(dir, { QUDAG_DOWNLOAD_BASE_URL: srv.base });
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /Checksum verified/);
    assert.equal(fs.existsSync(path.join(dir, 'bin', 'platform', exe)), true);
  } finally { srv.close(); }
});

test('QUDAG_SKIP_BINARY_DOWNLOAD skips the download and succeeds offline', async () => {
  const dir = fixture();
  const r = await runInstall(dir, { QUDAG_SKIP_BINARY_DOWNLOAD: '1', QUDAG_DOWNLOAD_BASE_URL: 'http://127.0.0.1:9' });
  assert.equal(r.code, 0, r.out);
  assert.equal(fs.existsSync(path.join(dir, 'bin', 'platform', exe)), false);
});
