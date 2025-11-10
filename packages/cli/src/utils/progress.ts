import ora, { Ora } from 'ora';

/**
 * Progress reporter for CLI operations
 */
export class ProgressReporter {
  private spinner: Ora | null = null;
  private isInteractive: boolean;
  private startTime: number = 0;
  private totalItems: number = 0;
  private processedItems: number = 0;

  constructor(isInteractive = true) {
    // Check if stdout is a TTY
    this.isInteractive = isInteractive && process.stdout.isTTY;
  }

  /**
   * Start progress reporting
   */
  start(message: string, total?: number): void {
    this.startTime = Date.now();
    this.totalItems = total || 0;
    this.processedItems = 0;

    if (this.isInteractive) {
      this.spinner = ora(message).start();
    } else {
      console.log(message);
    }
  }

  /**
   * Update progress with current status
   */
  update(message: string, processed?: number): void {
    if (processed !== undefined) {
      this.processedItems = processed;
    }

    if (this.isInteractive && this.spinner) {
      const text = this.totalItems > 0
        ? `${message} (${this.getProgressPercentage()}%)`
        : message;

      this.spinner.text = text;
    }
  }

  /**
   * Increment processed items counter
   */
  increment(count = 1): void {
    this.processedItems += count;
  }

  /**
   * Get current progress percentage
   */
  private getProgressPercentage(): number {
    if (this.totalItems === 0) return 0;
    return Math.round((this.processedItems / this.totalItems) * 100);
  }

  /**
   * Get estimated time remaining
   */
  getETA(): string {
    if (this.totalItems === 0 || this.processedItems === 0) {
      return 'Unknown';
    }

    const elapsed = Date.now() - this.startTime;
    const rate = this.processedItems / elapsed;
    const remaining = this.totalItems - this.processedItems;
    const etaMs = remaining / rate;

    return this.formatDuration(etaMs);
  }

  /**
   * Format duration in milliseconds to human-readable string
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  /**
   * Mark operation as successful
   */
  succeed(message?: string): void {
    if (this.isInteractive && this.spinner) {
      this.spinner.succeed(message);
    } else if (message) {
      console.log(`✓ ${message}`);
    }
  }

  /**
   * Mark operation as failed
   */
  fail(message?: string): void {
    if (this.isInteractive && this.spinner) {
      this.spinner.fail(message);
    } else if (message) {
      console.error(`✗ ${message}`);
    }
  }

  /**
   * Mark operation with warning
   */
  warn(message?: string): void {
    if (this.isInteractive && this.spinner) {
      this.spinner.warn(message);
    } else if (message) {
      console.warn(`⚠ ${message}`);
    }
  }

  /**
   * Stop progress reporting
   */
  stop(): void {
    if (this.isInteractive && this.spinner) {
      this.spinner.stop();
    }
  }

  /**
   * Clear spinner
   */
  clear(): void {
    if (this.isInteractive && this.spinner) {
      this.spinner.clear();
    }
  }
}

/**
 * Create a simple progress bar for non-interactive mode
 */
export function createProgressBar(current: number, total: number, width = 40): string {
  const percentage = current / total;
  const filled = Math.floor(percentage * width);
  const empty = width - filled;

  const bar = '='.repeat(filled) + '>'.repeat(filled < width ? 1 : 0) + ' '.repeat(empty);
  const percent = Math.floor(percentage * 100);

  return `[${bar}] ${percent}%`;
}
