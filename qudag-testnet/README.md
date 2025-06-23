# QuDAG Testnet - Docker Containerization & MCP Server

This directory contains the optimized Docker containerization for the QuDAG testnet deployment, including a complete 4-node testnet environment and the **real MCP (Model Context Protocol) server** with quantum-resistant tools and dark registry persistence.

## 🚀 Quick Start

### Local Docker Testnet
```bash
# 1. Setup the testnet (generate keys, build images)
./scripts/setup.sh

# 2. Start the testnet
docker-compose up -d

# 3. Monitor the testnet
./scripts/monitor.sh -c

# 4. Access services
# - Grafana: http://localhost:3000 (admin/admin123)
# - Prometheus: http://localhost:9094
# - Node APIs: http://localhost:8080-8083
```

### Production MCP Server (Deployed on Fly.dev)
```bash
# Access the live MCP server
curl https://quadag-mcp.fly.dev/health

# List available MCP tools
curl https://quadag-mcp.fly.dev/mcp/tools

# Execute MCP tool (example: generate quantum-resistant keypair)
curl -X POST https://quadag-mcp.fly.dev/mcp/tools/execute \
  -H "Content-Type: application/json" \
  -d '{
    "name": "qudag_crypto",
    "arguments": {
      "operation": "generate_keypair",
      "algorithm": "ml-dsa"
    }
  }'
```

## 🆕 MCP Server Features

### Real Implementation with 7 QuDAG Tools

The MCP server provides a **fully functional implementation** (not mocked) with:

1. **qudag_crypto** - Quantum-resistant cryptography
   - ML-DSA-65 keypair generation (2592/1952 byte keys)
   - Quantum-resistant message signing
   - Algorithm: ML-DSA, ML-KEM, HQC support

2. **qudag_vault** - Secure encrypted storage
   - Create ML-KEM-768 encrypted vaults
   - Password-protected secret storage
   - Quantum-resistant encryption

3. **qudag_dag** - DAG consensus operations
   - Add vertices to the DAG
   - Query current DAG tips
   - Overflow-protected finalization

4. **qudag_network** - P2P networking
   - Dynamic peer management
   - Real-time peer addition
   - Network topology info

5. **qudag_exchange** - rUv token system
   - Token transfers with 0.5% fees
   - Account balance management
   - Fee model information

6. **qudag_dark** - Dark services
   - .dark domain registration with **persistence**
   - Shadow address generation
   - Onion routing support
   - Pre-populated domains: qudag.dark, testnet.dark, bootstrap.dark

7. **qudag_system** - System monitoring
   - Real-time node metrics
   - Network topology information
   - Quantum operation statistics

### Dark Registry Persistence

The MCP server now includes **file-based persistence** for dark domains:
- Domains persist between API calls
- Stored in `/tmp/qudag_dark_registry.json`
- Automatically loaded on server restart
- Pre-populated with test domains

### Live Deployment

**Production MCP Server**: https://quadag-mcp.fly.dev
- Fully functional with all 7 tools
- Dark registry persistence enabled
- Optimized for low latency
- Health monitoring at `/health`

## 📁 Directory Structure

```
qudag-testnet/
├── Dockerfile                 # Multi-stage optimized Dockerfile
├── Dockerfile.mcp-fixed      # MCP server with persistence
├── docker-compose.yml        # 4-node + monitoring stack
├── README.md                 # This file
├── configs/                  # Node configuration files
│   ├── node1-4.toml         # Node configs
│   ├── qudag-mcp-*.rs       # MCP server implementations
│   └── qudag-mcp-standalone-fixed.rs  # Production MCP with persistence
├── monitoring/              # Monitoring configuration
├── keys/                    # Generated cryptographic keys
├── scripts/                 # Management scripts
├── fly.mcp-fixed.toml      # Fly.dev deployment config
└── qudag-mcp-real/         # Real MCP implementation source
```

## 🔧 Features

