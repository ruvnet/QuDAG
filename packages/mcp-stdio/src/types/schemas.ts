import { z } from 'zod';

// ============================================================================
// Quantum DAG Schemas
// ============================================================================

export const GateSchema = z.object({
  type: z.enum(['H', 'X', 'Y', 'Z', 'CNOT', 'T', 'S', 'RX', 'RY', 'RZ']),
  target: z.union([z.number(), z.array(z.number())]),
  params: z.array(z.number()).optional(),
  control: z.number().optional(),
});

export const CircuitSchema = z.object({
  qubits: z.number().int().min(1).max(32),
  gates: z.array(GateSchema),
  measurements: z.array(z.number()).optional(),
});

export const ExecuteQuantumDagInputSchema = z.object({
  circuit: CircuitSchema,
  execution: z
    .object({
      backend: z.enum(['simulator', 'classical-dag']).optional(),
      shots: z.number().int().min(1).max(10000).optional(),
      optimization_level: z.enum([0, 1, 2, 3]).optional(),
      noise_model: z
        .object({
          enabled: z.boolean(),
          error_rate: z.number().min(0).max(1).optional(),
        })
        .optional(),
    })
    .optional(),
  consensus: z
    .object({
      require_finality: z.boolean().optional(),
      timeout_ms: z.number().optional(),
      min_confirmations: z.number().optional(),
    })
    .optional(),
  metadata: z
    .object({
      label: z.string().optional(),
      description: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })
    .optional(),
});

export const OptimizeCircuitInputSchema = z.object({
  circuit: CircuitSchema,
  optimization: z.object({
    level: z.enum([0, 1, 2, 3]),
    preserve_semantics: z.boolean(),
    target_metric: z.enum(['depth', 'gates', 'fidelity', 'dag-locality']).optional(),
    max_iterations: z.number().optional(),
  }),
  dag_optimization: z
    .object({
      minimize_dag_depth: z.boolean().optional(),
      maximize_parallelism: z.boolean().optional(),
      locality_aware: z.boolean().optional(),
    })
    .optional(),
});

export const AnalyzeComplexityInputSchema = z.object({
  circuit: CircuitSchema,
  analysis: z.object({
    include_quantum_metrics: z.boolean().optional(),
    include_classical_metrics: z.boolean().optional(),
    include_dag_metrics: z.boolean().optional(),
    include_resource_estimates: z.boolean().optional(),
  }),
});

export const BenchmarkPerformanceInputSchema = z.object({
  circuit: CircuitSchema,
  benchmark: z.object({
    iterations: z.number().optional(),
    warmup_iterations: z.number().optional(),
    parallel_executions: z.number().optional(),
    backends: z.array(z.enum(['simulator', 'classical-dag'])).optional(),
  }),
  metrics: z
    .object({
      execution_time: z.boolean().optional(),
      throughput: z.boolean().optional(),
      latency_distribution: z.boolean().optional(),
      resource_utilization: z.boolean().optional(),
      dag_consensus_time: z.boolean().optional(),
    })
    .optional(),
});

// ============================================================================
// Cryptographic Operation Schemas
// ============================================================================

export const QuantumKeyExchangeInputSchema = z.object({
  algorithm: z.enum(['ml-kem-512', 'ml-kem-768', 'ml-kem-1024']),
  role: z.enum(['initiator', 'responder']),
  encapsulated_key: z.string().optional(),
  options: z
    .object({
      derive_shared_secret: z.boolean().optional(),
      store_in_vault: z.boolean().optional(),
      vault_label: z.string().optional(),
    })
    .optional(),
  dag_storage: z
    .object({
      store_public_key: z.boolean().optional(),
      require_consensus: z.boolean().optional(),
    })
    .optional(),
});

