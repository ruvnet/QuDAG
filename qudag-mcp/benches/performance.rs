//! Performance benchmarks for QuDAG MCP implementation

use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion, Throughput};
use qudag_mcp::protocol::{MCPMessage, MCPRequest, MCPResponse, RequestId};
use qudag_mcp::resources::ResourceRegistry;
use qudag_mcp::tools::ToolRegistry;
use qudag_mcp::{
    ClientInfo, Error, QuDAGMCPServer, ResourceURI, ServerCapabilities, ServerConfig, ToolName,
    MCP_PROTOCOL_VERSION,
};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::runtime::Runtime;

fn dag_tips_args() -> Option<Value> {
    Some(json!({ "operation": "tips" }))
}

fn keygen_args() -> Option<Value> {
    Some(json!({ "operation": "generateKeypair", "algorithm": "ml-kem-768" }))
}

/// Benchmark protocol message serialization/deserialization
fn bench_message_serialization(c: &mut Criterion) {
    let mut group = c.benchmark_group("message_serialization");

    // Setup test data
    let request =
        MCPRequest::initialize(ClientInfo::new("benchmark-client", "1.0.0"), HashMap::new());
    let message = MCPMessage::Request(request);
    let json = message.to_json().unwrap();

    group.bench_function("serialize_request", |b| {
        b.iter(|| {
            let msg = message.clone();
            black_box(msg.to_json().unwrap())
        });
    });

    group.bench_function("deserialize_request", |b| {
        b.iter(|| black_box(MCPMessage::from_json(&json).unwrap()));
    });

    // Benchmark large message handling
    let large_data = "x".repeat(10_000); // 10KB payload
    let large_request = MCPRequest::call_tool("test_tool", json!({"large_data": large_data}));
    let large_message = MCPMessage::Request(large_request);

    group.bench_function("serialize_large_message", |b| {
        b.iter(|| {
            let msg = large_message.clone();
            black_box(msg.to_json().unwrap())
        });
    });

    group.finish();
}

/// Benchmark tool registry operations
fn bench_tool_operations(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let mut group = c.benchmark_group("tool_operations");

    let registry = Arc::new(ToolRegistry::new());

    group.bench_function("list_tools", |b| {
        b.to_async(&rt)
            .iter(|| async { black_box(registry.list_tools().await.unwrap()) });
    });

    group.bench_function("execute_dag_tool", |b| {
        let tool_name = ToolName::new("dag");
        b.to_async(&rt).iter(|| async {
            black_box(
                registry
                    .call_tool(&tool_name, dag_tips_args())
                    .await
                    .unwrap(),
            )
        });
    });

    group.bench_function("execute_crypto_tool", |b| {
        let tool_name = ToolName::new("crypto");
        b.to_async(&rt).iter(|| async {
            black_box(registry.call_tool(&tool_name, keygen_args()).await.unwrap())
        });
    });

    // Benchmark concurrent tool execution
    group.bench_function("concurrent_tool_execution", |b| {
        b.to_async(&rt).iter(|| async {
            let mut handles = vec![];
            for _ in 0..10 {
                let registry = registry.clone();
                handles.push(tokio::spawn(async move {
                    registry
                        .call_tool(&ToolName::new("dag"), dag_tips_args())
                        .await
                        .unwrap()
                }));
            }

            for handle in handles {
                black_box(handle.await.unwrap());
            }
        });
    });

    group.finish();
}

