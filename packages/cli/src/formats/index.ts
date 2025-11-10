import { readFile, writeFile } from 'fs/promises';
import yaml from 'js-yaml';
import protobuf from 'protobufjs';
import { formatError } from '../utils/errors.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export type DataFormat = 'json' | 'yaml' | 'jsonl' | 'binary';

/**
 * Detect format from file extension
 */
export function detectFormat(filePath: string): DataFormat {
  const ext = filePath.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'json':
      return 'json';
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'jsonl':
      return 'jsonl';
    case 'bin':
    case 'pb':
      return 'binary';
    default:
      return 'json'; // Default to JSON
  }
}

/**
 * Load data from file with format detection
 */
export async function loadData(
  filePath: string,
  format?: DataFormat
): Promise<any> {
  const detectedFormat = format || detectFormat(filePath);
  const content = await readFile(filePath, 'utf-8');

  try {
    switch (detectedFormat) {
      case 'json':
        return JSON.parse(content);

      case 'yaml':
        return yaml.load(content);

      case 'jsonl':
        return parseJSONL(content);

      case 'binary':
        // For binary format, read as buffer
        const buffer = await readFile(filePath);
        return parseBinary(buffer);

      default:
        throw formatError(
          detectedFormat,
          `Unsupported format: ${detectedFormat}`
        );
    }
  } catch (error) {
    if (error instanceof Error) {
      throw formatError(
        detectedFormat,
        `Failed to parse ${detectedFormat}: ${error.message}`
      );
    }
    throw error;
  }
}

/**
 * Save data to file with specified format
 */
export async function saveData(
  data: any,
  filePath: string,
  format?: DataFormat
): Promise<void> {
  const detectedFormat = format || detectFormat(filePath);

  try {
    let content: string | Buffer;

    switch (detectedFormat) {
      case 'json':
        content = JSON.stringify(data, null, 2);
        break;

      case 'yaml':
        content = yaml.dump(data, { indent: 2, lineWidth: 120 });
        break;

      case 'jsonl':
        content = stringifyJSONL(data);
        break;

      case 'binary':
        content = await serializeBinary(data);
        break;

      default:
        throw formatError(
          detectedFormat,
          `Unsupported format: ${detectedFormat}`
        );
    }

    if (Buffer.isBuffer(content)) {
      await writeFile(filePath, content);
    } else {
      await writeFile(filePath, content, 'utf-8');
    }
  } catch (error) {
    if (error instanceof Error) {
      throw formatError(
        detectedFormat,
        `Failed to save ${detectedFormat}: ${error.message}`
      );
    }
    throw error;
  }
}

/**
 * Parse JSONL (JSON Lines) format
 */
function parseJSONL(content: string): any[] {
  return content
    .split('\n')
    .filter(line => line.trim().length > 0)
    .map(line => JSON.parse(line));
}

/**
 * Stringify to JSONL format
 */
function stringifyJSONL(data: any[]): string {
  if (!Array.isArray(data)) {
    throw new Error('JSONL format requires an array');
  }

  return data.map(item => JSON.stringify(item)).join('\n');
}

/**
 * Parse binary format using Protocol Buffers
 */
async function parseBinary(buffer: Buffer): Promise<any> {
  try {
    const protoPath = join(__dirname, 'dag.proto');
    const root = await protobuf.load(protoPath);
    const DagDefinition = root.lookupType('qudag.cli.DagDefinition');

    const message = DagDefinition.decode(buffer);
    return DagDefinition.toObject(message, {
      longs: String,
      enums: String,
      bytes: String,
      defaults: true,
      arrays: true,
      objects: true,
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse Protocol Buffer: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Serialize to binary format using Protocol Buffers
 */
async function serializeBinary(data: any): Promise<Buffer> {
  try {
    const protoPath = join(__dirname, 'dag.proto');
    const root = await protobuf.load(protoPath);
    const DagDefinition = root.lookupType('qudag.cli.DagDefinition');

    // Verify the data structure
    const errMsg = DagDefinition.verify(data);
    if (errMsg) {
      throw new Error(errMsg);
    }

    const message = DagDefinition.create(data);
    const buffer = DagDefinition.encode(message).finish();

    return Buffer.from(buffer);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to serialize Protocol Buffer: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Convert between formats
 */
export async function convertFormat(
  inputPath: string,
  outputPath: string,
  inputFormat?: DataFormat,
  outputFormat?: DataFormat
): Promise<void> {
  const data = await loadData(inputPath, inputFormat);
  await saveData(data, outputPath, outputFormat);
}

/**
 * Stream JSONL data (for large files)
 */
export async function* streamJSONL(filePath: string): AsyncGenerator<any> {
  const content = await readFile(filePath, 'utf-8');
  const lines = content.split('\n');

  for (const line of lines) {
    if (line.trim().length > 0) {
      yield JSON.parse(line);
    }
  }
}
