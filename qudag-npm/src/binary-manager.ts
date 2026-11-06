import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import axios from 'axios';
import * as tar from 'tar';
import ProgressBar from 'progress';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { platform as getPlatform, arch as getArch } from 'os';

// Binary version - dynamically read from package.json to stay in sync
import { version as PKG_VERSION } from '../package.json';
const BINARY_VERSION = `v${PKG_VERSION}`;
const GITHUB_REPO = 'ruvnet/QuDAG';

/**
 * Base URL the release archives are fetched from. Overridable with
 * QUDAG_DOWNLOAD_BASE_URL (a mirror that serves the same file layout as
 * `https://github.com/ruvnet/QuDAG/releases/download`); the checksum is still
 * enforced against the mirror's `.sha256` sidecar.
 */
function getDownloadBaseUrl(): string {
  const override = process.env.QUDAG_DOWNLOAD_BASE_URL;
  const base = override && override.trim() !== ''
    ? override.trim()
    : `https://github.com/${GITHUB_REPO}/releases/download`;
  return base.replace(/\/+$/, '');
}

// Release targets built by .github/workflows/release.yml. Keep in sync.
const SUPPORTED_TARGETS = new Set([
  'x86_64-unknown-linux-gnu',
  'aarch64-unknown-linux-gnu',
  'x86_64-apple-darwin',
  'aarch64-apple-darwin',
  'x86_64-pc-windows-msvc'
]);

// Platform mapping
const PLATFORM_MAP: Record<string, string> = {
  darwin: 'apple-darwin',
  linux: 'unknown-linux-gnu',
  win32: 'pc-windows-msvc'
};

// Architecture mapping
const ARCH_MAP: Record<string, string> = {
  x64: 'x86_64',
  arm64: 'aarch64'
};

/**
 * Get the platform-specific binary name
 */
function getBinaryName(): string {
  return getPlatform() === 'win32' ? 'qudag.exe' : 'qudag';
}

/**
 * Get the target triple for the current platform
 */
function getTargetTriple(): string {
  const platform = getPlatform();
  const arch = getArch();

  const mappedPlatform = PLATFORM_MAP[platform];
  const mappedArch = ARCH_MAP[arch];
  const triple = mappedPlatform && mappedArch ? `${mappedArch}-${mappedPlatform}` : '';

  if (!SUPPORTED_TARGETS.has(triple)) {
    throw new Error(
      `Unsupported platform: ${platform}-${arch}. Prebuilt qudag binaries exist for ` +
      `linux-x64, linux-arm64, darwin-x64, darwin-arm64 and win32-x64. ` +
      `Build from source instead: cargo install --git https://github.com/${GITHUB_REPO} qudag-cli`
    );
  }

  return triple;
}

/**
 * Get the binary directory path
 */
function getBinaryDir(): string {
  return path.join(__dirname, '..', 'bin', 'platform');
}

/**
 * Get the binary path for the current platform
 */
export function getBinaryPath(): string {
  const binaryDir = getBinaryDir();
  const binaryName = getBinaryName();
  return path.join(binaryDir, binaryName);
}

/**
 * Check if the binary is already installed
 */
function isBinaryInstalled(): boolean {
  const binaryPath = getBinaryPath();
  return fs.existsSync(binaryPath);
}

/**
 * Parse a `sha256sum`-style checksum file (`<hex>  <name>`) and return the
 * lowercase hex digest. Throws if no 64-hex-digit digest is present.
 */
export function parseChecksum(contents: string): string {
  const match = /^\s*([0-9a-fA-F]{64})\b/.exec(contents);
  if (!match) {
    throw new Error('checksum file does not contain a SHA-256 digest');
  }
  return match[1].toLowerCase();
}

/**
 * Compute the lowercase hex SHA-256 digest of a file.
 */
export async function sha256File(file: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  await pipeline(fs.createReadStream(file), hash);
  return hash.digest('hex');
}

function describeHttpError(error: any, url: string): Error {
  const status = error?.response?.status;
  if (status === 404) {
    return new Error(
      `${url} returned 404: no qudag ${BINARY_VERSION} release asset exists for this platform. ` +
      `Check https://github.com/${GITHUB_REPO}/releases/tag/${BINARY_VERSION}`
    );
  }
  if (status) {
    return new Error(`${url} returned HTTP ${status}`);
  }
  return new Error(`could not download ${url}: ${error?.message ?? error}`);
}

