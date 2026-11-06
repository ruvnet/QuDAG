/**
 * QuDAG NPM Package Installation Script
 * This script runs during npm install to download the appropriate binary.
 *
 * A failed download fails the install (non-zero exit). Set
 * QUDAG_SKIP_BINARY_DOWNLOAD=1 to skip the download for offline installs; the
 * binary is then fetched (and checksum-verified) on first use instead.
 */

import { ensureBinary, getPlatformInfo } from './binary-manager';
import chalk from 'chalk';

const SKIP_ENV = 'QUDAG_SKIP_BINARY_DOWNLOAD';

function skipRequested(): boolean {
  const value = (process.env[SKIP_ENV] ?? '').trim().toLowerCase();
  return value !== '' && value !== '0' && value !== 'false';
}

async function install(): Promise<void> {
  console.log(chalk.blue.bold('\n🌐 QuDAG Installation\n'));

  if (skipRequested()) {
    console.log(chalk.yellow(`${SKIP_ENV} is set: skipping the qudag binary download.`));
    console.log(chalk.gray('The binary will be downloaded and checksum-verified on first use.\n'));
    return;
  }

  // Get platform information (throws on unsupported platforms)
  const platformInfo = getPlatformInfo();
  console.log(chalk.gray('Platform Information:'));
  console.log(chalk.gray(`  OS: ${platformInfo.platform}`));
  console.log(chalk.gray(`  Architecture: ${platformInfo.arch}`));
  console.log(chalk.gray(`  Target: ${platformInfo.targetTriple}`));
  console.log(chalk.gray(`  Binary: ${platformInfo.binaryName}\n`));

  await ensureBinary();

  console.log(chalk.green.bold('\n✅ QuDAG installation completed successfully!\n'));
  console.log(chalk.gray('You can now use QuDAG with:'));
  console.log(chalk.cyan('  npx qudag --help'));
  console.log(chalk.cyan('  qudag --help') + chalk.gray(' (if installed globally)\n'));
}

// Run installation
if (require.main === module) {
  install().catch((error: any) => {
    console.error(chalk.red.bold('\n❌ qudag: failed to install the native binary:'), error?.message ?? error);
    console.error(chalk.yellow('\nThe qudag CLI cannot run without it. Options:'));
    console.error(chalk.gray('1. Check your internet connection / proxy access to github.com'));
    console.error(chalk.gray('2. Check the release assets at https://github.com/ruvnet/QuDAG/releases'));
    console.error(chalk.gray(`3. For offline installs, set ${SKIP_ENV}=1 to skip this step`));
    console.error(chalk.gray('   (the binary is then downloaded on first use)\n'));
    process.exit(1);
  });
}
