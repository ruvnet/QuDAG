/**
 * Configuration schema definitions and defaults
 */

export interface GlobalConfig {
  format: 'json' | 'yaml' | 'text' | 'binary';
  verbose: boolean;
  debug: boolean;
  quiet: boolean;
  no_color: boolean;
  timeout: number;
  output_dir: string;
}

export interface ProfileConfig {
  parallel?: number;
  continue_on_error?: boolean;
  keep_temp?: boolean;
  timeout?: number;
  format?: string;
  verbose?: boolean;
  debug?: boolean;
  quiet?: boolean;
}

export interface ExecConfig {
  default_strategy: string;
  validate_on_start: boolean;
  stream_enabled: boolean;
  chunk_size: number;
  max_batch_size: number;
}

export interface OptimizeConfig {
  simulation_enabled: boolean;
  default_strategy: string;
  max_iterations: number;
  comparison_enabled: boolean;
  report_detailed: boolean;
}

export interface AnalyzeConfig {
  default_metrics: string;
  comprehensive_by_default: boolean;
  temporal_analysis: boolean;
  visualization_format: string;
  anomaly_threshold: number;
}

export interface BenchmarkConfig {
  default_mode: 'quick' | 'full';
  warmup_iterations: number;
  min_samples: number;
  regression_threshold: number;
  graph_generation: boolean;
}

export interface CryptoConfig {
  kem_algorithm: string;
  signature_algorithm: string;
  hash_algorithm: string;
}

export interface DAGConfig {
  consensus_algorithm: string;
  byzantine_fault_tolerance: number;
  consensus_threshold: number;
  finality_threshold: number;
  max_vertices: number;
}

export interface NetworkConfig {
  bootstrap_nodes: string[];
  default_peers: number;
  peer_discovery_enabled: boolean;
  peer_discovery_interval: number;
}

export interface PerformanceConfig {
  worker_threads: number;
  max_memory_mb: number;
  cache_enabled: boolean;
  cache_size_mb: number;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'text' | 'json';
  output: 'console' | 'file' | 'both';
  file: string;
  file_rotation: 'daily' | 'size';
  file_retention_days: number;
}

export interface SecurityConfig {
  enable_memory_protection: boolean;
  enable_constant_time: boolean;
  tls_enabled: boolean;
  tls_verify: boolean;
}

export interface QuDAGConfig {
  global: GlobalConfig;
  profiles: Record<string, ProfileConfig>;
  exec: ExecConfig;
  optimize: OptimizeConfig;
  analyze: AnalyzeConfig;
  benchmark: BenchmarkConfig;
  crypto: CryptoConfig;
  dag: DAGConfig;
  network: NetworkConfig;
  performance: PerformanceConfig;
  logging: LoggingConfig;
  security: SecurityConfig;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: QuDAGConfig = {
  global: {
    format: 'json',
    verbose: false,
    debug: false,
    quiet: false,
    no_color: false,
    timeout: 30000,
    output_dir: './output',
  },
  profiles: {
    default: {
      parallel: 1,
      continue_on_error: false,
      keep_temp: false,
    },
    production: {
      parallel: 8,
      continue_on_error: false,
      keep_temp: false,
      timeout: 60000,
    },
    development: {
      parallel: 1,
      continue_on_error: true,
      keep_temp: true,
      verbose: true,
      debug: true,
    },
    ci_cd: {
      parallel: 4,
      format: 'json',
      quiet: true,
      timeout: 120000,
    },
  },
  exec: {
    default_strategy: 'balanced',
    validate_on_start: true,
    stream_enabled: false,
    chunk_size: 100,
    max_batch_size: 10000,
  },
  optimize: {
    simulation_enabled: true,
    default_strategy: 'balanced',
    max_iterations: 1000,
    comparison_enabled: true,
    report_detailed: true,
  },
  analyze: {
    default_metrics: 'all',
    comprehensive_by_default: false,
    temporal_analysis: true,
    visualization_format: 'ascii',
    anomaly_threshold: 2.0,
  },
  benchmark: {
    default_mode: 'quick',
    warmup_iterations: 100,
    min_samples: 1000,
    regression_threshold: 5.0,
    graph_generation: false,
  },
  crypto: {
    kem_algorithm: 'ML-KEM-768',
    signature_algorithm: 'ML-DSA',
    hash_algorithm: 'BLAKE3',
  },
  dag: {
    consensus_algorithm: 'qr-avalanche',
    byzantine_fault_tolerance: 0.33,
    consensus_threshold: 0.67,
    finality_threshold: 0.9,
    max_vertices: 100000,
  },
  network: {
    bootstrap_nodes: [],
    default_peers: 50,
    peer_discovery_enabled: true,
    peer_discovery_interval: 300,
  },
  performance: {
    worker_threads: 4,
    max_memory_mb: 4096,
    cache_enabled: true,
    cache_size_mb: 512,
  },
  logging: {
    level: 'info',
    format: 'text',
    output: 'console',
    file: '/var/log/qudag-cli.log',
    file_rotation: 'daily',
    file_retention_days: 7,
  },
  security: {
    enable_memory_protection: true,
    enable_constant_time: true,
    tls_enabled: false,
    tls_verify: true,
  },
};

/**
 * Merge configurations with precedence
 */
export function mergeConfig(
  base: Partial<QuDAGConfig>,
  override: Partial<QuDAGConfig>
): QuDAGConfig {
  return {
    global: { ...DEFAULT_CONFIG.global, ...base.global, ...override.global },
    profiles: { ...DEFAULT_CONFIG.profiles, ...base.profiles, ...override.profiles },
    exec: { ...DEFAULT_CONFIG.exec, ...base.exec, ...override.exec },
    optimize: { ...DEFAULT_CONFIG.optimize, ...base.optimize, ...override.optimize },
    analyze: { ...DEFAULT_CONFIG.analyze, ...base.analyze, ...override.analyze },
    benchmark: { ...DEFAULT_CONFIG.benchmark, ...base.benchmark, ...override.benchmark },
    crypto: { ...DEFAULT_CONFIG.crypto, ...base.crypto, ...override.crypto },
    dag: { ...DEFAULT_CONFIG.dag, ...base.dag, ...override.dag },
    network: { ...DEFAULT_CONFIG.network, ...base.network, ...override.network },
    performance: { ...DEFAULT_CONFIG.performance, ...base.performance, ...override.performance },
    logging: { ...DEFAULT_CONFIG.logging, ...base.logging, ...override.logging },
    security: { ...DEFAULT_CONFIG.security, ...base.security, ...override.security },
  };
}
