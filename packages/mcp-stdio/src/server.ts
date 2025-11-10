import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import * as schemas from './types/schemas.js';
import * as tools from './tools/index.js';
import { getResource, listResourceTemplates } from './resources/index.js';
import { formatError } from './utils/helpers.js';

/**
 * QuDAG MCP Server
 *
 * Provides quantum-resistant operations through the Model Context Protocol
 */
export class QuDagMcpServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'qudag-mcp-stdio',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'execute_quantum_dag',
            description: 'Execute quantum circuit operations on the QuDAG topology with consensus validation',
            inputSchema: {
              type: 'object',
              properties: {
                circuit: { type: 'object' },
                execution: { type: 'object' },
                consensus: { type: 'object' },
                metadata: { type: 'object' },
              },
              required: ['circuit'],
            },
          },
          {
            name: 'optimize_circuit',
            description: 'Optimize quantum circuit topology for QuDAG execution',
            inputSchema: {
              type: 'object',
              properties: {
                circuit: { type: 'object' },
                optimization: { type: 'object' },
                dag_optimization: { type: 'object' },
              },
              required: ['circuit', 'optimization'],
            },
          },
          {
            name: 'analyze_complexity',
            description: 'Analyze quantum circuit complexity and resource requirements',
            inputSchema: {
              type: 'object',
              properties: {
                circuit: { type: 'object' },
                analysis: { type: 'object' },
              },
              required: ['circuit', 'analysis'],
            },
          },
          {
            name: 'benchmark_performance',
            description: 'Benchmark quantum circuit execution performance on QuDAG',
            inputSchema: {
              type: 'object',
              properties: {
                circuit: { type: 'object' },
                benchmark: { type: 'object' },
                metrics: { type: 'object' },
              },
              required: ['circuit', 'benchmark'],
            },
          },
          {
            name: 'quantum_key_exchange',
            description: 'Perform quantum-resistant key exchange using ML-KEM',
            inputSchema: {
              type: 'object',
              properties: {
                algorithm: { type: 'string', enum: ['ml-kem-512', 'ml-kem-768', 'ml-kem-1024'] },
                role: { type: 'string', enum: ['initiator', 'responder'] },
                encapsulated_key: { type: 'string' },
                options: { type: 'object' },
                dag_storage: { type: 'object' },
              },
              required: ['algorithm', 'role'],
            },
          },
          {
            name: 'quantum_sign',
            description: 'Create quantum-resistant digital signatures using ML-DSA',
            inputSchema: {
              type: 'object',
              properties: {
                data: { type: 'string' },
                algorithm: { type: 'string', enum: ['ml-dsa-44', 'ml-dsa-65', 'ml-dsa-87'] },
                private_key: { type: 'string' },
                options: { type: 'object' },
                dag_storage: { type: 'object' },
              },
              required: ['data', 'algorithm', 'private_key'],
            },
          },
          {
            name: 'dark_address_resolve',
            description: 'Resolve .dark domain addresses to network endpoints',
            inputSchema: {
              type: 'object',
              properties: {
                address: { type: 'string' },
                options: { type: 'object' },
                network: { type: 'object' },
              },
              required: ['address'],
            },
          },
          {
            name: 'vault_quantum_store',
            description: 'Store secrets in vault with quantum-resistant encryption',
            inputSchema: {
              type: 'object',
              properties: {
                secret: { type: 'object' },
                encryption: { type: 'object' },
                access_control: { type: 'object' },
                dag_storage: { type: 'object' },
              },
              required: ['secret', 'encryption'],
            },
          },
          {
            name: 'vault_quantum_retrieve',
            description: 'Retrieve secrets from vault with quantum-resistant decryption',
            inputSchema: {
              type: 'object',
              properties: {
                entry: { type: 'object' },
                authentication: { type: 'object' },
                decryption: { type: 'object' },
              },
              required: ['entry', 'authentication'],
            },
          },
          {
            name: 'system_health_check',
            description: 'Perform comprehensive health check of QuDAG system',
            inputSchema: {
              type: 'object',
              properties: {
                components: { type: 'object' },
                depth: { type: 'string', enum: ['basic', 'detailed', 'comprehensive'] },
                performance_tests: { type: 'object' },
              },
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        let result: any;

        switch (name) {
          case 'execute_quantum_dag': {
            const input = schemas.ExecuteQuantumDagInputSchema.parse(args);
            result = await tools.executeQuantumDag(input);
            break;
          }
          case 'optimize_circuit': {
            const input = schemas.OptimizeCircuitInputSchema.parse(args);
            result = await tools.optimizeCircuit(input);
            break;
          }
          case 'analyze_complexity': {
            const input = schemas.AnalyzeComplexityInputSchema.parse(args);
            result = await tools.analyzeComplexity(input);
            break;
          }
          case 'benchmark_performance': {
            const input = schemas.BenchmarkPerformanceInputSchema.parse(args);
            result = await tools.benchmarkPerformance(input);
            break;
          }
          case 'quantum_key_exchange': {
            const input = schemas.QuantumKeyExchangeInputSchema.parse(args);
            result = await tools.quantumKeyExchange(input);
            break;
          }
          case 'quantum_sign': {
            const input = schemas.QuantumSignInputSchema.parse(args);
            result = await tools.quantumSign(input);
            break;
          }
          case 'dark_address_resolve': {
            const input = schemas.DarkAddressResolveInputSchema.parse(args);
            result = await tools.darkAddressResolve(input);
            break;
          }
          case 'vault_quantum_store': {
            const input = schemas.VaultQuantumStoreInputSchema.parse(args);
            result = await tools.vaultQuantumStore(input);
            break;
          }
          case 'vault_quantum_retrieve': {
            const input = schemas.VaultQuantumRetrieveInputSchema.parse(args);
            result = await tools.vaultQuantumRetrieve(input);
            break;
          }
          case 'system_health_check': {
            const input = schemas.SystemHealthCheckInputSchema.parse(args);
            result = await tools.systemHealthCheck(input);
            break;
          }
          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const errorInfo = formatError(error);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: errorInfo }, null, 2),
            },
          ],
          isError: true,
        };
      }
    });

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: listResourceTemplates(),
      };
    });

    // Read resource
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      try {
        const { uri } = request.params;
        const resource = getResource(uri);
        return {
          contents: [resource],
        };
      } catch (error) {
        const errorInfo = formatError(error);
        throw new Error(errorInfo.message);
      }
    });
  }

  async connect() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    // Log startup message to stderr (stdout is used for MCP protocol)
    console.error('QuDAG MCP STDIO server started');
  }

  getServer() {
    return this.server;
  }
}
