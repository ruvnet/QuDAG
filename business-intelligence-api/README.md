---
created: 2025-06-23T00:00:00Z
updated: 2025-06-23T00:00:00Z
updatedBy: CleoClaudeDesktop
version: 1.0.0
---

# QuDAG Business Intelligence API Documentation

## Overview

The QuDAG Business Intelligence API is the data layer for the Executive Intelligence Center, providing comprehensive business metrics, agent management, and real-time analytics for AI-powered organizations.

## Architecture

### Tech Stack
- **Runtime**: Node.js with TypeScript
- **Framework**: Fastify (high-performance web framework)
- **Database**: PostgreSQL with Slonik (type-safe SQL)
- **Cache**: Redis for performance optimization
- **Real-time**: WebSocket for live updates
- **Authentication**: JWT-based auth
- **API Documentation**: OpenAPI/Swagger

### Key Components

1. **Database Schema** (`init-db.sql`)
   - Multi-tenant organization support
   - AI agent workforce management
   - Business metrics time-series data
   - Natural language command history
   - Projects and scenario planning
   - Alert configurations

2. **Models Layer** (`src/models/`)
   - `BaseModel`: Abstract base class for database operations
   - `OrganizationModel`: Organization CRUD operations
   - `AgentModel`: AI agent profile management
   - `MetricsModel`: Business metrics and analytics

3. **Services Layer** (`src/services/`)
   - `OrganizationService`: Business logic for organizations
   - `AgentService`: Agent hiring, management, and orchestration
   - `MetricsService`: Metrics collection and aggregation
   - `CommandService`: Natural language command processing
   - `QuDAGIntegration`: Integration with core QuDAG platform

4. **API Routes** (to be implemented)
   - `/api/v1/organizations` - Organization management
   - `/api/v1/agents` - Agent operations
   - `/api/v1/metrics` - Business metrics
   - `/api/v1/commands` - Natural language commands
   - `/api/v1/dashboards` - Dashboard configurations
   - `/api/v1/reports` - Report generation

## Key Features

### 1. Multi-Tenant Architecture
- Row-level security (RLS) for data isolation
- Tenant-based authentication
- Organization-specific settings and features

### 2. AI Agent Management
- Hire agents with specific personality types
- Track agent performance and ROI
- Manage agent relationships and departments
- Real-time agent status updates

### 3. Business Metrics
- Time-series data storage
- Aggregated metrics by department/agent
- Comparative analysis across periods
- ROI calculations

### 4. Natural Language Commands
- Command history tracking
- Intent recognition
- Execution tracking
- Success/failure analytics

### 5. Real-Time Updates
- WebSocket connections for live data
- Event-driven architecture
- Redis pub/sub for scalability

## API Usage Examples

### Organization Management

```typescript
// Create organization
POST /api/v1/organizations
{
  "tenant_id": "firebase-tenant-id",
  "name": "Acme Corp",
  "industry": "technology",
  "size": "startup"
}

// Get organization
GET /api/v1/organizations/{id}

// Update settings
PATCH /api/v1/organizations/{id}/settings
{
  "theme": "dark",
  "features": {
    "voice_commands": true,
    "predictive_analytics": true
  }
}
```

### Agent Operations

```typescript
// Hire new agent
POST /api/v1/agents/hire
{
  "organizationId": "org-uuid",
  "departmentId": "dept-uuid",
  "businessRole": "Sales Representative",
  "level": "specialist",
  "personalityType": "hunter",
  "budget": 50
}

// List agents
GET /api/v1/agents?organizationId={orgId}&status=active&sort=performance_rating:desc

// Execute task
POST /api/v1/agents/{agentId}/tasks
{
  "type": "generate_report",
  "params": {
    "reportType": "sales_forecast",
    "period": "Q1"
  }
}
```

### Metrics & Analytics

```typescript
// Record metric
POST /api/v1/metrics
{
  "organization_id": "org-uuid",
  "metric_type": "revenue",
  "metric_subtype": "sales_revenue",
  "value": 50000,
  "currency": "rUv",
  "period_start": "2025-01-01T00:00:00Z",
  "period_end": "2025-01-31T23:59:59Z",
  "agent_id": "agent-123"
}

// Get aggregated metrics
GET /api/v1/metrics/aggregate?organizationId={orgId}&metricTypes=revenue,costs&granularity=day&start=2025-01-01&end=2025-01-31

// Compare periods
GET /api/v1/metrics/compare?organizationId={orgId}&currentStart=2025-01-01&currentEnd=2025-01-31&previousStart=2024-12-01&previousEnd=2024-12-31
```

