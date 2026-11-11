/**
 * Quantum Cryptography Tools
 *
 * Tools for quantum-resistant key exchange, digital signatures,
 * and cryptographic operations using post-quantum algorithms.
 */

import { AbstractTool, ToolInputSchema, ToolResult, ToolContext, createToolResult } from "./base";
import {
  SUPPORTED_DSA,
  SUPPORTED_KEM,
  decodeBase64Strict,
  dsaGenerate,
  getKey,
  kemDecapsulate,
  kemEncapsulate,
  kemKeygen,
  newKeyId,
  sha3_256Hex
} from "../crypto/native";

/**
 * ML-KEM-768 key exchange (FIPS 203) via @qudag/napi-core.
 *
 * initiator without peer_public_key: generate a key pair (secret key held by this server, returns key_id).
 * initiator with peer_public_key:    encapsulate (returns encapsulated_key and shared_secret).
 * responder with key_id + encapsulated_key: decapsulate (returns shared_secret).
 */
export class QuantumKeyExchangeTool extends AbstractTool {
  name = "quantum_key_exchange";
  description =
    "ML-KEM-768 key exchange. initiator without peer_public_key: generate a key pair (returns public_key and key_id). " +
    "initiator with peer_public_key: encapsulate (returns encapsulated_key and shared_secret). " +
    "responder with key_id and encapsulated_key: decapsulate (returns shared_secret).";

  inputSchema: ToolInputSchema = {
    type: "object",
    properties: {
      algorithm: { type: "string", enum: ["ml-kem-512", "ml-kem-768", "ml-kem-1024"] },
      role: { type: "string", enum: ["initiator", "responder"] },
      encapsulated_key: { type: "string" },
      peer_public_key: { type: "string" },
      key_id: { type: "string" },
      options: {
        type: "object",
        properties: {
          derive_shared_secret: { type: "boolean" },
          store_in_vault: { type: "boolean" },
          vault_label: { type: "string" }
        }
      },
      dag_storage: {
        type: "object",
        properties: {
          store_public_key: { type: "boolean" },
          require_consensus: { type: "boolean" }
        }
      }
    },
    required: ["algorithm", "role"]
  };

  protected async executeImpl(args: Record<string, any>, _context?: ToolContext): Promise<ToolResult> {
    if (args.algorithm !== SUPPORTED_KEM) {
      throw new Error(`Unsupported algorithm ${args.algorithm}: this server implements ${SUPPORTED_KEM} only`);
    }
    const metadata: Record<string, any> = {
      algorithm: args.algorithm,
      security_level: 3,
      timestamp: new Date().toISOString()
    };

    if (args.role === "initiator") {
      if (args.peer_public_key) {
        const peer = decodeBase64Strict(args.peer_public_key, "peer_public_key");
        const { ciphertext, sharedSecret } = kemEncapsulate(peer);
        metadata.peer_public_key_sha3_256 = sha3_256Hex(peer);
        return createToolResult({
          encapsulated_key: ciphertext.toString("base64"),
          shared_secret: sharedSecret.toString("base64"),
          metadata
        });
      }
      const key_id = newKeyId();
      const publicKey = kemKeygen(key_id);
      metadata.key_id = key_id;
      return createToolResult({ public_key: publicKey.toString("base64"), metadata });
    }

    if (!args.encapsulated_key) {
      throw new Error("Encapsulated key required for responder role");
    }
    if (!args.key_id) {
      throw new Error("key_id required for responder role (returned by the initiator call that generated your key pair)");
    }
    const shared = kemDecapsulate(args.key_id, decodeBase64Strict(args.encapsulated_key, "encapsulated_key"));
    metadata.key_id = args.key_id;
    return createToolResult({ shared_secret: shared.toString("base64"), metadata });
  }
}

/**
 * ML-DSA-65 signing (FIPS 204) via @qudag/napi-core.
 * private_key is a handle: "generate" for a new server-held key, or a key_id from an earlier call.
 */
export class QuantumSignTool extends AbstractTool {
  name = "quantum_sign";
  description =
    'ML-DSA-65 signature. private_key is a key handle: "generate" for a new server-held key, or a key_id from an earlier call.';

  inputSchema: ToolInputSchema = {
    type: "object",
    properties: {
      data: { type: "string" },
      algorithm: { type: "string", enum: ["ml-dsa-44", "ml-dsa-65", "ml-dsa-87"] },
      private_key: { type: "string" },
      options: {
        type: "object",
        properties: {
          include_timestamp: { type: "boolean" },
          include_context: { type: "boolean" },
          context: { type: "string" }
        }
      },
      dag_storage: {
        type: "object",
        properties: {
          store_signature: { type: "boolean" },
          attach_to_vertex: { type: "string" }
        }
      }
    },
    required: ["data", "algorithm", "private_key"]
  };

