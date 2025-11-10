import { describe, it, expect, beforeEach } from 'vitest';
import { loadConfig } from '../../src/config/loader.js';
import { createAnalyzeCommand } from '../../src/commands/analyze.js';

describe('Analyze Command', () => {
  let config: any;

  beforeEach(async () => {
    config = await loadConfig();
  });

  it('should create analyze command', () => {
    const command = createAnalyzeCommand(config);
    expect(command).toBeDefined();
    expect(command.name()).toBe('analyze');
  });

  it('should have subcommands', () => {
    const command = createAnalyzeCommand(config);
    const subcommands = command.commands.map(cmd => cmd.name());
    expect(subcommands).toContain('dag');
    expect(subcommands).toContain('consensus');
    expect(subcommands).toContain('security');
    expect(subcommands).toContain('network');
  });
});
