---
created: 2025-06-23T00:00:00Z
updated: 2025-06-23T00:00:00Z
updatedBy: CleoClaudeDesktop
version: 1.0.0
---

# QuDAG Executive Intelligence Center - Data Layer Architecture

## Overview

The QuDAG Business Intelligence API serves as the comprehensive data layer for the Executive Intelligence Center, enabling AI-powered business management through natural language commands and real-time analytics.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Executive Intelligence UI                      │
│                 (React + Voice Commands + 3D Viz)                │
└─────────────────────┬───────────────────────┬──────────────────┘
                      │ HTTPS                 │ WebSocket
                      ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Business Intelligence API                        │
│                    (Node.js + Fastify)                           │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │   Routes    │  │   Services   │  │    Middleware       │   │
│  │ • Health    │  │ • Org        │  │ • Authentication    │   │
│  │ • Orgs      │  │ • Agent      │  │ • Authorization     │   │
│  │ • Agents    │  │ • Metrics    │  │ • Rate Limiting     │   │
│  │ • Metrics   │  │ • Command    │  │ • Error Handling    │   │
│  │ • Commands  │  │ • QuDAG Int. │  └─────────────────────┘   │
│  │ • Dashboards│  └──────────────┘                             │
│  └─────────────┘                                               │
└────────┬─────────────────┬────────────────┬───────────────────┘
         │ Slonik          │ Redis          │ HTTP/WS
         ▼                 ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌────────────────┐
│  PostgreSQL  │  │    Redis     │  │  QuDAG Core    │
│              │  │              │  │                │
│ • Multi-tenant│ │ • Caching    │  │ • Agent Mgmt   │
│ • Time-series│  │ • Real-time  │  │ • Task Exec    │
│ • RLS Security│ │ • Pub/Sub    │  │ • Exchange     │
└──────────────┘  └──────────────┘  └────────────────┘
```

## Core Components

### 1. Database Schema (PostgreSQL)

#### Executive Schema Tables:
- **organizations** - Multi-tenant company data
- **departments** - Organizational hierarchy
- **agent_profiles** - AI agent business profiles
- **agent_relationships** - Reporting structure
- **business_metrics** - Time-series financial data
- **agent_performance** - Daily performance metrics
- **command_history** - Natural language command log
- **saved_reports** - Dashboard configurations
- **projects** - Business initiatives
- **scenarios** - What-if planning
- **alert_configs** - Monitoring rules

### 2. API Services

#### Organization Service
- Multi-tenant management
- Settings and feature toggles
- Tenant isolation

#### Agent Service
- Agent hiring and management
- Performance tracking
- Task execution
- Team compatibility

#### Metrics Service
- Real-time data collection
- Aggregation and analysis
- ROI calculations
- Forecasting

#### Command Service
- Natural language processing
- Intent recognition
- Command execution
- History tracking

#### QuDAG Integration
- Core platform connectivity
- WebSocket real-time updates
- Agent orchestration

### 3. Real-time Features

#### WebSocket Connections
- Live metric updates
- Agent status changes
- Command results
- Alert notifications

#### Redis Pub/Sub
- Event broadcasting
- Cache invalidation
- Distributed updates

#### Metrics Collector
- Automated data gathering
- Performance monitoring
- Anomaly detection
- Report generation

## Key Features

### 1. Natural Language Commands

```javascript
// Example Commands
"Hire 5 sales agents with hunter personality"
"Show revenue trend for last quarter"
"Optimize team for maximum efficiency"
"Forecast next month's operational costs"
"Compare this week to last week performance"
```

### 2. Multi-tenant Architecture

- Row-level security (RLS)
- Tenant-based data isolation
- Organization-specific settings
- Secure API access

### 3. Performance Optimizations

- Connection pooling
- Redis caching layers
- Indexed queries
- Efficient aggregations

### 4. Business Intelligence

- Real-time dashboards
- Customizable reports
- Predictive analytics
- Scenario planning

## API Endpoints

### Core Endpoints

```
GET    /api/v1/health              - Service health check
GET    /api/v1/health/detailed     - Detailed health status

# Organizations
GET    /api/v1/organizations       - List organizations
POST   /api/v1/organizations       - Create organization
GET    /api/v1/organizations/:id   - Get organization
PATCH  /api/v1/organizations/:id   - Update organization
DELETE /api/v1/organizations/:id   - Delete organization