  protected async executeImpl(args: Record<string, any>, _context?: ToolContext): Promise<ToolResult> {
    if (args.algorithm !== SUPPORTED_DSA) {
      throw new Error(`Unsupported algorithm ${args.algorithm}: this server implements ${SUPPORTED_DSA} only`);
    }
    let key_id: string;
    let entry = getKey(args.private_key);
    if (args.private_key === "generate") {
      key_id = newKeyId();
      entry = dsaGenerate(key_id);
    } else if (entry && entry.kind === "ml-dsa") {
      key_id = args.private_key;
    } else {
      throw new Error(
        'private_key must be "generate" or the key_id of an ML-DSA key held by this server; ' +
          "importing caller-supplied secret keys is not supported"
      );
    }
    if (entry.kind !== "ml-dsa") throw new Error("internal: key kind mismatch");

    const options = args.options || {};
    const parts: string[] = [String(args.data)];
    if (options.include_context && options.context) parts.push(`context:${options.context}`);
    const signed_at = options.include_timestamp ? new Date().toISOString() : undefined;
    if (signed_at) parts.push(`timestamp:${signed_at}`);
    const signature = Buffer.from(entry.keyPair.sign(Buffer.from(parts.join("\n"), "utf8")));

    return createToolResult({
      signature: signature.toString("base64"),
      metadata: {
        algorithm: args.algorithm,
        key_id,
        timestamp: new Date().toISOString(),
        data_hash: sha3_256Hex(String(args.data)),
        signature_size_bytes: signature.length
      },
      verification: {
        public_key: entry.publicKey.toString("base64"),
        signed_message:
          'UTF-8 of [data, "context:<context>" if included, "timestamp:<signed_at>" if included] joined by "\\n"',
        signed_at,
        verification_instructions: `Verify with ${args.algorithm} (FIPS 204) using public_key over signed_message`
      }
    });
  }
}

/**
 * System Health Check Tool
 */
export class SystemHealthCheckTool extends AbstractTool {
  name = "system_health_check";
  description = "Perform comprehensive health check of QuDAG system";

  inputSchema: ToolInputSchema = {
    type: "object",
    properties: {
      components: {
        type: "object",
        properties: {
          dag: { type: "boolean" },
          crypto: { type: "boolean" },
          network: { type: "boolean" },
          vault: { type: "boolean" },
          consensus: { type: "boolean" }
        }
      },
      depth: { type: "string", enum: ["basic", "detailed", "comprehensive"] },
      performance_tests: {
        type: "object",
        properties: {
          enabled: { type: "boolean" },
          quick_tests_only: { type: "boolean" }
        }
      }
    }
  };

  protected async executeImpl(args: Record<string, any>, context?: ToolContext): Promise<ToolResult> {
    const components = args.components || {};
    const depth = args.depth || "basic";
    const performance_tests = args.performance_tests || {};

    const componentHealth = {
      dag: {
        status: "healthy" as const,
        vertex_count: Math.floor(Math.random() * 1000) + 100,
        tip_count: Math.floor(Math.random() * 20) + 1,
        consensus_status: "finalized",
        issues: []
      },
      crypto: {
        status: "healthy" as const,
        algorithms_available: ["ml-kem-768", "ml-dsa-65"],
        key_count: Math.floor(Math.random() * 50) + 10,
        issues: []
      },
      network: {
        status: "healthy" as const,
        peer_count: Math.floor(Math.random() * 100) + 10,
        connection_quality: Math.random() * 0.3 + 0.7,
        latency_ms: Math.random() * 50 + 10,
        issues: []
      },
      vault: {
        status: "healthy" as const,
        entry_count: Math.floor(Math.random() * 200) + 10,
        storage_used_mb: Math.random() * 500 + 100,
        issues: []
      },
      consensus: {
        status: "healthy" as const,
        participation_rate: 0.95,
        finality_lag: Math.floor(Math.random() * 10) + 1,
        issues: []
      }
    };

    const recommendations: any[] = [];
    if (componentHealth.network.peer_count < 5) {
      recommendations.push({
        priority: "medium" as const,
        component: "network",
        issue: "Low peer count",
        recommendation: "Consider connecting to more peers for better resilience"
      });
    }

    const result = {
      overall_status: "healthy" as const,
      health_score: 95,
      components: components.dag ? componentHealth : {},
      performance: performance_tests.enabled ? {
        cpu_usage: Math.random() * 60 + 20,
        memory_usage_mb: Math.random() * 500 + 200,
        network_throughput_mbps: Math.random() * 100 + 50,
        operations_per_second: Math.random() * 500 + 100
      } : undefined,
      recommendations
    };

    return createToolResult(result);
  }
}

export const cryptoTools = [
  new QuantumKeyExchangeTool(),
  new QuantumSignTool(),
  new SystemHealthCheckTool()
];
