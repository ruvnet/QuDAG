import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as path from 'node:path';

// Runtime dependencies ship to every `npm i qudag` consumer. These floors are
// the first releases outside the npm advisories that applied to qudag@1.2.1:
// tar <=7.5.20 (hardlink/symlink path traversal, critical), form-data
// 4.0.0-4.0.5 (unsafe boundary randomness, critical), axios <=1.19.0 (high),
// follow-redirects <=1.15.11 (moderate).
const floors: Record<string, string> = {
  tar: '7.5.22',
  'form-data': '4.0.6',
  axios: '1.20.0',
  'follow-redirects': '1.15.12',
};

const root = process.env.QUDAG_TEST_PACKAGE || path.resolve(__dirname, '..');

function parse(version: string): number[] {
  return version.split('-')[0].split('.').map(Number);
}

function atLeast(actual: string, floor: string): boolean {
  const a = parse(actual);
  const f = parse(floor);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== f[i]) return a[i] > f[i];
  }
  return true;
}

for (const [name, floor] of Object.entries(floors)) {
  test(`${name} resolves to >= ${floor}`, () => {
    const manifest = require.resolve(`${name}/package.json`, { paths: [root] });
    const { version } = require(manifest);
    assert.ok(atLeast(version, floor), `${name}@${version} is below ${floor}`);
  });
}
