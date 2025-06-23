/**
 * @description API request/response type definitions
 * @author CleoClaudeDesktop
 * @created 2025-06-23
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial API types
 */

// Base response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

export interface ResponseMeta {
  timestamp: string;
  requestId: string;
  version: string;
}

// Pagination
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// Authentication
export interface LoginRequest {
  email: string;
  password: string;
  organizationId?: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    organizationId: string;
  };
  expiresIn: number;
}

// Natural Language Commands
export interface CommandRequest {
  command: string;
  context?: {
    departmentId?: string;
    projectId?: string;
    timeRange?: {
      start: string;
      end: string;
    };
  };
}

export interface CommandResponse {
  intent: {
    action: string;
    confidence: number;
    entities: Record<string, any>;
  };
  result: {
    success: boolean;
    message: string;
    data?: any;
    suggestedActions?: string[];
  };
  executionTime: number;
}

// Agent Management
export interface HireAgentRequest {
  businessRole: string;
  departmentId: string;
  level: 'executive' | 'manager' | 'specialist' | 'operator';
  personalityType: 'hunter' | 'farmer' | 'analyst' | 'creative' | 'executor';
  customRequirements?: {
    skills?: string[];
    experience?: string;
    specializations?: string[];
  };
  budget?: number;
}

export interface ScaleTeamRequest {
  departmentId?: string;
  targetMetric: 'revenue' | 'efficiency' | 'quality' | 'speed';
  targetValue: number;
  timeframe: 'immediate' | 'week' | 'month' | 'quarter';
  maxBudget?: number;
}

export interface OptimizeRequest {
  scope: 'organization' | 'department' | 'project';
  scopeId: string;
  optimizationGoal: 'cost' | 'performance' | 'quality' | 'balanced';
  constraints?: Record<string, any>;
}

// Metrics and Analytics
export interface MetricsRequest {
  metrics: string[];
  groupBy?: string[];
  filters?: Array<{
    field: string;
    operator: string;
    value: any;
  }>;
  timeRange: {
    start: string;
    end: string;
    granularity?: 'hour' | 'day' | 'week' | 'month';
  };
  comparison?: {
    type: 'period' | 'baseline';
    value: string;
  };
}

export interface DashboardConfig {
  id?: string;
  name: string;
  description?: string;
  widgets: DashboardWidget[];
  layout: 'grid' | 'flow';
  refreshInterval?: number;
  isPublic: boolean;
}

export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'gauge' | 'heatmap' | 'org-chart';
  title: string;
  dataSource: {
    metric: string;
    aggregation?: string;
    filters?: any[];
    groupBy?: string[];
  };
  visualization: {
    chartType?: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
    colors?: string[];
    showLegend?: boolean;
    showLabels?: boolean;
  };
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// Real-time updates via WebSocket
export interface WebSocketMessage {
  type: 'metric_update' | 'agent_status' | 'alert' | 'command_result';
  payload: any;
  timestamp: string;
}

export interface MetricUpdate {
  metric: string;
  value: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
}

export interface AgentStatusUpdate {
  agentId: string;
  status: string;
  lastActivity: string;
  currentTask?: string;
  performance: {
    successRate: number;
    avgResponseTime: number;
  };
}

// Scenario Planning
export interface ScenarioRequest {
  name: string;
  type: 'scaling' | 'cost_optimization' | 'market_change' | 'competitor_response';
  parameters: {
    baseline: Record<string, any>;
    variables: Array<{
      name: string;
      min: number;
      max: number;
      step: number;
    }>;
    constraints?: Record<string, any>;
  };
  objectives: string[];
}

export interface ScenarioResponse {
  scenarios: Array<{
    id: string;
    parameters: Record<string, any>;
    predictions: {
      revenue: number;
      costs: number;
      profit: number;
      efficiency: number;
      riskScore: number;
    };
    recommendations: Array<{
      action: string;
      impact: 'low' | 'medium' | 'high';
      confidence: number;
    }>;
  }>;
  optimalScenario: string;
  sensitivityAnalysis: Record<string, number>;
}

// Exports for easy access
export type {
  Organization,
  Department,
  AgentProfile,
  BusinessMetric,
  Project,
  SavedReport,
} from './database';