/// Benchmark resource registry operations
fn bench_resource_operations(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let mut group = c.benchmark_group("resource_operations");

    let registry = Arc::new(ResourceRegistry::new());

    group.bench_function("list_resources", |b| {
        b.to_async(&rt)
            .iter(|| async { black_box(registry.list_resources().await.unwrap()) });
    });

    for (name, uri) in [
        ("read_dag_resource", "dag://state"),
        ("read_vault_resource", "vault://entries"),
        ("read_network_resource", "network://peers"),
        ("read_system_resource", "system://status"),
        ("read_exchange_resource", "exchange://supply"),
    ] {
        let uri = ResourceURI::new(uri);
        group.bench_function(name, |b| {
            b.to_async(&rt)
                .iter(|| async { black_box(registry.read_resource(&uri).await.unwrap()) });
        });
    }

    // Benchmark concurrent resource access
    group.bench_function("concurrent_resource_access", |b| {
        let uris = vec![
            ResourceURI::new("dag://state"),
            ResourceURI::new("vault://entries"),
            ResourceURI::new("network://peers"),
            ResourceURI::new("system://status"),
        ];

        b.to_async(&rt).iter(|| async {
            let mut handles = vec![];
            for uri in &uris {
                let registry = registry.clone();
                let uri = uri.clone();
                handles.push(tokio::spawn(async move {
                    registry.read_resource(&uri).await.unwrap()
                }));
            }

            for handle in handles {
                black_box(handle.await.unwrap());
            }
        });
    });

    group.finish();
}

/// Benchmark server operations
fn bench_server_operations(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let mut group = c.benchmark_group("server_operations");

    let config = ServerConfig::new()
        .with_server_info("Benchmark Server", "1.0.0")
        .with_log_level("error"); // Reduce logging for benchmarks

    group.bench_function("server_creation", |b| {
        b.to_async(&rt)
            .iter(|| async { black_box(QuDAGMCPServer::new(config.clone()).await.unwrap()) });
    });

    group.bench_function("server_stats", |b| {
        let server = rt.block_on(QuDAGMCPServer::new(config.clone())).unwrap();
        b.to_async(&rt)
            .iter(|| async { black_box(server.stats().await) });
    });

    group.finish();
}

/// Benchmark error handling performance
fn bench_error_handling(c: &mut Criterion) {
    let mut group = c.benchmark_group("error_handling");

    // Benchmark error creation
    group.bench_function("create_tool_not_found", |b| {
        b.iter(|| black_box(Error::tool_not_found("nonexistent_tool")));
    });

    group.bench_function("create_resource_not_found", |b| {
        b.iter(|| black_box(Error::resource("nonexistent://resource", "not found")));
    });

    // Benchmark error serialization
    let error = Error::tool_not_found("test_tool");
    group.bench_function("serialize_error", |b| {
        b.iter(|| black_box(error.to_json_rpc_error()));
    });

    // Benchmark error response creation
    group.bench_function("create_error_response", |b| {
        let id = RequestId::generate();
        b.iter(|| {
            black_box(MCPResponse::error(
                id.clone(),
                Error::method_not_found("test/method"),
            ))
        });
    });

    group.finish();
}

/// Benchmark concurrent operations
fn bench_concurrent_operations(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let mut group = c.benchmark_group("concurrent_operations");

    let tool_registry = Arc::new(ToolRegistry::new());
    let resource_registry = Arc::new(ResourceRegistry::new());

    // Benchmark varying levels of concurrency
    for concurrency in [1, 5, 10, 20, 50].iter() {
        group.bench_with_input(
            BenchmarkId::new("concurrent_tool_calls", concurrency),
            concurrency,
            |b, &concurrency| {
                b.to_async(&rt).iter(|| async {
                    let mut handles = vec![];
                    for _ in 0..concurrency {
                        let registry = tool_registry.clone();
                        handles.push(tokio::spawn(async move {
                            registry
                                .call_tool(&ToolName::new("dag"), dag_tips_args())
                                .await
                                .unwrap()
                        }));
                    }

                    for handle in handles {
                        black_box(handle.await.unwrap());
                    }
                });
            },
        );

        group.bench_with_input(
            BenchmarkId::new("concurrent_resource_reads", concurrency),
            concurrency,
            |b, &concurrency| {
                let uri = ResourceURI::new("dag://state");
                b.to_async(&rt).iter(|| async {
                    let mut handles = vec![];
                    for _ in 0..concurrency {
                        let registry = resource_registry.clone();
                        let uri = uri.clone();
                        handles.push(tokio::spawn(async move {
                            registry.read_resource(&uri).await.unwrap()
                        }));
                    }

                    for handle in handles {
                        black_box(handle.await.unwrap());
                    }
                });
            },
        );
    }

    group.finish();
}

