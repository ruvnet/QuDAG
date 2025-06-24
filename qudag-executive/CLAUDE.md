# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## QuDAG Executive Intelligence Center

The QuDAG Executive is a React-based dashboard application that provides a "Business Operating System for zero-person companies" - an AI-CEO interface for managing autonomous AI agent workforces.

## Build Commands

### Development
```bash
npm install              # Install dependencies
npm run dev             # Start Vite development server (http://localhost:5173)
npm run preview         # Preview production build locally
```

### Production Build
```bash
npm run build           # Build with TypeScript compilation + Vite build
npm run lint            # Run ESLint
```

### Testing
```bash
# Note: Test commands not yet implemented in package.json
# npm run test           # Run tests
# npm run test:watch     # Run tests in watch mode
```

## Key Architecture

### Frontend Stack
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite with React plugin
- **Styling**: Tailwind CSS with custom design system
- **State Management**: Custom React hooks (useCockpit)
- **Data Fetching**: TanStack Query (React Query)
- **HTTP Client**: Axios
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Charts**: Recharts
- **UI Components**: Custom components built on Radix UI primitives

### Core Architecture Patterns

1. **Tab-Based Navigation System**: Dynamic tabs with configurable content, closable tabs, and sidebar navigation
2. **Theme System**: Light/dark theme with persistent localStorage state
3. **Real-Time Data Dashboard**: Live API integration with business intelligence metrics
4. **Modular Component Architecture**: Reusable components for tables, metrics, charts, and forms

### Key Directories Structure
```
src/
├── components/          # Reusable UI components
│   ├── tables/         # Data table components (Agents, Metrics, Projects)
│   └── tabs/           # Tab content components (Dashboard, DataDashboard, Placeholder)
├── hooks/              # Custom React hooks (useCockpit for state management)
├── lib/                # Utility functions (utils.ts, api.ts)
├── services/           # API service layer (comprehensive backend integration)
├── styles/             # Global styles and fonts
└── types/              # TypeScript type definitions
```

### State Management Pattern

The `useCockpit` hook manages global application state:
- **Theme**: Light/dark mode with localStorage persistence
- **Tab System**: Dynamic tab creation, removal, and navigation
- **Sidebar**: Collapsible sidebar state
- **Notifications**: Toast notification system with auto-dismiss

### API Integration

The application integrates with a backend API (default: `http://localhost:8090`) through a comprehensive service layer:

- **Organizations**: Multi-tenant organization management
- **Agents**: AI agent profiles with performance tracking
- **Departments**: Organizational structure management
- **Business Metrics**: Revenue, costs, efficiency tracking
- **Projects**: Project portfolio management
- **Performance Data**: Real-time agent performance analytics

### Data Dashboard Features

The DataDashboardTab provides real-time business intelligence:
- **Overview**: System health, key metrics, and quick summaries
- **Agents Table**: AI workforce management with performance data
- **Metrics Table**: Business performance indicators and analytics
- **Projects Table**: Project portfolio tracking and budget management

## Development Guidelines

### Component Patterns
- Use TypeScript for all components with proper type definitions
- Implement dark/light theme support via className conditionals
- Use Tailwind CSS with the `cn()` utility for conditional classes
- Implement proper loading states and error handling for API calls
- Follow the established tab system pattern for new features

### API Service Layer
- All backend communication goes through `src/services/api.ts`
- Use TanStack Query for data fetching with proper caching
- Implement proper TypeScript interfaces for all API responses
- Handle errors gracefully with user-friendly notifications

### State Management
- Use the `useCockpit` hook for global state
- Avoid prop drilling by using the established context patterns
- Implement proper cleanup for side effects
- Use localStorage only for persistent preferences (theme, sidebar state)

### Styling Conventions
- Use Tailwind CSS utility classes
- Dark theme: `dark:` prefixes with gray color palette
- Light theme: Standard classes with white/gray backgrounds
- Consistent spacing: `p-6`, `gap-4`, `space-y-6` patterns
- Animation: Use Framer Motion for page transitions and interactions

## Business Intelligence Data Types

The application handles these core business entities:
- **Organizations**: Multi-tenant business entities with settings and metadata
- **AgentProfiles**: AI agents with roles, performance ratings, and personality types
- **BusinessMetrics**: Revenue, cost, profit, and efficiency tracking
- **Projects**: Business projects with budgets, timelines, and agent assignments
- **Departments**: Organizational hierarchy with budget allocations

## Integration Points

### Backend API Integration
- Default API base: `http://localhost:8090`
- RESTful endpoints with standardized response format
- Pagination support for large datasets
- Real-time data updates via polling (refetchInterval in queries)

### Planned Desktop Integration
- The README mentions future Tauri desktop app integration
- Web version serves as the base for native desktop applications
- Platform detection for desktop-specific features

## Environment Configuration

Create `.env.local` for local development:
```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:8090
VITE_API_TIMEOUT=10000

# Feature Flags  
VITE_ENABLE_QUANTUM_CRYPTO=true
VITE_ENABLE_VOICE_COMMANDS=false
```

## Common Development Tasks

### Adding New Dashboard Tabs
1. Create component in `src/components/tabs/`
2. Add tab configuration in `App.tsx` tab configs object
3. Implement proper theme support and loading states
4. Add API integration if needed via services layer

### Adding New Data Tables
1. Create table component in `src/components/tables/`
2. Implement sorting, filtering, and pagination
3. Use consistent styling patterns from existing tables
4. Add proper TypeScript interfaces for data types

### Adding New API Endpoints
1. Add TypeScript interfaces in `src/services/api.ts`
2. Implement service functions with proper error handling
3. Add TanStack Query integration for caching
4. Update components to use new endpoints

## ARM64 Support Notes

This frontend application runs on any Node.js environment and doesn't have ARM64-specific requirements. However, it connects to QuDAG backend services that have ARM64 considerations:

### Backend Integration
```bash
# For ARM64 systems, start the backend with:
./build-arm64.sh              # Docker-based (full functionality)
./build-arm64-native.sh       # Native ARM64 build
./build-arm64-essential.sh    # Core components only

# Then start frontend normally:
npm run dev
```

### Environment Variables for ARM64 Backend
```bash
# .env.local - Adjust API URL based on backend deployment
VITE_API_BASE_URL=http://localhost:8080   # Standard backend port
VITE_API_BASE_URL=http://localhost:8090   # Alternative port
```