import chalk from 'chalk';
import yaml from 'js-yaml';

export type OutputFormat = 'json' | 'yaml' | 'text' | 'binary';

export interface OutputOptions {
  format: OutputFormat;
  noColor?: boolean;
  pretty?: boolean;
}

/**
 * Format and output data to console
 */
export function formatOutput(data: any, options: OutputOptions): string {
  const { format, noColor = false, pretty = true } = options;

  switch (format) {
    case 'json':
      return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);

    case 'yaml':
      return yaml.dump(data, { indent: 2, lineWidth: 120 });

    case 'text':
      return formatAsText(data, noColor);

    case 'binary':
      // Binary format should be handled separately with protobuf
      throw new Error('Binary format must be handled with format handlers');

    default:
      return JSON.stringify(data, null, 2);
  }
}

/**
 * Format data as human-readable text
 */
function formatAsText(data: any, noColor: boolean): string {
  if (typeof data === 'string') {
    return data;
  }

  if (data.status === 'error') {
    return formatError(data, noColor);
  }

  if (data.operation) {
    return formatOperationResult(data, noColor);
  }

  // Default: format as YAML-like text
  return yaml.dump(data, { indent: 2, lineWidth: 120 });
}

/**
 * Format error output
 */
function formatError(error: any, noColor: boolean): string {
  const lines: string[] = [];

  const errorPrefix = noColor ? 'ERROR:' : chalk.red.bold('ERROR:');
  lines.push(`${errorPrefix} ${error.error?.message || error.message}`);

  if (error.error?.context) {
    lines.push(`Context: ${error.error.context}`);
  }

  if (error.error?.suggestion) {
    const suggestionLabel = noColor ? 'Suggestion:' : chalk.yellow('Suggestion:');
    lines.push(`${suggestionLabel} ${error.error.suggestion}`);
  }

  if (error.details) {
    lines.push('');
    lines.push('Details:');
    Object.entries(error.details).forEach(([key, value]) => {
      lines.push(`  ${key}: ${value}`);
    });
  }

  return lines.join('\n');
}

/**
 * Format operation result as text
 */
function formatOperationResult(result: any, noColor: boolean): string {
  const lines: string[] = [];

  // Status line
  const statusColor = result.status === 'success' ? chalk.green :
                      result.status === 'error' ? chalk.red :
                      chalk.yellow;

  const statusText = noColor ?
    `${result.operation} ${result.command}: ${result.status.toUpperCase()}` :
    statusColor.bold(`${result.operation} ${result.command}: ${result.status.toUpperCase()}`);

  lines.push(statusText);
  lines.push('');

  // Duration
  if (result.duration_ms !== undefined) {
    lines.push(`Duration: ${result.duration_ms}ms`);
  }

  // Results section
  if (result.results) {
    lines.push('');
    lines.push(noColor ? 'Results:' : chalk.cyan.bold('Results:'));
    lines.push(formatResultsTable(result.results, noColor));
  }

  // Warnings
  if (result.warnings && result.warnings.length > 0) {
    lines.push('');
    const warningLabel = noColor ? 'Warnings:' : chalk.yellow.bold('Warnings:');
    lines.push(warningLabel);
    result.warnings.forEach((warning: string) => {
      lines.push(`  - ${warning}`);
    });
  }

  // Recommendations
  if (result.recommendations && result.recommendations.length > 0) {
    lines.push('');
    const recLabel = noColor ? 'Recommendations:' : chalk.blue.bold('Recommendations:');
    lines.push(recLabel);
    result.recommendations.forEach((rec: string) => {
      lines.push(`  - ${rec}`);
    });
  }

  return lines.join('\n');
}

/**
 * Format results as a simple table
 */
function formatResultsTable(results: any, noColor: boolean): string {
  const lines: string[] = [];

  Object.entries(results).forEach(([key, value]) => {
    const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const formattedValue = formatValue(value, noColor);
    lines.push(`  ${formattedKey}: ${formattedValue}`);
  });

  return lines.join('\n');
}

/**
 * Format a single value
 */
function formatValue(value: any, noColor: boolean): string {
  if (value === null || value === undefined) {
    return noColor ? 'N/A' : chalk.gray('N/A');
  }

  if (typeof value === 'boolean') {
    return noColor ? value.toString() :
           value ? chalk.green('true') : chalk.red('false');
  }

  if (typeof value === 'number') {
    return noColor ? value.toString() : chalk.cyan(value.toString());
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return value.toString();
}

/**
 * Print success message
 */
export function printSuccess(message: string, noColor = false): void {
  const prefix = noColor ? '✓' : chalk.green('✓');
  console.log(`${prefix} ${message}`);
}

/**
 * Print error message
 */
export function printError(message: string, noColor = false): void {
  const prefix = noColor ? '✗' : chalk.red('✗');
  console.error(`${prefix} ${message}`);
}

/**
 * Print warning message
 */
export function printWarning(message: string, noColor = false): void {
  const prefix = noColor ? '⚠' : chalk.yellow('⚠');
  console.warn(`${prefix} ${message}`);
}

/**
 * Print info message
 */
export function printInfo(message: string, noColor = false): void {
  const prefix = noColor ? 'ℹ' : chalk.blue('ℹ');
  console.log(`${prefix} ${message}`);
}