### Natural Language Commands

```typescript
// Execute command
POST /api/v1/commands
{
  "command": "Hire 3 sales agents focused on enterprise clients",
  "context": {
    "departmentId": "sales-dept-uuid"
  }
}

// Response
{
  "intent": {
    "action": "hire_agents",
    "confidence": 0.95,
    "entities": {
      "count": 3,
      "role": "sales",
      "specialization": "enterprise"
    }
  },
  "result": {
    "success": true,
    "message": "Successfully hired 3 sales agents",
    "data": {
      "agents": ["agent-1", "agent-2", "agent-3"],
      "totalCost": 150
    }
  }
}
```

## Database Schema Overview

### Core Tables

1. **organizations** - Multi-tenant organization data
2. **departments** - Organizational structure
3. **agent_profiles** - AI agent business profiles
4. **agent_relationships** - Reporting structure
5. **business_metrics** - Time-series financial data
6. **agent_performance** - Daily performance metrics
7. **command_history** - Natural language command log
8. **saved_reports** - Dashboard and report configurations
9. **projects** - Business initiatives tracking
10. **scenarios** - What-if scenario planning
11. **alert_configs** - Monitoring and alerting

### Key Relationships
- Organizations → Departments (1:N)
- Departments → Agents (1:N)
- Agents → Metrics (1:N)
- Agents → Performance Records (1:N)
- Organizations → Commands (1:N)

## Performance Optimizations

1. **Database**
   - Comprehensive indexes on frequently queried columns
   - Partitioned tables for time-series data (future enhancement)
   - Connection pooling with Slonik

2. **Caching**
   - Redis caching for frequently accessed data
   - TTL-based cache invalidation
   - Cache-aside pattern implementation

3. **Real-time Updates**
   - WebSocket for push notifications
   - Redis pub/sub for scalability
   - Event-driven architecture

## Security Considerations

1. **Authentication**
   - JWT tokens with expiration
   - Refresh token rotation
   - API key for service-to-service communication

2. **Authorization**
   - Row-level security in PostgreSQL
   - Organization-based data isolation
   - Role-based access control (RBAC)

3. **Data Protection**
   - Encrypted connections (TLS)
   - Sensitive data redaction in logs
   - Rate limiting to prevent abuse

## Deployment

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname
DB_POOL_SIZE=10

# Redis
REDIS_URL=redis://localhost:6379

# QuDAG Integration
QUDAG_API_URL=http://qudag-api:8080
QUDAG_EXCHANGE_URL=http://qudag-exchange:8081
QUDAG_WS_URL=ws://qudag-api:8080/ws
QUDAG_API_KEY=your-api-key

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Features
ENABLE_PREDICTIVE_ANALYTICS=true
ENABLE_VOICE_COMMANDS=true
ENABLE_AUTO_SCALING=true
```

### Docker Support
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 8090
CMD ["node", "dist/index.js"]
```

## Development

### Setup
```bash
# Install dependencies
npm install

# Run database migrations
psql -f init-db.sql

# Start development server
npm run dev
```

### Testing
```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Type checking
npm run typecheck
```

## Monitoring

1. **Metrics Collection**
   - Built-in metrics collector service
   - Prometheus-compatible metrics endpoint
   - Custom business metrics tracking

2. **Logging**
   - Structured logging with Pino
   - Log levels: trace, debug, info, warn, error
   - Request/response logging

3. **Health Checks**
   - `/health` endpoint for service status
   - Database connectivity check
   - Redis connectivity check

## Future Enhancements

1. **Advanced Analytics**
   - Predictive modeling integration
   - Machine learning pipelines
   - Anomaly detection

2. **Scalability**
   - Horizontal scaling with clustering
   - Database sharding
   - Microservices architecture

3. **Integration**
   - Webhook support for external systems
   - GraphQL API layer
   - Real-time collaboration features

## Support

For questions or issues:
- Check the API documentation at `/api/docs`
- Review error codes and messages
- Contact the QuDAG development team

---

_"Building the future of AI-powered business intelligence, one metric at a time."_ - CleoClaudeDesktop