import { describe, it, expect } from 'vitest';
import { loadConfig, validateConfig } from '../src/config/loader.js';
import { DEFAULT_CONFIG } from '../src/config/schema.js';

describe('CLI Configuration', () => {
  it('should load default configuration', async () => {
    const config = await loadConfig();
    expect(config).toBeDefined();
    expect(config.global).toBeDefined();
    expect(config.global.format).toBe('json');
  });

  it('should validate valid configuration', () => {
    expect(() => validateConfig(DEFAULT_CONFIG)).not.toThrow();
  });

  it('should reject invalid timeout', () => {
    const invalidConfig = { ...DEFAULT_CONFIG };
    invalidConfig.global.timeout = -1;
    expect(() => validateConfig(invalidConfig)).toThrow();
  });

  it('should reject invalid Byzantine fault tolerance', () => {
    const invalidConfig = { ...DEFAULT_CONFIG };
    invalidConfig.dag.byzantine_fault_tolerance = 1.5;
    expect(() => validateConfig(invalidConfig)).toThrow();
  });

  it('should apply profile overrides', async () => {
    const config = await loadConfig(undefined, 'production');
    // Production profile should have higher timeout
    expect(config.global.timeout).toBeGreaterThan(DEFAULT_CONFIG.global.timeout);
  });
});

describe('CLI Error Handling', () => {
  it('should create proper error codes', async () => {
    const { invalidArgumentsError, ExitCode } = await import('../src/utils/errors.js');
    const error = invalidArgumentsError('test message');
    expect(error.code).toBe(ExitCode.INVALID_ARGUMENTS);
    expect(error.message).toBe('test message');
  });

  it('should format error as JSON', async () => {
    const { CLIError, ExitCode } = await import('../src/utils/errors.js');
    const error = new CLIError('test', ExitCode.GENERAL_ERROR, 'context', 'suggestion');
    const json = error.toJSON();
    expect(json.status).toBe('error');
    expect(json.error.message).toBe('test');
    expect(json.error.context).toBe('context');
  });
});

describe('Format Detection', () => {
  it('should detect JSON format', async () => {
    const { detectFormat } = await import('../src/formats/index.js');
    expect(detectFormat('test.json')).toBe('json');
  });

  it('should detect YAML format', async () => {
    const { detectFormat } = await import('../src/formats/index.js');
    expect(detectFormat('test.yaml')).toBe('yaml');
    expect(detectFormat('test.yml')).toBe('yaml');
  });

  it('should detect JSONL format', async () => {
    const { detectFormat } = await import('../src/formats/index.js');
    expect(detectFormat('test.jsonl')).toBe('jsonl');
  });

  it('should detect binary format', async () => {
    const { detectFormat } = await import('../src/formats/index.js');
    expect(detectFormat('test.bin')).toBe('binary');
    expect(detectFormat('test.pb')).toBe('binary');
  });

  it('should default to JSON for unknown extensions', async () => {
    const { detectFormat } = await import('../src/formats/index.js');
    expect(detectFormat('test.unknown')).toBe('json');
  });
});

describe('Output Formatting', () => {
  it('should format JSON output', async () => {
    const { formatOutput } = await import('../src/utils/output.js');
    const data = { test: 'value' };
    const output = formatOutput(data, { format: 'json', pretty: true });
    expect(output).toContain('"test"');
    expect(output).toContain('"value"');
  });

  it('should format YAML output', async () => {
    const { formatOutput } = await import('../src/utils/output.js');
    const data = { test: 'value' };
    const output = formatOutput(data, { format: 'yaml' });
    expect(output).toContain('test:');
    expect(output).toContain('value');
  });

  it('should throw error for binary format', async () => {
    const { formatOutput } = await import('../src/utils/output.js');
    const data = { test: 'value' };
    expect(() => formatOutput(data, { format: 'binary' })).toThrow();
  });
});

describe('Progress Reporter', () => {
  it('should create progress reporter', async () => {
    const { ProgressReporter } = await import('../src/utils/progress.js');
    const reporter = new ProgressReporter(false);
    expect(reporter).toBeDefined();
  });

  it('should handle non-interactive mode', async () => {
    const { ProgressReporter } = await import('../src/utils/progress.js');
    const reporter = new ProgressReporter(false);
    reporter.start('Test');
    reporter.update('Update');
    reporter.succeed('Success');
    // Should not throw in non-interactive mode
    expect(true).toBe(true);
  });

  it('should format durations correctly', async () => {
    const { ProgressReporter } = await import('../src/utils/progress.js');
    const reporter = new ProgressReporter(false);
    reporter.start('Test', 100);
    reporter.increment(50);
    const eta = reporter.getETA();
    expect(eta).toBeDefined();
  });
});