# Agents
POST   /api/v1/agents/hire         - Hire new agent
GET    /api/v1/agents              - List agents
GET    /api/v1/agents/:id          - Get agent details
PATCH  /api/v1/agents/:id          - Update agent
POST   /api/v1/agents/:id/tasks    - Execute task
POST   /api/v1/agents/:id/retire   - Retire agent

# Metrics
POST   /api/v1/metrics             - Record metric
GET    /api/v1/metrics/aggregate   - Get aggregated metrics
GET    /api/v1/metrics/compare     - Compare periods
GET    /api/v1/metrics/roi         - Calculate ROI
GET    /api/v1/metrics/trends      - Performance trends
GET    /api/v1/metrics/forecast    - Generate forecast
GET    /api/v1/metrics/dashboard   - Dashboard data

# Commands
POST   /api/v1/commands            - Execute command
GET    /api/v1/commands/history    - Command history
GET    /api/v1/commands/stats      - Command statistics
GET    /api/v1/commands/templates  - Command templates

# Dashboards
POST   /api/v1/dashboards          - Create dashboard
GET    /api/v1/dashboards          - List dashboards
GET    /api/v1/dashboards/:id      - Get dashboard
PATCH  /api/v1/dashboards/:id      - Update dashboard
DELETE /api/v1/dashboards/:id      - Delete dashboard
POST   /api/v1/dashboards/:id/generate - Generate report
```

### WebSocket Events

```javascript
// Subscribe to real-time updates
ws.send({ type: 'subscribe', topics: ['metrics', 'agents', 'alerts'] });

// Receive updates
{
  type: 'metric_update',
  payload: { metric: 'revenue', value: 50000, change: '+5%' }
}

{
  type: 'agent_status',
  payload: { agentId: 'agent-123', status: 'busy', task: 'generating_report' }
}
```

## Development Setup

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Docker (optional)

### Quick Start

```bash
# Clone repository
git clone <repo-url>
cd QuDAG/business-intelligence-api

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Initialize database
psql -f init-db.sql

# Start development server
npm run dev

# Or use Docker
docker-compose up -d
```

### Testing

```bash
# Run unit tests
npm test

# Run API tests
node scripts/test-api.js

# Seed sample data
npm run db:seed
```

## Production Deployment

### Environment Variables
- `NODE_ENV=production`
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection
- `JWT_SECRET` - Strong secret key
- `QUDAG_API_KEY` - QuDAG platform key

### Docker Deployment

```bash
# Build image
docker build -t qudag-bi-api:latest .

# Run with environment
docker run -d \
  -p 8090:8090 \
  --env-file .env.production \
  qudag-bi-api:latest
```

### Monitoring

- Health endpoint: `/api/v1/health`
- Metrics endpoint: `/api/v1/metrics`
- Logs: Structured JSON via Pino
- Alerts: Configurable thresholds

## Security Considerations

1. **Authentication**: JWT-based with refresh tokens
2. **Authorization**: Role-based access control
3. **Data Isolation**: Row-level security per tenant
4. **Rate Limiting**: Configurable per endpoint
5. **Input Validation**: Zod schemas on all inputs
6. **SQL Injection**: Prevented via Slonik
7. **XSS Protection**: Helmet middleware

## Performance Guidelines

1. **Caching Strategy**
   - Organizations: 1 hour TTL
   - Agents: 5 minute TTL
   - Metrics: 1 minute TTL

2. **Query Optimization**
   - Comprehensive indexes
   - Aggregation pre-computation
   - Connection pooling

3. **Real-time Updates**
   - WebSocket for push updates
   - Redis pub/sub for scaling
   - Debounced metric collection

## Future Enhancements

1. **Advanced Analytics**
   - Machine learning predictions
   - Anomaly detection algorithms
   - Automated optimization

2. **Scalability**
   - Horizontal pod autoscaling
   - Database sharding
   - Microservices architecture

3. **Integration**
   - Webhook support
   - GraphQL API layer
   - Third-party connectors

## Support & Documentation

- API Documentation: `/api/docs` (when enabled)
- Error Codes: Standardized format
- Support: QuDAG development team

---

_"Building the future of AI-powered business intelligence, one query at a time."_ - CleoClaudeDesktop