// Main entry point for @qudag/napi-core
// This file loads the appropriate platform-specific binary

const { existsSync, readFileSync } = require('fs');
const { join } = require('path');

const { platform, arch } = process;

let nativeBinding = null;
let localFileExisted = false;
let loadError = null;

function isMusl() {
  // For non-Linux platforms, we don't need to check for musl
  if (platform !== 'linux') {
    return false;
  }

  // Try to detect musl by reading the ldd output
  try {
    const output = require('child_process').execSync('ldd --version', { encoding: 'utf8' });
    return output.includes('musl');
  } catch {
    return false;
  }
}

function loadBinding() {
  let loadPath = '';

  try {
    // Try loading from local build first (for development)
    if (platform === 'darwin') {
      if (arch === 'x64') {
        loadPath = join(__dirname, 'qudag-napi-core.darwin-x64.node');
      } else if (arch === 'arm64') {
        loadPath = join(__dirname, 'qudag-napi-core.darwin-arm64.node');
      }
    } else if (platform === 'win32') {
      if (arch === 'x64') {
        loadPath = join(__dirname, 'qudag-napi-core.win32-x64-msvc.node');
      } else if (arch === 'arm64') {
        loadPath = join(__dirname, 'qudag-napi-core.win32-arm64-msvc.node');
      }
    } else if (platform === 'linux') {
      const libc = isMusl() ? 'musl' : 'gnu';
      if (arch === 'x64') {
        loadPath = join(__dirname, `qudag-napi-core.linux-x64-${libc}.node`);
      } else if (arch === 'arm64') {
        loadPath = join(__dirname, `qudag-napi-core.linux-arm64-${libc}.node`);
      }
    }

    if (loadPath && existsSync(loadPath)) {
      localFileExisted = true;
      nativeBinding = require(loadPath);
    } else {
      throw new Error(`Unsupported platform: ${platform} ${arch}`);
    }
  } catch (e) {
    loadError = e;
  }

  if (!nativeBinding) {
    if (localFileExisted) {
      throw loadError;
    } else {
      throw new Error(
        `Failed to load native binding for @qudag/napi-core.\n` +
        `Platform: ${platform} ${arch}\n` +
        `Tried loading from: ${loadPath}\n\n` +
        `Please ensure you have installed the package correctly:\n` +
        `  npm install @qudag/napi-core\n\n` +
        `If you're building from source, run:\n` +
        `  npm run build\n\n` +
        `Original error: ${loadError?.message || 'Unknown error'}`
      );
    }
  }

  return nativeBinding;
}

// Load the binding
nativeBinding = loadBinding();

// Re-export all bindings
module.exports = nativeBinding;
