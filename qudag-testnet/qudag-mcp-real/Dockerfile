# Build stage
FROM rust:1.75-slim AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    musl-tools \
    && rm -rf /var/lib/apt/lists/*

# Add musl target for static linking
RUN rustup target add x86_64-unknown-linux-musl

# Create app directory
WORKDIR /app

# Copy workspace files
COPY Cargo.toml Cargo.lock ./
COPY qudag/ ./qudag/
COPY core/ ./core/
COPY tools/ ./tools/
COPY qudag-mcp/ ./qudag-mcp/
COPY qudag-wasm/ ./qudag-wasm/
COPY qudag-exchange/ ./qudag-exchange/
COPY qudag-testnet/qudag-mcp-real/ ./qudag-testnet/qudag-mcp-real/

# Build the application
WORKDIR /app/qudag-testnet/qudag-mcp-real
RUN cargo build --release --target x86_64-unknown-linux-musl

# Runtime stage
FROM alpine:3.19

# Install runtime dependencies
RUN apk add --no-cache \
    ca-certificates \
    sqlite-libs

# Create non-root user
RUN addgroup -g 1000 qudag && \
    adduser -D -u 1000 -G qudag qudag

# Create data directories
RUN mkdir -p /data/keys /data/db && \
    chown -R qudag:qudag /data

# Copy binary from builder
COPY --from=builder /app/qudag-testnet/qudag-mcp-real/target/x86_64-unknown-linux-musl/release/qudag-mcp-real /usr/local/bin/

# Copy default configuration
COPY --from=builder /app/qudag-testnet/qudag-mcp-real/config/default.toml /etc/qudag/default.toml

# Switch to non-root user
USER qudag

# Set data directory
WORKDIR /data

# Expose ports
EXPOSE 3000 9000

# Set environment variables
ENV RUST_LOG=info,qudag_mcp_real=debug
ENV QUDAG_DATA_DIR=/data

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Run the application
ENTRYPOINT ["qudag-mcp-real"]
CMD ["--config", "/etc/qudag/default.toml"]