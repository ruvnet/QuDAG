import { describe, it, expect, beforeEach } from 'vitest';
import { loadConfig } from '../../src/config/loader.js';
import { createBenchmarkCommand } from '../../src/commands/benchmark.js';

describe('Benchmark Command', () => {
  let config: any;

  beforeEach(async () => {
    config = await loadConfig();
  });

  it('should create benchmark command', () => {
    const command = createBenchmarkCommand(config);
    expect(command).toBeDefined();
    expect(command.name()).toBe('benchmark');
  });

  it('should have subcommands', () => {
    const command = createBenchmarkCommand(config);
    const subcommands = command.commands.map(cmd => cmd.name());
    expect(subcommands).toContain('crypto');
    expect(subcommands).toContain('consensus');
    expect(subcommands).toContain('network');
    expect(subcommands).toContain('e2e');
  });
});