/**
 * Download the binary for the current platform, verify its SHA-256 checksum
 * against the release's `.sha256` sidecar, and install it atomically.
 */
async function downloadBinary(): Promise<void> {
  const targetTriple = getTargetTriple();
  const binaryName = getBinaryName();
  const archiveName = `qudag-${BINARY_VERSION}-${targetTriple}.tar.gz`;
  const downloadUrl = `${getDownloadBaseUrl()}/${BINARY_VERSION}/${archiveName}`;
  const checksumUrl = `${downloadUrl}.sha256`;

  console.log(`Downloading QuDAG binary for ${targetTriple}...`);
  console.log(`URL: ${downloadUrl}`);

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qudag-download-'));
  try {
    // Expected checksum first: a missing sidecar fails before the large download.
    let expected: string;
    try {
      const res = await axios.get(checksumUrl, {
        responseType: 'text',
        timeout: 30000,
        headers: { 'User-Agent': 'qudag-npm' }
      });
      expected = parseChecksum(String(res.data));
    } catch (error: any) {
      if (error?.response || error?.request) throw describeHttpError(error, checksumUrl);
      throw new Error(`invalid checksum file ${checksumUrl}: ${error.message}`);
    }

    const archivePath = path.join(workDir, archiveName);
    let response;
    try {
      response = await axios({
        method: 'get',
        url: downloadUrl,
        responseType: 'stream',
        timeout: 30000,
        headers: { 'User-Agent': 'qudag-npm' }
      });
    } catch (error: any) {
      throw describeHttpError(error, downloadUrl);
    }

    const totalLength = parseInt(String(response.headers['content-length'] ?? '0'), 10);
    if (totalLength > 0 && process.stderr.isTTY) {
      const progressBar = new ProgressBar('Downloading [:bar] :percent :etas', {
        width: 40,
        complete: '=',
        incomplete: ' ',
        renderThrottle: 100,
        total: totalLength
      });
      response.data.on('data', (chunk: Buffer) => progressBar.tick(chunk.length));
    }
    await pipeline(response.data, createWriteStream(archivePath));

    const actual = await sha256File(archivePath);
    if (actual !== expected) {
      throw new Error(
        `checksum mismatch for ${archiveName}: expected ${expected}, got ${actual}. ` +
        `The download is corrupt or was tampered with; nothing was installed.`
      );
    }
    console.log(`Checksum verified (sha256 ${actual})`);

    // Extract into the temp dir, then move the single binary into place.
    const extractDir = path.join(workDir, 'extract');
    await fs.ensureDir(extractDir);
    await tar.extract({
      file: archivePath,
      cwd: extractDir,
      filter: (entry) => path.basename(entry) === binaryName
    });
    const extracted = path.join(extractDir, binaryName);
    if (!fs.existsSync(extracted)) {
      throw new Error(`${archiveName} does not contain ${binaryName}`);
    }
    if (getPlatform() !== 'win32') {
      await fs.chmod(extracted, 0o755);
    }

    const binaryDir = getBinaryDir();
    await fs.ensureDir(binaryDir);
    const staged = path.join(binaryDir, `.${binaryName}.${process.pid}.tmp`);
    await fs.copy(extracted, staged, { overwrite: true });
    await fs.move(staged, getBinaryPath(), { overwrite: true });

    console.log('QuDAG binary installed successfully!');
  } finally {
    await fs.remove(workDir).catch(() => undefined);
  }
}

/**
 * Ensure the binary is installed, downloading if necessary
 */
export async function ensureBinary(): Promise<void> {
  if (!isBinaryInstalled()) {
    await downloadBinary();
  }
}

/**
 * Get information about the current platform
 */
export function getPlatformInfo(): {
  platform: string;
  arch: string;
  targetTriple: string;
  binaryName: string;
  binaryPath: string;
} {
  return {
    platform: getPlatform(),
    arch: getArch(),
    targetTriple: getTargetTriple(),
    binaryName: getBinaryName(),
    binaryPath: getBinaryPath()
  };
}
