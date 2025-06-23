# Dockerfile for QuDAG MCP Standalone Fixed Version
FROM rust:1.87-slim AS builder

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

# Copy the standalone project
COPY Cargo.toml .
COPY qudag-mcp-standalone-fixed.rs .

# Build the application with musl for static linking
RUN cargo build --release --target x86_64-unknown-linux-musl

# Runtime stage
FROM alpine:3.19

# Install runtime dependencies and ca-certificates
RUN apk add --no-cache ca-certificates

# Create non-root user
RUN addgroup -g 1000 qudag && \
    adduser -D -u 1000 -G qudag qudag

# Copy binary from builder
COPY --from=builder /app/target/x86_64-unknown-linux-musl/release/qudag-mcp-standalone /usr/local/bin/

# Switch to non-root user
USER qudag

# Expose port
EXPOSE 3000

# Set environment variables
ENV RUST_LOG=info
ENV QUDAG_NETWORK=testnet

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Run the application
ENTRYPOINT ["qudag-mcp-standalone"]