### Docker Optimization
- **Multi-stage build** with Cargo Chef for efficient dependency caching
- **Minimal runtime image** based on Debian Bookworm Slim
- **Multi-architecture support** (AMD64/ARM64)
- **Optimized Rust compilation** with target-cpu=native
- **Security hardening** with non-root user execution
- **Health checks** for all services

### MCP Server Features
- **Real implementation** - Not mocked, uses actual QuDAG libraries
- **Quantum-resistant** - ML-DSA, ML-KEM, HQC algorithms
- **Persistent storage** - Dark registry survives restarts
- **Exchange system** - rUv tokens with dynamic fees
- **Business plan** - Contributor payouts and rewards
- **Production-ready** - Deployed and tested on fly.dev

### Networking
- **Isolated Docker network** (172.28.0.0/16)
- **P2P connectivity** between all nodes
- **Port mapping** for external access
- **Service discovery** using hostnames
- **Bootstrap node** configuration
- **Dark domain** addressing with persistence

### Monitoring Stack
- **Prometheus** metrics collection
- **Grafana** visualization dashboards
- **Node Exporter** for host metrics
- **cAdvisor** for container metrics
- **Alert rules** for proactive monitoring
- **MCP health checks** at `/health`

## 🛠️ Setup Instructions

### Prerequisites

```bash
# Required tools
sudo apt-get update && sudo apt-get install -y \
    docker.io \
    docker-compose \
    openssl \
    jq \
    curl
```

### Deploy MCP Server to Fly.dev

```bash
# Deploy the MCP server with persistence
cd qudag-testnet
fly deploy -c fly.mcp-fixed.toml --app quadag-mcp --ha=false

# Check deployment status
fly status -a quadag-mcp

# View logs
fly logs -a quadag-mcp
```

### Step 1: Initialize Testnet

Run the setup script to generate keys and build the Docker image:

```bash
./scripts/setup.sh
```

This will:
- Generate Ed25519 keypairs for all nodes
- Create peer IDs and bootstrap configuration
- Build the optimized Docker image
- Create environment configuration
- Validate all configurations

### Step 2: Start Services

```bash
# Start all services
docker-compose up -d

# Start only nodes (no monitoring)
docker-compose up -d node1 node2 node3 node4

# Start with logs
docker-compose up
```

### Step 3: Verify Deployment

```bash
# Check status
./scripts/monitor.sh

# Continuous monitoring
./scripts/monitor.sh -c

# JSON output for automation
./scripts/monitor.sh -j
```

## 📊 MCP API Examples

### Quantum Cryptography
```bash
# Generate ML-DSA keypair
curl -X POST https://quadag-mcp.fly.dev/mcp/tools/execute \
  -H "Content-Type: application/json" \
  -d '{
    "name": "qudag_crypto",
    "arguments": {
      "operation": "generate_keypair",
      "algorithm": "ml-dsa"
    }
  }'

# Sign message
curl -X POST https://quadag-mcp.fly.dev/mcp/tools/execute \
  -H "Content-Type: application/json" \
  -d '{
    "name": "qudag_crypto",
    "arguments": {
      "operation": "sign",
      "message": "Hello QuDAG",
      "algorithm": "ml-dsa"
    }
  }'
```

### Dark Domain Registry
```bash
# Register dark domain (persisted)
curl -X POST https://quadag-mcp.fly.dev/mcp/tools/execute \
  -H "Content-Type: application/json" \
  -d '{
    "name": "qudag_dark",
    "arguments": {
      "operation": "register_dark_domain",
      "domain": "mynode.dark",
      "address": "/onion/v3/myonionaddress"
    }
  }'

# Resolve dark domain
curl -X POST https://quadag-mcp.fly.dev/mcp/tools/execute \
  -H "Content-Type: application/json" \
  -d '{
    "name": "qudag_dark",
    "arguments": {
      "operation": "resolve_dark_domain",
      "domain": "mynode.dark"
    }
  }'
```

