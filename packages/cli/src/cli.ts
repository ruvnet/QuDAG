#!/usr/bin/env node

import { Command } from 'commander';
import { loadConfig, validateConfig } from './config/loader.js';
import { createExecCommand } from './commands/exec.js';
import { createOptimizeCommand } from './commands/optimize.js';
import { createAnalyzeCommand } from './commands/analyze.js';
import { createBenchmarkCommand } from './commands/benchmark.js';
import { handleError } from './utils/errors.js';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get package version
 */
async function getVersion(): Promise<string> {
  try {
    const packageJsonPath = join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
    return packageJson.version || '0.1.0';
  } catch {
    return '0.1.0';
  }
}

/**
 * Main CLI function
 */
async function main(): Promise<void> {
  const version = await getVersion();

  // Create main program
  const program = new Command();

  program
    .name('qudag')
    .description('Command-line interface for QuDAG quantum-resistant DAG operations')
    .version(version, '-v, --version', 'Output the current version')
    .option('--config <path>', 'Path to configuration file')
    .option('--format <format>', 'Output format: json|yaml|text|binary')
    .option('--profile <name>', 'Use named configuration profile')
    .option('--verbose', 'Enable verbose logging')
    .option('--debug', 'Enable debug mode')
    .option('--quiet', 'Suppress all output except results')
    .option('--no-color', 'Disable colored output')
    .option('--timeout <ms>', 'Operation timeout in milliseconds', parseInt)
    .option('--output <path>', 'Save output to file');

  // Parse global options first to get config path and profile
  program.parse(process.argv);
  const globalOptions = program.opts();

  try {
    // Load configuration
    const config = await loadConfig(globalOptions.config, globalOptions.profile);

    // Apply command-line overrides to config
    if (globalOptions.format) config.global.format = globalOptions.format;
    if (globalOptions.verbose !== undefined) config.global.verbose = globalOptions.verbose;
    if (globalOptions.debug !== undefined) config.global.debug = globalOptions.debug;
    if (globalOptions.quiet !== undefined) config.global.quiet = globalOptions.quiet;
    if (globalOptions.noColor !== undefined) config.global.no_color = globalOptions.noColor;
    if (globalOptions.timeout) config.global.timeout = globalOptions.timeout;

    // Validate configuration
    validateConfig(config);

    // Create command hierarchy
    const execCommand = createExecCommand(config);
    const optimizeCommand = createOptimizeCommand(config);
    const analyzeCommand = createAnalyzeCommand(config);
    const benchmarkCommand = createBenchmarkCommand(config);

    // Add commands to program
    program.addCommand(execCommand);
    program.addCommand(optimizeCommand);
    program.addCommand(analyzeCommand);
    program.addCommand(benchmarkCommand);

    // Add config management command
    const configCommand = new Command('config')
      .description('Configuration management')
      .addCommand(
        new Command('show')
          .description('Show current configuration')
          .option('--section <name>', 'Show specific section')
          .action(async (options) => {
            const section = options.section;
            const output = section ? config[section as keyof typeof config] : config;
            console.log(JSON.stringify(output, null, 2));
          })
      )
      .addCommand(
        new Command('validate')
          .description('Validate configuration')
          .option('--config <path>', 'Configuration file to validate')
          .action(async (options) => {
            const configToValidate = options.config
              ? await loadConfig(options.config)
              : config;
            validateConfig(configToValidate);
            console.log('✓ Configuration is valid');
          })
      );

    program.addCommand(configCommand);

    // Parse command-line arguments
    await program.parseAsync(process.argv);

    // Show help if no command specified
    if (!process.argv.slice(2).length) {
      program.outputHelp();
    }
  } catch (error) {
    handleError(error, globalOptions.debug || globalOptions.verbose);
  }
}

// Run main function
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
