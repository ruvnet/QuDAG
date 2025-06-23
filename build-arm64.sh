#!/bin/bash
# Rock-solid QuDAG build script for ARM64 Macs
# This motherfucker will work regardless of dependency issues

set -e

echo "🚀 Building QuDAG - Rock Solid Edition"
echo "======================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

echo "📦 Building QuDAG binary using Docker (no dependency issues!)..."

# Create a minimal Dockerfile for building
cat > Dockerfile.build << 'EOF'
FROM rust:latest AS builder

WORKDIR /build

# Install dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    cmake \
    clang \
    && rm -rf /var/lib/apt/lists/*

# Copy source code
COPY . .

# Build with portable crypto (no AVX2)
ENV CARGO_CFG_TARGET_FEATURE=""
ENV RUSTFLAGS="-C target-cpu=generic"

# Build the CLI
RUN cargo build --release --package qudag-cli --manifest-path=tools/cli/Cargo.toml || \
    cargo build --release --package qudag

# Stage 2: Extract binary
FROM alpine:latest
RUN apk add --no-cache libc6-compat
COPY --from=builder /build/target/release/qudag* /usr/local/bin/
EOF

# Build the Docker image
docker build -f Dockerfile.build -t qudag-builder .

# Extract the binary
echo "📤 Extracting binary from Docker container..."
docker create --name qudag-extract qudag-builder
docker cp qudag-extract:/usr/local/bin/qudag ./qudag-binary 2>/dev/null || \
    docker cp qudag-extract:/usr/local/bin/qudag-cli ./qudag-binary
docker rm qudag-extract

# Make it executable
chmod +x ./qudag-binary

# Install to local bin
echo "📥 Installing QuDAG to ~/.local/bin..."
mkdir -p ~/.local/bin
cp ./qudag-binary ~/.local/bin/qudag

# Clean up
rm -f Dockerfile.build

echo "✅ QuDAG installed successfully!"
echo ""
echo "🎯 Next steps:"
echo "1. Add ~/.local/bin to your PATH:"
echo "   echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.zshrc"
echo "   source ~/.zshrc"
echo ""
echo "2. Test the installation:"
echo "   qudag --help"
echo ""
echo "3. Start using QuDAG:"
echo "   qudag start --port 8000"
echo ""
echo "💪 Rock solid as fuck! No more AVX2 bullshit." 