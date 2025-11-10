/**
 * Exit codes for CLI operations
 */
export enum ExitCode {
  SUCCESS = 0,
  GENERAL_ERROR = 1,
  INVALID_ARGUMENTS = 2,
  FILE_NOT_FOUND = 3,
  PERMISSION_DENIED = 4,
  TIMEOUT = 5,
  FORMAT_ERROR = 6,
  CONFIGURATION_ERROR = 64,
  INTERNAL_ERROR = 128,
}

/**
 * CLI Error class with structured error information
 */
export class CLIError extends Error {
  constructor(
    message: string,
    public readonly code: ExitCode = ExitCode.GENERAL_ERROR,
    public readonly context?: string,
    public readonly suggestion?: string,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'CLIError';
    Error.captureStackTrace(this, CLIError);
  }

  /**
   * Convert to JSON-serializable format
   */
  toJSON(): Record<string, any> {
    return {
      status: 'error',
      error: {
        code: this.code,
        message: this.message,
        context: this.context,
        suggestion: this.suggestion,
      },
      details: this.details,
    };
  }
}

/**
 * Create error for invalid arguments
 */
export function invalidArgumentsError(
  message: string,
  suggestion?: string
): CLIError {
  return new CLIError(
    message,
    ExitCode.INVALID_ARGUMENTS,
    'Invalid command arguments',
    suggestion || 'Use --help to see available options'
  );
}

/**
 * Create error for file not found
 */
export function fileNotFoundError(
  filePath: string,
  suggestion?: string
): CLIError {
  return new CLIError(
    `File not found: ${filePath}`,
    ExitCode.FILE_NOT_FOUND,
    'File system error',
    suggestion || 'Verify the file path and try again'
  );
}

/**
 * Create error for permission denied
 */
export function permissionDeniedError(
  resource: string,
  suggestion?: string
): CLIError {
  return new CLIError(
    `Permission denied: ${resource}`,
    ExitCode.PERMISSION_DENIED,
    'Access control error',
    suggestion || 'Check file permissions or run with appropriate privileges'
  );
}

/**
 * Create error for timeout
 */
export function timeoutError(
  operation: string,
  timeoutMs: number,
  suggestion?: string
): CLIError {
  return new CLIError(
    `Operation timed out after ${timeoutMs}ms`,
    ExitCode.TIMEOUT,
    operation,
    suggestion || 'Increase timeout with --timeout or optimize the operation'
  );
}

/**
 * Create error for format errors
 */
export function formatError(
  format: string,
  message: string,
  suggestion?: string
): CLIError {
  return new CLIError(
    message,
    ExitCode.FORMAT_ERROR,
    `Invalid ${format} format`,
    suggestion || 'Check the file format and structure'
  );
}

/**
 * Create error for configuration errors
 */
export function configurationError(
  message: string,
  suggestion?: string
): CLIError {
  return new CLIError(
    message,
    ExitCode.CONFIGURATION_ERROR,
    'Configuration error',
    suggestion || 'Check your configuration file syntax and values'
  );
}

/**
 * Create error for internal errors
 */
export function internalError(
  message: string,
  details?: Record<string, any>
): CLIError {
  return new CLIError(
    message,
    ExitCode.INTERNAL_ERROR,
    'Internal error',
    'This is likely a bug. Please report it with the details below',
    details
  );
}

/**
 * Handle error and exit process
 */
export function handleError(error: unknown, verbose = false): never {
  if (error instanceof CLIError) {
    console.error(JSON.stringify(error.toJSON(), null, 2));
    process.exit(error.code);
  }

  if (error instanceof Error) {
    const cliError = new CLIError(
      error.message,
      ExitCode.INTERNAL_ERROR,
      error.name,
      'Check the error details below'
    );

    if (verbose) {
      console.error('Stack trace:');
      console.error(error.stack);
    }

    console.error(JSON.stringify(cliError.toJSON(), null, 2));
    process.exit(ExitCode.INTERNAL_ERROR);
  }

  // Unknown error type
  console.error(JSON.stringify({
    status: 'error',
    error: {
      code: ExitCode.INTERNAL_ERROR,
      message: 'An unknown error occurred',
      context: String(error),
    },
  }, null, 2));
  process.exit(ExitCode.INTERNAL_ERROR);
}

/**
 * Wrap async function with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  verbose = false
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, verbose);
    }
  }) as T;
}
