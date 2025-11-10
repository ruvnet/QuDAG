import { describe, it, expect, beforeEach } from 'vitest';
import { loadConfig } from '../../src/config/loader.js';
import { createExecCommand } from '../../src/commands/exec.js';

describe('Exec Command', () => {
  let config: any;

  beforeEach(async () => {
    config = await loadConfig();
  });

  it('should create exec command', () => {
    const command = createExecCommand(config);
    expect(command).toBeDefined();
    expect(command.name()).toBe('exec');
  });

  it('should have required options', () => {
    const command = createExecCommand(config);
    const options = command.options.map(opt => opt.long);
    expect(options).toContain('--input');
    expect(options).toContain('--output');
    expect(options).toContain('--validate');
  });

  it('should have subcommands', () => {
    const command = createExecCommand(config);
    const subcommands = command.commands.map(cmd => cmd.name());
    expect(subcommands).toContain('vertex');
    expect(subcommands).toContain('consensus');
    expect(subcommands).toContain('message');
    expect(subcommands).toContain('transaction');
  });
});
