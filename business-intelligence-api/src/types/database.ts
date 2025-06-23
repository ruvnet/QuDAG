/**
 * @description Database type definitions for QuDAG Business Intelligence
 * @author CleoClaudeDesktop
 * @created 2025-06-23
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial types matching schema
 */

import { Decimal } from 'decimal.js';

// Organization types
export interface Organization {
  id: string;
  tenant_id: string;
  name: string;
  logo_url?: string;
  industry?: string;
  size?: 'startup' | 'smb' | 'enterprise';
  created_at: Date;
  updated_at: Date;
  settings: OrganizationSettings;
  metadata: Record<string, any>;
}

export interface OrganizationSettings {
  theme: 'light' | 'dark';
  language: string;
  timezone: string;
  features: {
    voice_commands: boolean;
    predictive_analytics: boolean;
    auto_scaling: boolean;
  };
}

// Department types
export interface Department {
  id: string;
  organization_id: string;
  name: string;
  type: 'sales' | 'operations' | 'service' | 'r&d' | 'finance';
  parent_id?: string;
  manager_agent_id?: string;
  budget_allocation: Decimal;
  created_at: Date;
  metadata: Record<string, any>;
}

// Agent types
export interface AgentProfile {
  agent_id: string;
  organization_id: string;
  department_id?: string;
  business_role: string;
  title?: string;
  level: 'executive' | 'manager' | 'specialist' | 'operator';
  personality_type: 'hunter' | 'farmer' | 'analyst' | 'creative' | 'executor';
  personality_traits: PersonalityTraits;
  compatibility: AgentCompatibility;
  cost_per_hour: Decimal;
  hired_at: Date;
  last_active: Date;
  status: 'active' | 'idle' | 'error' | 'maintenance' | 'retired';
  performance_rating: number; // 0.00 to 5.00
  custom_settings: Record<string, any>;
  metadata: Record<string, any>;
}

export interface PersonalityTraits {
  speed: number;      // 0-100
  accuracy: number;   // 0-100
  creativity: number; // 0-100
  collaboration: number; // 0-100
}

export interface AgentCompatibility {
  best_with: string[];    // Array of agent IDs
  avoid_with: string[];   // Array of agent IDs
}

// Relationship types
export interface AgentRelationship {
  id: string;
  organization_id: string;
  supervisor_agent_id: string;
  subordinate_agent_id: string;
  relationship_type: 'reports_to' | 'collaborates_with' | 'backs_up';
  created_at: Date;
}

// Business metrics types
export interface BusinessMetric {
  id: string;
  organization_id: string;
  metric_type: 'revenue' | 'costs' | 'profit' | 'efficiency' | 'quality';
  metric_subtype?: string;
  value: Decimal;
  currency: string;
  period_start: Date;
  period_end: Date;
  department_id?: string;
  agent_id?: string;
  metadata: Record<string, any>;
  created_at: Date;
}

// Agent performance types
export interface AgentPerformance {
  id: string;
  agent_id: string;
  organization_id: string;
  metric_date: Date;
  tasks_completed: number;
  tasks_failed: number;
  success_rate: number;
  avg_response_time_ms: number;
  revenue_generated: Decimal;
  costs_incurred: Decimal;
  roi: number;
  quality_score: number; // 0.00 to 5.00
  metadata: Record<string, any>;
  created_at: Date;
}

// Command history types
export interface CommandHistory {
  id: string;
  organization_id: string;
  user_id: string;
  command_text: string;
  command_type?: 'hire' | 'scale' | 'analyze' | 'report' | 'optimize';
  intent?: CommandIntent;
  result?: CommandResult;
  success: boolean;
  error_message?: string;
  execution_time_ms?: number;
  executed_at: Date;
  metadata: Record<string, any>;
}

export interface CommandIntent {
  action: string;
  entities: Record<string, any>;
  confidence: number;
}

export interface CommandResult {
  data?: any;
  message?: string;
  actions_taken?: string[];
}

// Report types
export interface SavedReport {
  id: string;
  organization_id: string;
  name: string;
  type: 'dashboard' | 'report' | 'analysis' | 'board_package';
  description?: string;
  configuration: ReportConfiguration;
  schedule?: ReportSchedule;
  recipients: string[];
  is_public: boolean;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  last_generated_at?: Date;
  metadata: Record<string, any>;
}

export interface ReportConfiguration {
  metrics: string[];
  filters: Record<string, any>;
  timeRange: {
    start: Date;
    end: Date;
  };
  groupBy?: string[];
  visualization?: string;
}

export interface ReportSchedule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  dayOfWeek?: number;
  dayOfMonth?: number;
  hour: number;
  timezone: string;
}

// Project types
export interface Project {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  status: 'planning' | 'active' | 'paused' | 'completed' | 'cancelled';
  department_id?: string;
  lead_agent_id?: string;
  budget_allocated: Decimal;
  budget_spent: Decimal;
  start_date?: Date;
  target_date?: Date;
  completion_date?: Date;
  success_metrics: Record<string, any>;
  assigned_agents: string[];
  created_at: Date;
  updated_at: Date;
  metadata: Record<string, any>;
}

// Scenario planning types
export interface Scenario {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  type?: 'scaling' | 'cost_optimization' | 'market_change' | 'competitor_response';
  parameters: ScenarioParameters;
  results?: ScenarioResults;
  recommendations?: Recommendation[];
  created_by: string;
  created_at: Date;
  executed_at?: Date;
  metadata: Record<string, any>;
}

export interface ScenarioParameters {
  [key: string]: any;
}

export interface ScenarioResults {
  predicted_outcomes: any[];
  probability_scores: Record<string, number>;
  impact_analysis: any;
}

export interface Recommendation {
  action: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  impact: string;
  effort: 'low' | 'medium' | 'high';
  timeframe: string;
}

// Alert types
export interface AlertConfig {
  id: string;
  organization_id: string;
  name: string;
  type: 'metric_threshold' | 'anomaly' | 'prediction';
  condition: AlertCondition;
  severity: 'low' | 'medium' | 'high' | 'critical';
  notification_channels: ('dashboard' | 'email' | 'sms' | 'webhook')[];
  is_active: boolean;
  last_triggered_at?: Date;
  created_at: Date;
  metadata: Record<string, any>;
}

export interface AlertCondition {
  metric: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  threshold: number;
  duration?: number; // in seconds
  aggregation?: 'avg' | 'sum' | 'min' | 'max';
}

// Query helpers
export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface TimeRangeParams {
  start: Date;
  end: Date;
}

export interface FilterParams {
  field: string;
  operator: string;
  value: any;
}

export interface SortParams {
  field: string;
  direction: 'asc' | 'desc';
}