### Token Exchange
```bash
# Check balance
curl -X POST https://quadag-mcp.fly.dev/mcp/tools/execute \
  -H "Content-Type: application/json" \
  -d '{
    "name": "qudag_exchange",
    "arguments": {
      "operation": "get_balance",
      "account": "alice"
    }
  }'

# Transfer tokens (0.5% fee)
curl -X POST https://quadag-mcp.fly.dev/mcp/tools/execute \
  -H "Content-Type: application/json" \
  -d '{
    "name": "qudag_exchange",
    "arguments": {
      "operation": "transfer",
      "from": "alice",
      "to": "bob",
      "amount": 1000
    }
  }'
```

## 📊 Monitoring & Observability

### Grafana Dashboard

Access Grafana at http://localhost:3000:
- **Username**: admin
- **Password**: admin123
- **Dashboard**: QuDAG Testnet Overview

Key metrics monitored:
- Node health and uptime
- CPU and memory usage
- Peer connection counts
- DAG vertex creation rates
- Network latency
- Storage usage
- MCP tool usage statistics

### Prometheus Metrics

Access Prometheus at http://localhost:9094:
- Raw metrics collection
- Alert rule management
- Query interface
- Target health monitoring

### Node APIs

Each node exposes an API endpoint:
- **Node 1**: http://localhost:8080
- **Node 2**: http://localhost:8081
- **Node 3**: http://localhost:8082
- **Node 4**: http://localhost:8083

API endpoints:
- `/api/v1/health` - Health check
- `/api/v1/peers` - Peer information
- `/api/v1/dag/info` - DAG statistics
- `/metrics` - Prometheus metrics

## 🔐 Security Features

### Cryptographic Security
- Ed25519 keypairs for node authentication
- **Quantum-resistant** cryptographic algorithms (ML-DSA, ML-KEM, HQC)
- Secure key storage and management
- TLS encryption for RPC endpoints

### Container Security
- Non-root user execution
- Minimal attack surface
- Resource limits and isolation
- Security-hardened base image

### Network Security
- Isolated Docker network
- Firewall-friendly port mapping
- Traffic obfuscation support
- Dark domain addressing with persistence

## ⚡ Performance Optimization

### Build Optimization
- Cargo Chef for dependency caching
- Multi-stage builds reduce image size
- Rust compilation with target-cpu=native
- Efficient layer caching

### Runtime Optimization
- Resource limits prevent resource exhaustion
- Optimized logging configuration
- Efficient storage management
- Connection pooling and reuse
- Dark registry caching

### MCP Server Optimization
- Realistic key generation (proper sizes)
- Overflow protection in DAG consensus
- Dynamic peer management
- Efficient fee calculations
- Persistent dark registry

## 🔧 Configuration

### Node Configuration

Each node has a TOML configuration file in `configs/`:

```toml
[node]
name = "testnet-validator-2"
role = "validator"
data_dir = "/data/qudag"

[network]
network_id = "qudag-testnet-local"
max_peers = 50
min_peers = 3

[p2p]
enable_nat = true
enable_relay = true
bootstrap_peers = ["..."]

[dark_domain]
enabled = true
namespace = "testnet"

[consensus]
type = "qr-avalanche"
block_time = "5s"
```

### MCP Server Configuration

The MCP server uses environment variables:

```bash
# Server configuration
RUST_LOG=info
QUDAG_NETWORK=testnet

# Persistence
DARK_REGISTRY_PATH=/tmp/qudag_dark_registry.json

# Pre-populated domains
PRELOAD_DOMAINS=true
```

### Environment Variables

Key environment variables:

```bash
# Network configuration
QUDAG_NETWORK_ID=qudag-testnet-local
QUDAG_DARK_DOMAIN_ENABLED=true

# Port configuration
QUDAG_P2P_PORT=4001
QUDAG_RPC_PORT=8080
QUDAG_METRICS_PORT=9090

# Logging
RUST_LOG=info,qudag=debug
RUST_BACKTRACE=1
```

## 🚨 Troubleshooting

### Common Issues

1. **MCP tools not working**
   ```bash
   # Check server health
   curl https://quadag-mcp.fly.dev/health
   
   # List available tools
   curl https://quadag-mcp.fly.dev/mcp/tools
   ```

