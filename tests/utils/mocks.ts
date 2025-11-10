import { vi } from 'vitest';

/**
 * Mock implementations for QuDAG N-API integration tests
 */

/**
 * Mock @qudag/napi-core module
 */
export const mockNapiCore = {
  generateMlDsaKeypair: vi.fn().mockReturnValue({
    publicKey: new Uint8Array(2544),
    secretKey: new Uint8Array(4880),
  }),

  mlDsaSign: vi.fn().mockReturnValue(new Uint8Array(2372)),

  mlDsaVerify: vi.fn().mockReturnValue(true),

  generateMlKemKeypair: vi.fn().mockReturnValue({
    publicKey: new Uint8Array(1184),
    secretKey: new Uint8Array(2400),
  }),

  mlKemEncapsulate: vi.fn().mockReturnValue({
    ciphertext: new Uint8Array(1088),
    sharedSecret: new Uint8Array(32),
  }),

  mlKemDecapsulate: vi.fn().mockReturnValue(new Uint8Array(32)),

  generateFingerprint: vi.fn().mockReturnValue(new Uint8Array(32)),

  verifyFingerprint: vi.fn().mockReturnValue(true),

  generateHqcKeypair: vi.fn().mockReturnValue({
    publicKey: new Uint8Array(2176),
    secretKey: new Uint8Array(2240),
  }),

  hqcEncrypt: vi.fn().mockReturnValue({
    ciphertext: new Uint8Array(2208),
  }),

  hqcDecrypt: vi.fn().mockReturnValue(new Uint8Array(64)),
};

/**
 * Mock QuantumDAG operations
 */
export const mockQuantumDag = {
  create: vi.fn().mockResolvedValue({
    id: 'dag-123',
    vertices: 0,
    edges: 0,
  }),

  addVertex: vi.fn().mockResolvedValue({
    id: 'vertex-123',
    timestamp: Date.now(),
  }),

  addEdge: vi.fn().mockResolvedValue({
    source: 'vertex-1',
    target: 'vertex-2',
    weight: 1,
  }),

  consensus: vi.fn().mockResolvedValue({
    round: 1,
    finalized: true,
    timestamp: Date.now(),
  }),

  tipSelection: vi.fn().mockResolvedValue({
    tips: ['tip-1', 'tip-2'],
    selected: 'tip-1',
  }),
};

/**
 * Mock CLI execution
 */
export const mockCliExec = {
  exec: vi.fn().mockResolvedValue({
    stdout: 'Command executed successfully',
    stderr: '',
    exitCode: 0,
  }),

  run: vi.fn().mockResolvedValue({
    output: 'Success',
    exitCode: 0,
  }),
};

/**
 * Mock MCP STDIO server
 */
export const mockMcpStdio = {
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
  execute: vi.fn().mockResolvedValue({
    content: [
      {
        type: 'text',
        text: 'Tool executed',
      },
    ],
  }),
  getResources: vi.fn().mockResolvedValue([
    {
      uri: 'resource://test',
      name: 'Test Resource',
      mimeType: 'application/json',
    },
  ]),
};

/**
 * Mock MCP HTTP server
 */
export const mockMcpHttp = {
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
  authenticate: vi.fn().mockResolvedValue({
    token: 'mock-token',
    expiresIn: 3600,
  }),
  authorize: vi.fn().mockResolvedValue(true),
  execute: vi.fn().mockResolvedValue({
    content: [
      {
        type: 'text',
        text: 'HTTP Tool executed',
      },
    ],
  }),
};

/**
 * Mock networking operations
 */
export const mockNetworking = {
  connectPeer: vi.fn().mockResolvedValue({
    peerId: 'peer-123',
    connected: true,
  }),
  disconnectPeer: vi.fn().mockResolvedValue(undefined),
  getPeers: vi.fn().mockResolvedValue([
    { peerId: 'peer-1', address: '127.0.0.1:8001' },
    { peerId: 'peer-2', address: '127.0.0.1:8002' },
  ]),
  broadcastMessage: vi.fn().mockResolvedValue({
    sent: 2,
    failed: 0,
  }),
};

/**
 * Mock vault operations
 */
export const mockVault = {
  create: vi.fn().mockResolvedValue({
    id: 'vault-123',
    name: 'test-vault',
  }),
  unlock: vi.fn().mockResolvedValue(undefined),
  lock: vi.fn().mockResolvedValue(undefined),
  generateKey: vi.fn().mockResolvedValue({
    keyId: 'key-123',
    algorithm: 'ml-dsa',
  }),
  deleteKey: vi.fn().mockResolvedValue(undefined),
  listKeys: vi.fn().mockResolvedValue([
    { keyId: 'key-1', algorithm: 'ml-dsa' },
    { keyId: 'key-2', algorithm: 'ml-kem' },
  ]),
};

