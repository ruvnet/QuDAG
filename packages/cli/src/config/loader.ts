import { readFile, access } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import yaml from 'js-yaml';
import { QuDAGConfig, DEFAULT_CONFIG, mergeConfig, ProfileConfig } from './schema.js';
import { configurationError, fileNotFoundError } from '../utils/errors.js';

/**
 * Configuration file search paths (in order of precedence)
 */
const CONFIG_SEARCH_PATHS = [
  '.qudag-cli.json',
  '.qudag-cli.yaml',
  '.qudag-cli.yml',
  join(homedir(), '.qudag-cli', 'config.json'),
  join(homedir(), '.qudag-cli', 'config.yaml'),
  join('/etc', 'qudag-cli', 'config.json'),
];

/**
 * Load configuration from file
 */
export async function loadConfigFile(filePath: string): Promise<Partial<QuDAGConfig>> {
  try {
    await access(filePath);
  } catch {
    throw fileNotFoundError(filePath);
  }

  const content = await readFile(filePath, 'utf-8');
  const ext = filePath.split('.').pop()?.toLowerCase();

  try {
    if (ext === 'json') {
      return JSON.parse(content);
    } else if (ext === 'yaml' || ext === 'yml') {
      return yaml.load(content) as Partial<QuDAGConfig>;
    } else {
      throw configurationError(
        `Unsupported configuration format: ${ext}`,
        'Use .json or .yaml files'
      );
    }
  } catch (error) {
    if (error instanceof Error) {
      throw configurationError(
        `Failed to parse configuration file: ${error.message}`,
        'Check the file syntax and format'
      );
    }
    throw error;
  }
}

/**
 * Auto-discover configuration file
 */
export async function discoverConfigFile(): Promise<string | null> {
  for (const path of CONFIG_SEARCH_PATHS) {
    try {
      await access(path);
      return path;
    } catch {
      // File doesn't exist, try next path
      continue;
    }
  }
  return null;
}

/**
 * Load configuration with auto-discovery
 */
export async function loadConfig(
  explicitPath?: string,
  profile?: string
): Promise<QuDAGConfig> {
  let fileConfig: Partial<QuDAGConfig> = {};

  // Load from explicit path or auto-discover
  if (explicitPath) {
    fileConfig = await loadConfigFile(explicitPath);
  } else {
    const discoveredPath = await discoverConfigFile();
    if (discoveredPath) {
      fileConfig = await loadConfigFile(discoveredPath);
    }
  }

  // Load environment variable overrides
  const envConfig = loadEnvironmentConfig();

  // Merge configurations: defaults -> file -> env
  let config = mergeConfig(DEFAULT_CONFIG, fileConfig);
  config = mergeConfig(config, envConfig);

  // Apply profile if specified
  if (profile && config.profiles[profile]) {
    config = applyProfile(config, profile);
  }

  return config;
}

/**
 * Load configuration from environment variables
 */
function loadEnvironmentConfig(): Partial<QuDAGConfig> {
  const config: Partial<QuDAGConfig> = {};

  // Helper to get environment variable value
  const getEnv = (key: string): string | undefined => {
    return process.env[`QUDAG_CLI_${key}`];
  };

  // Helper to get boolean environment variable
  const getEnvBool = (key: string): boolean | undefined => {
    const value = getEnv(key);
    if (value === undefined) return undefined;
    return value === 'true' || value === '1';
  };

  // Helper to get number environment variable
  const getEnvNumber = (key: string): number | undefined => {
    const value = getEnv(key);
    if (value === undefined) return undefined;
    const num = Number(value);
    return isNaN(num) ? undefined : num;
  };

  // Global settings
  const globalConfig: Partial<QuDAGConfig['global']> = {};
  if (getEnv('FORMAT')) globalConfig.format = getEnv('FORMAT') as any;
  if (getEnvBool('VERBOSE') !== undefined) globalConfig.verbose = getEnvBool('VERBOSE')!;
  if (getEnvBool('DEBUG') !== undefined) globalConfig.debug = getEnvBool('DEBUG')!;
  if (getEnvBool('QUIET') !== undefined) globalConfig.quiet = getEnvBool('QUIET')!;
  if (getEnvBool('NO_COLOR') !== undefined) globalConfig.no_color = getEnvBool('NO_COLOR')!;
  if (getEnvNumber('TIMEOUT')) globalConfig.timeout = getEnvNumber('TIMEOUT')!;
  if (getEnv('OUTPUT_DIR')) globalConfig.output_dir = getEnv('OUTPUT_DIR')!;

  if (Object.keys(globalConfig).length > 0) {
    config.global = globalConfig as any;
  }

  // Exec settings
  const execConfig: Partial<QuDAGConfig['exec']> = {};
  if (getEnvNumber('EXEC_PARALLEL')) execConfig.chunk_size = getEnvNumber('EXEC_PARALLEL')!;
  if (getEnvBool('EXEC_VALIDATE')) execConfig.validate_on_start = getEnvBool('EXEC_VALIDATE')!;

  if (Object.keys(execConfig).length > 0) {
    config.exec = execConfig as any;
  }

  return config;
}

/**
 * Apply a named profile to configuration
 */
function applyProfile(config: QuDAGConfig, profileName: string): QuDAGConfig {
  const profile = config.profiles[profileName];
  if (!profile) {
    throw configurationError(
      `Profile not found: ${profileName}`,
      'Check available profiles with: qudag config profile list'
    );
  }

  // Apply profile overrides to global config
  const updatedConfig = { ...config };

  if (profile.parallel !== undefined) {
    updatedConfig.exec = { ...updatedConfig.exec, chunk_size: profile.parallel };
  }
  if (profile.timeout !== undefined) {
    updatedConfig.global = { ...updatedConfig.global, timeout: profile.timeout };
  }
  if (profile.format !== undefined) {
    updatedConfig.global = { ...updatedConfig.global, format: profile.format as any };
  }
  if (profile.verbose !== undefined) {
    updatedConfig.global = { ...updatedConfig.global, verbose: profile.verbose };
  }
  if (profile.debug !== undefined) {
    updatedConfig.global = { ...updatedConfig.global, debug: profile.debug };
  }
  if (profile.quiet !== undefined) {
    updatedConfig.global = { ...updatedConfig.global, quiet: profile.quiet };
  }

  return updatedConfig;
}

/**
 * Validate configuration
 */
export function validateConfig(config: QuDAGConfig): void {
  // Validate global settings
  if (config.global.timeout < 0) {
    throw configurationError('Timeout must be a positive number');
  }

  // Validate DAG settings
  if (config.dag.byzantine_fault_tolerance < 0 || config.dag.byzantine_fault_tolerance > 1) {
    throw configurationError('Byzantine fault tolerance must be between 0 and 1');
  }

  if (config.dag.consensus_threshold < 0 || config.dag.consensus_threshold > 1) {
    throw configurationError('Consensus threshold must be between 0 and 1');
  }

  // Validate performance settings
  if (config.performance.worker_threads < 1) {
    throw configurationError('Worker threads must be at least 1');
  }

  if (config.performance.max_memory_mb < 128) {
    throw configurationError('Max memory must be at least 128MB');
  }
}