2. **Dark domains not persisting**
   ```bash
   # Check server logs
   fly logs -a quadag-mcp
   
   # Verify domain registration
   curl -X POST https://quadag-mcp.fly.dev/mcp/tools/execute \
     -H "Content-Type: application/json" \
     -d '{"name":"qudag_dark","arguments":{"operation":"list_dark_domains"}}'
   ```

3. **Nodes not connecting**
   ```bash
   # Check network connectivity
   docker network ls
   docker network inspect qudag-testnet_qudag_testnet
   ```

4. **Health checks failing**
   ```bash
   # Check logs
   docker-compose logs node1
   
   # Check API endpoints
   curl http://localhost:8080/api/v1/health
   ```

5. **Monitoring not working**
   ```bash
   # Restart monitoring stack
   docker-compose restart prometheus grafana
   
   # Check Prometheus targets
   curl http://localhost:9094/api/v1/targets
   ```

### Debug Commands

```bash
# View logs
docker-compose logs -f node1

# Execute commands in container
docker-compose exec node1 bash

# Check container stats
docker stats

# Inspect container
docker inspect qudag-testnet-node1

# Reset everything
docker-compose down -v
docker system prune -f
```

## 📝 Management Commands

### Start/Stop Services

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Restart a specific node
docker-compose restart node1

# Scale services (if needed)
docker-compose up -d --scale node1=1
```

### Data Management

```bash
# Backup node data
docker run --rm -v qudag-testnet_node1_data:/data -v $(pwd):/backup \
    alpine tar czf /backup/node1-backup.tar.gz /data

# Restore node data
docker run --rm -v qudag-testnet_node1_data:/data -v $(pwd):/backup \
    alpine tar xzf /backup/node1-backup.tar.gz -C /

# Clean up volumes
docker-compose down -v
```

### Key Management

```bash
# Regenerate keys only
./scripts/setup.sh keys-only

# View peer IDs
for i in {1..4}; do
    echo "Node $i: $(cat keys/node$i/peer_id.txt)"
done
```

## 📈 Scaling and Production

### Production Considerations

1. **Resource Allocation**
   - Increase memory limits for production workloads
   - Adjust CPU limits based on expected traffic
   - Configure appropriate storage volumes

2. **Security Hardening**
   - Enable TLS for all endpoints
   - Implement proper authentication
   - Regular security updates
   - Dark registry encryption

3. **Monitoring and Alerting**
   - Configure alert destinations (email, Slack, etc.)
   - Set up log aggregation
   - Implement health checks
   - Monitor MCP tool usage

4. **Backup and Recovery**
   - Automated backup procedures
   - Disaster recovery planning
   - Data replication strategies
   - Dark registry backups

### Horizontal Scaling

To add more nodes:

1. Create new configuration files
2. Update docker-compose.yml
3. Generate new keys
4. Update bootstrap configuration
5. Deploy additional MCP servers

## 📄 Recent Updates

### v0.5.0 - MCP Implementation (Current)
- ✅ Real MCP server implementation with 7 QuDAG tools
- ✅ Dark registry persistence using file storage
- ✅ Fixed exchange transfer logic and fee calculations
- ✅ Realistic ML-DSA-65 key generation
- ✅ DAG consensus overflow protection
- ✅ Successfully deployed to quadag-mcp.fly.dev
- ✅ All package versions updated to 0.5.0

### Previous Versions
- v0.4.3 - Initial testnet deployment
- v0.4.0 - Exchange system implementation
- v0.3.0 - Dark domain support

## 📄 License

This configuration is part of the QuDAG project and follows the same license terms (MIT OR Apache-2.0).

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly (including MCP tools)
5. Submit a pull request

## 📞 Support

- GitHub Issues: [QuDAG Issues](https://github.com/ruvnet/QuDAG/issues)
- Documentation: [QuDAG Docs](https://github.com/ruvnet/QuDAG)
- Live MCP Server: [quadag-mcp.fly.dev](https://quadag-mcp.fly.dev)
- Community: [Discord](https://discord.gg/qudag)