export const QuantumSignInputSchema = z.object({
  data: z.string(),
  algorithm: z.enum(['ml-dsa-44', 'ml-dsa-65', 'ml-dsa-87']),
  private_key: z.string(),
  options: z
    .object({
      include_timestamp: z.boolean().optional(),
      include_context: z.boolean().optional(),
      context: z.string().optional(),
    })
    .optional(),
  dag_storage: z
    .object({
      store_signature: z.boolean().optional(),
      attach_to_vertex: z.string().optional(),
    })
    .optional(),
});

// ============================================================================
// Network Operation Schemas
// ============================================================================

export const DarkAddressResolveInputSchema = z.object({
  address: z.string(),
  options: z
    .object({
      include_quantum_fingerprint: z.boolean().optional(),
      verify_signature: z.boolean().optional(),
      cache_result: z.boolean().optional(),
      timeout_ms: z.number().optional(),
    })
    .optional(),
  network: z
    .object({
      prefer_onion_routing: z.boolean().optional(),
      require_quantum_secure: z.boolean().optional(),
    })
    .optional(),
});

// ============================================================================
// Vault Operation Schemas
// ============================================================================

export const VaultQuantumStoreInputSchema = z.object({
  secret: z.object({
    label: z.string(),
    data: z.string(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
  encryption: z.object({
    algorithm: z.enum(['ml-kem-768', 'ml-kem-1024', 'hqc-128', 'hqc-192']),
    derive_key: z.boolean().optional(),
    key_rotation_enabled: z.boolean().optional(),
  }),
  access_control: z
    .object({
      allowed_peers: z.array(z.string()).optional(),
      require_signature: z.boolean().optional(),
      expiry_time: z.string().optional(),
    })
    .optional(),
  dag_storage: z
    .object({
      store_metadata_in_dag: z.boolean().optional(),
      require_consensus: z.boolean().optional(),
    })
    .optional(),
});

export const VaultQuantumRetrieveInputSchema = z.object({
  entry: z.object({
    entry_id: z.string().optional(),
    label: z.string().optional(),
    retrieval_token: z.string().optional(),
  }),
  authentication: z.object({
    private_key: z.string().optional(),
    access_token: z.string().optional(),
  }),
  decryption: z
    .object({
      verify_integrity: z.boolean().optional(),
      check_expiry: z.boolean().optional(),
    })
    .optional(),
});

// ============================================================================
// System Monitoring Schemas
// ============================================================================

export const SystemHealthCheckInputSchema = z.object({
  components: z
    .object({
      dag: z.boolean().optional(),
      crypto: z.boolean().optional(),
      network: z.boolean().optional(),
      vault: z.boolean().optional(),
      consensus: z.boolean().optional(),
    })
    .optional(),
  depth: z.enum(['basic', 'detailed', 'comprehensive']).optional(),
  performance_tests: z
    .object({
      enabled: z.boolean().optional(),
      quick_tests_only: z.boolean().optional(),
    })
    .optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type Gate = z.infer<typeof GateSchema>;
export type Circuit = z.infer<typeof CircuitSchema>;
export type ExecuteQuantumDagInput = z.infer<typeof ExecuteQuantumDagInputSchema>;
export type OptimizeCircuitInput = z.infer<typeof OptimizeCircuitInputSchema>;
export type AnalyzeComplexityInput = z.infer<typeof AnalyzeComplexityInputSchema>;
export type BenchmarkPerformanceInput = z.infer<typeof BenchmarkPerformanceInputSchema>;
export type QuantumKeyExchangeInput = z.infer<typeof QuantumKeyExchangeInputSchema>;
export type QuantumSignInput = z.infer<typeof QuantumSignInputSchema>;
export type DarkAddressResolveInput = z.infer<typeof DarkAddressResolveInputSchema>;
export type VaultQuantumStoreInput = z.infer<typeof VaultQuantumStoreInputSchema>;
export type VaultQuantumRetrieveInput = z.infer<typeof VaultQuantumRetrieveInputSchema>;
export type SystemHealthCheckInput = z.infer<typeof SystemHealthCheckInputSchema>;
