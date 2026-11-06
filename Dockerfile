# Multi-stage build for QuDAG node
# Stage 1: Build environment
# rust:1-slim tracks current stable (Cargo.lock v4 needs Cargo >= 1.78).
FROM rust:1-slim-bookworm AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    cmake \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set up working directory
WORKDIR /qudag

# Copy workspace files
COPY Cargo.toml Cargo.lock ./
COPY core/ ./core/
COPY cli-standalone/ ./cli-standalone/
COPY qudag/ ./qudag/
COPY benchmarks/ ./benchmarks/
COPY tools/ ./tools/
COPY qudag-exchange/ ./qudag-exchange/
COPY qudag-mcp/ ./qudag-mcp/
COPY qudag-wasm/ ./qudag-wasm/

# Build the node CLI (the qudag binary lives in tools/cli)
RUN cargo build --locked --release -p qudag-cli --bin qudag

# Build standalone Exchange CLI
RUN cargo build --locked --release --bin qudag-exchange --manifest-path ./qudag-exchange/cli/Cargo.toml --target-dir /qudag/target

# Stage 2: Runtime environment
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1000 -s /bin/bash qudag

# Copy binaries from builder
COPY --from=builder /qudag/target/release/qudag /usr/local/bin/qudag
COPY --from=builder /qudag/target/release/qudag-exchange /usr/local/bin/qudag-exchange

# Create data directories including Exchange
RUN mkdir -p /data /config /keys /exchange && \
    chown -R qudag:qudag /data /config /keys /exchange

# Switch to non-root user
USER qudag

# Set environment variables
ENV QUDAG_DATA_DIR=/data
ENV QUDAG_CONFIG_DIR=/config
ENV QUDAG_KEY_DIR=/keys
ENV QUDAG_EXCHANGE_DIR=/exchange
ENV RUST_LOG=info
ENV RUST_BACKTRACE=1

# Exchange-specific environment variables
ENV QUDAG_EXCHANGE_ENABLED=false
ENV EXCHANGE_NODE_TYPE=full
ENV FEE_MODEL_ENABLED=true
ENV IMMUTABLE_DEPLOYMENT=false

# Expose ports
# P2P port
EXPOSE 4001
# RPC port
EXPOSE 8080
# Exchange API port
EXPOSE 8081
# Metrics port
EXPOSE 9090

# Health check with Exchange support
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD qudag status && ([ "$QUDAG_EXCHANGE_ENABLED" != "true" ] || qudag exchange status) || exit 1

# Volume mounts including Exchange data
VOLUME ["/data", "/config", "/keys", "/exchange"]

# Default command
ENTRYPOINT ["qudag"]
CMD ["start", "--config", "/config/node.toml"]