/**
 * Create a mock with specific implementation
 */
export function createMock<T>(implementation: Partial<T>): T {
  const mock: any = {};
  for (const [key, value] of Object.entries(implementation)) {
    if (typeof value === 'function') {
      mock[key] = vi.fn(value);
    } else {
      mock[key] = value;
    }
  }
  return mock;
}

/**
 * Mock file system operations for CLI tests
 */
export const mockFileSystem = {
  readFile: vi.fn().mockResolvedValue('file content'),
  writeFile: vi.fn().mockResolvedValue(undefined),
  deleteFile: vi.fn().mockResolvedValue(undefined),
  fileExists: vi.fn().mockResolvedValue(true),
  listFiles: vi.fn().mockResolvedValue(['file1.txt', 'file2.txt']),
};

/**
 * Mock configuration loader
 */
export const mockConfigLoader = {
  load: vi.fn().mockResolvedValue({
    nodeAddress: '127.0.0.1:8080',
    peers: [],
    cryptoAlgorithm: 'ml-dsa',
  }),
  validate: vi.fn().mockResolvedValue(true),
  merge: vi.fn().mockResolvedValue({}),
};

/**
 * Mock performance monitoring
 */
export const mockPerformance = {
  measureOperation: vi.fn().mockReturnValue({
    duration: 5.5,
    memoryUsed: 1024,
  }),
  startMeasure: vi.fn().mockReturnValue('measure-1'),
  endMeasure: vi.fn().mockReturnValue({
    duration: 2.3,
  }),
};

/**
 * Mock error scenarios
 */
export const mockErrors = {
  createInvalidKeyError: () => new Error('Invalid key format'),
  createInvalidSignatureError: () => new Error('Invalid signature'),
  createTimeoutError: () => new Error('Operation timeout'),
  createNetworkError: () => new Error('Network error'),
  createConfigError: () => new Error('Configuration error'),
};

/**
 * Helper to create failing mock
 */
export function createFailingMock<T>(errorMessage: string): T {
  return new Proxy({} as T, {
    get: () => vi.fn().mockRejectedValue(new Error(errorMessage)),
  });
}

/**
 * Helper to create random delay mock
 */
export function createDelayedMock<T>(
  value: T,
  delayMs: number = 100
): () => Promise<T> {
  return () => new Promise(resolve => setTimeout(() => resolve(value), delayMs));
}

/**
 * Helper to track mock call sequences
 */
export class MockCallTracker {
  private calls: Array<{ name: string; args: any[]; timestamp: number }> = [];

  recordCall(name: string, args: any[]): void {
    this.calls.push({
      name,
      args,
      timestamp: Date.now(),
    });
  }

  getCalls(): typeof this.calls {
    return [...this.calls];
  }

  getCallSequence(): string[] {
    return this.calls.map(c => c.name);
  }

  clear(): void {
    this.calls = [];
  }

  assert(expectedSequence: string[]): boolean {
    const actual = this.getCallSequence();
    if (actual.length !== expectedSequence.length) {
      return false;
    }
    return actual.every((call, index) => call === expectedSequence[index]);
  }
}

/**
 * Setup all mocks at once
 */
export function setupAllMocks(): void {
  // Setup module mocks
  vi.mock('@qudag/napi-core', () => mockNapiCore);
  vi.mock('@qudag/dag', () => mockQuantumDag);
  vi.mock('@qudag/cli', () => mockCliExec);
  vi.mock('@qudag/mcp-stdio', () => mockMcpStdio);
  vi.mock('@qudag/mcp-http', () => mockMcpHttp);
}

/**
 * Reset all mocks
 */
export function resetAllMocks(): void {
  Object.values(mockNapiCore).forEach(mock => {
    if (typeof mock === 'object' && 'mockClear' in mock) {
      (mock as any).mockClear();
    }
  });
  Object.values(mockQuantumDag).forEach(mock => {
    if (typeof mock === 'object' && 'mockClear' in mock) {
      (mock as any).mockClear();
    }
  });
  Object.values(mockMcpStdio).forEach(mock => {
    if (typeof mock === 'object' && 'mockClear' in mock) {
      (mock as any).mockClear();
    }
  });
}