/// Benchmark memory usage patterns
fn bench_memory_operations(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let mut group = c.benchmark_group("memory_operations");

    // Benchmark creating many instances
    group.bench_function("create_many_servers", |b| {
        let config = ServerConfig::new().with_log_level("error");
        b.to_async(&rt).iter(|| async {
            let mut servers = vec![];
            for _ in 0..100 {
                servers.push(QuDAGMCPServer::new(config.clone()).await.unwrap());
            }
            black_box(servers)
        });
    });

    // Benchmark large data handling
    let large_payload_sizes = [1_000, 10_000, 100_000]; // 1KB, 10KB, 100KB
    let tool_registry = ToolRegistry::new();
    let tool_name = ToolName::new("crypto");

    for size in large_payload_sizes.iter() {
        group.throughput(Throughput::Bytes(*size as u64));
        group.bench_with_input(
            BenchmarkId::new("hash_large_payload", size),
            size,
            |b, &size| {
                let args = json!({
                    "operation": "hash",
                    "data": "x".repeat(size)
                });

                b.to_async(&rt).iter(|| async {
                    black_box(
                        tool_registry
                            .call_tool(&tool_name, Some(args.clone()))
                            .await
                            .unwrap(),
                    )
                });
            },
        );
    }

    group.finish();
}

/// Benchmark protocol compliance operations
fn bench_protocol_compliance(c: &mut Criterion) {
    let mut group = c.benchmark_group("protocol_compliance");

    // Benchmark request ID generation
    group.bench_function("generate_request_ids", |b| {
        b.iter(|| black_box(RequestId::generate()));
    });

    // Benchmark protocol version checking
    group.bench_function("version_check", |b| {
        let requested = String::from("2025-03-26");
        b.iter(|| black_box(black_box(requested.as_str()) == MCP_PROTOCOL_VERSION));
    });

    // Benchmark capability matching
    group.bench_function("capability_matching", |b| {
        let server_caps = ServerCapabilities::default();
        let client_caps = HashMap::<String, serde_json::Value>::new();

        b.iter(|| {
            // Simulate capability negotiation
            let subscriptions_supported = server_caps
                .resources
                .as_ref()
                .is_some_and(|r| r["subscribe"] == true)
                && !client_caps.contains_key("subscriptions");
            black_box(subscriptions_supported)
        });
    });

    group.finish();
}

/// Benchmark real-world usage scenarios
fn bench_usage_scenarios(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let mut group = c.benchmark_group("usage_scenarios");

    // Scenario: Heavy tool usage
    group.bench_function("heavy_tool_usage", |b| {
        let tool_registry = ToolRegistry::new();

        b.to_async(&rt).iter(|| async {
            let calls = [
                ("dag", json!({"operation": "tips"})),
                ("dag", json!({"operation": "status"})),
                (
                    "crypto",
                    json!({"operation": "generateKeypair", "algorithm": "ml-kem-768"}),
                ),
                ("crypto", json!({"operation": "hash", "data": "test data"})),
                (
                    "crypto",
                    json!({
                        "operation": "sign",
                        "data": "dGVzdCBkYXRh", // "test data" in base64
                        "privateKey": "mock_key"
                    }),
                ),
            ];

            for (tool, args) in calls {
                let _result = tool_registry
                    .call_tool(&ToolName::new(tool), Some(args))
                    .await
                    .unwrap();
            }

            black_box(())
        });
    });

    group.finish();
}

criterion_group!(
    benches,
    bench_message_serialization,
    bench_tool_operations,
    bench_resource_operations,
    bench_server_operations,
    bench_error_handling,
    bench_concurrent_operations,
    bench_memory_operations,
    bench_protocol_compliance,
    bench_usage_scenarios
);

criterion_main!(benches);
