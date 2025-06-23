.PHONY: help install dev build test lint typecheck docker-build docker-up docker-down db-init db-migrate clean

# Default target
help:
	@echo "QuDAG Business Intelligence API - Available Commands:"
	@echo "  make install      - Install dependencies"
	@echo "  make dev         - Start development server"
	@echo "  make build       - Build TypeScript to JavaScript"
	@echo "  make test        - Run tests"
	@echo "  make lint        - Run ESLint"
	@echo "  make typecheck   - Run TypeScript type checking"
	@echo "  make docker-build - Build Docker image"
	@echo "  make docker-up   - Start all services with Docker Compose"
	@echo "  make docker-down - Stop all Docker services"
	@echo "  make db-init     - Initialize database schema"
	@echo "  make db-migrate  - Run database migrations"
	@echo "  make clean       - Clean build artifacts"

# Install dependencies
install:
	npm install

# Development server
dev:
	npm run dev

# Build TypeScript
build:
	npm run build

# Run tests
test:
	npm test

# Lint code
lint:
	npm run lint

# Type checking
typecheck:
	npm run typecheck

# Docker commands
docker-build:
	docker build -t qudag-bi-api:latest .

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f bi-api

# Database commands
db-init:
	@echo "Initializing database..."
	@if [ -z "$(DATABASE_URL)" ]; then \
		echo "DATABASE_URL not set. Using default..."; \
		export DATABASE_URL="postgresql://qudag_executive:password@localhost:5433/qudag_business"; \
	fi; \
	psql $$DATABASE_URL -f init-db.sql

db-migrate:
	npm run migrate

db-seed:
	@echo "Seeding database with sample data..."
	node scripts/seed.js

# Clean build artifacts
clean:
	rm -rf dist/
	rm -rf node_modules/
	rm -rf coverage/
	rm -rf .cache/

# Development setup
setup: install db-init
	@echo "Development environment setup complete!"
	@echo "Run 'make dev' to start the development server"

# Production build
prod: clean install build
	@echo "Production build complete!"

# Run with tools (pgAdmin, RedisInsight)
docker-up-tools:
	docker-compose --profile tools up -d

# Check service health
health-check:
	@echo "Checking service health..."
	@curl -s http://localhost:8090/api/v1/health/detailed | jq '.'

# Generate API documentation
docs:
	@echo "Generating API documentation..."
	npx swagger-jsdoc -d swaggerDef.js -o ./docs/swagger.json ./src/routes/*.ts

# Run specific service
run-service:
	@if [ -z "$(SERVICE)" ]; then \
		echo "Usage: make run-service SERVICE=<service-name>"; \
		exit 1; \
	fi; \
	docker-compose up -d $(SERVICE)

# Tail logs for specific service
logs:
	@if [ -z "$(SERVICE)" ]; then \
		docker-compose logs -f; \
	else \
		docker-compose logs -f $(SERVICE); \
	fi

# Database backup
db-backup:
	@echo "Creating database backup..."
	@TIMESTAMP=$$(date +%Y%m%d_%H%M%S); \
	docker exec qudag-bi-postgres pg_dump -U qudag_executive qudag_business > backups/backup_$$TIMESTAMP.sql; \
	echo "Backup saved to backups/backup_$$TIMESTAMP.sql"

# Database restore
db-restore:
	@if [ -z "$(FILE)" ]; then \
		echo "Usage: make db-restore FILE=<backup-file>"; \
		exit 1; \
	fi; \
	@echo "Restoring database from $(FILE)..."; \
	docker exec -i qudag-bi-postgres psql -U qudag_executive qudag_business < $(FILE)

# Performance test
perf-test:
	@echo "Running performance tests..."
	npm run test:perf

# Security audit
security-audit:
	npm audit
	npm audit fix --dry-run

# Update dependencies
update-deps:
	npm update
	npm outdated

# Format code
format:
	npx prettier --write "src/**/*.ts"

# Pre-commit checks
pre-commit: lint typecheck test
	@echo "Pre-commit checks passed!"