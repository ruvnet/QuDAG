# QuDAG Executive Dashboard

A business-focused executive dashboard for CEOs of zero-person enterprises running on QuDAG's autonomous agent infrastructure.

## Overview

This dashboard provides real-time insights into:

- **Revenue & Profitability** - Track rUv token flows and profit margins
- **Agent Performance** - Monitor AI agent efficiency and ROI
- **Operational Metrics** - View task completion rates and success metrics
- **Cost Analysis** - Breakdown of compute, storage, and network costs

## Features

### Business KPIs

- Total revenue with growth trends
- Net profit and profit margins
- Active agent utilization
- Task completion statistics

### Agent Management

- Real-time agent status monitoring
- Performance metrics per agent
- ROI calculations
- Task success rates

### Financial Visualization

- Revenue and profitability charts
- Cost breakdown analysis
- Historical trend analysis
- Period-over-period comparisons

## Getting Started

### Prerequisites

- Node.js 18+
- QuDAG node running locally on port 8080

### Installation

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

The dashboard will be available at `http://localhost:5173`

### Configuration

Set the API endpoint in your environment:

```bash
# .env.local
VITE_API_URL=http://localhost:8080
```

## Architecture

Built with:

- **React + TypeScript** - Type-safe component development
- **Tailwind CSS** - Utility-first styling
- **Recharts** - Data visualization
- **React Query** - Server state management
- **Axios** - API communication

## Usage

### Time Period Selection

Use the dropdown in the header to view metrics for:

- Last 24 hours
- Last 7 days
- Last 30 days
- Last 90 days

### Quick Actions

- **Deploy New Agent** - Launch additional AI agents
- **Scale Operations** - Increase processing capacity
- **Optimize Costs** - Analyze and reduce expenses
- **View Reports** - Generate detailed analytics

## API Integration

The dashboard connects to QuDAG's HTTP API endpoints:

```typescript
GET /api/v1/business/metrics     # Overall business metrics
GET /api/v1/business/revenue-streams  # Revenue breakdown
GET /api/v1/business/agents      # Agent performance data
GET /api/v1/business/transactions # Transaction history
```

WebSocket connection for real-time updates:

```
ws://localhost:8080/ws
```

## Development

### Project Structure

```
src/
├── components/       # Reusable UI components
├── lib/             # API client and utilities
├── App.tsx          # Main dashboard component
└── main.tsx         # Application entry point
```

### Adding New Metrics

1. Define the metric type in `lib/api.ts`
2. Create a component in `components/`
3. Import and use in `App.tsx`

### Customization

Modify the theme in `tailwind.config.js` to match your brand colors.

## Production Build

```bash
# Build for production
npm run build

# Preview the production build
npm run preview
```

## Future Enhancements

- [ ] Real-time WebSocket updates
- [ ] Dark mode support
- [ ] Export reports to PDF
- [ ] Mobile responsive design
- [ ] Multi-account support
- [ ] Custom alert configuration
- [ ] Historical data analysis
- [ ] Predictive analytics

## License

MIT
