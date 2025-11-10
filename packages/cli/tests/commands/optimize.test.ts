import { describe, it, expect, beforeEach } from 'vitest';
import { loadConfig } from '../../src/config/loader.js';
import { createOptimizeCommand } from '../../src/commands/optimize.js';

describe('Optimize Command', () => {
  let config: any;

  beforeEach(async () => {
    config = await loadConfig();
  });

  it('should create optimize command', () => {
    const command = createOptimizeCommand(config);
    expect(command).toBeDefined();
    expect(command.name()).toBe('optimize');
  });

  it('should have subcommands', () => {
    const command = createOptimizeCommand(config);
    const subcommands = command.commands.map(cmd => cmd.name());
    expect(subcommands).toContain('dag');
    expect(subcommands).toContain('consensus');
    expect(subcommands).toContain('network');
    expect(subcommands).toContain('cost');
  });
});
