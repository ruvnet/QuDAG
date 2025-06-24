/**
 * @description API service layer for QuDAG Executive Intelligence Center
 * @author CleoClaudeDesktop
 * @created 2025-06-23
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial API integration
 */

import axios from 'axios';
import type { AxiosInstance } from 'axios';

// Base API configuration
const API_BASE_URL = 'http://localhost:8090';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for auth (when we add it)
api.interceptors.request.use((config) => {
  // Add auth token here when implemented
  // const token = localStorage.getItem('auth_token');
  // if (token) {
  //   config.headers.Authorization = `Bearer ${token}`;
  // }
  return config;
});

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

// Type definitions based on our backend schema
export interface Organization {
  id: string;
  tenant_id: string;
  name: string;
  logo_url?: string;
  industry?: string;
  size?: 'startup' | 'smb' | 'enterprise';
  created_at: string;
  updated_at: string;
  settings: {
    theme: 'light' | 'dark';
    language: string;
    timezone: string;
    features: {
      voice_commands: boolean;
      predictive_analytics: boolean;
      auto_scaling: boolean;
    };
  };
  metadata: Record<string, unknown>;
}

export interface Department {
  id: string;
  organization_id: string;
  name: string;
  type: 'sales' | 'operations' | 'service' | 'r&d' | 'finance';
  parent_id?: string;
  manager_agent_id?: string;
  budget_allocation: number;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface AgentProfile {
  agent_id: string;
  organization_id: string;
  department_id?: string;
  business_role: string;
  title?: string;
  level: 'executive' | 'manager' | 'specialist' | 'operator';
  personality_type: 'hunter' | 'farmer' | 'analyst' | 'creative' | 'executor';
  personality_traits: {
    speed: number;
    accuracy: number;
    creativity: number;
    collaboration: number;
  };
  cost_per_hour: number;
  hired_at: string;
  last_active: string;
  status: 'active' | 'idle' | 'error' | 'maintenance' | 'retired';
  performance_rating: number;
  custom_settings: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface BusinessMetric {
  id: string;
  organization_id: string;
  metric_type: 'revenue' | 'costs' | 'profit' | 'efficiency' | 'quality';
  metric_subtype?: string;
  value: number;
  currency: string;
  period_start: string;
  period_end: string;
  department_id?: string;
  agent_id?: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AgentPerformance {
  id: string;
  agent_id: string;
  organization_id: string;
  metric_date: string;
  tasks_completed: number;
  tasks_failed: number;
  success_rate: number;
  avg_response_time_ms: number;
  revenue_generated: number;
  costs_incurred: number;
  roi: number;
  quality_score: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  status: 'planning' | 'active' | 'paused' | 'completed' | 'cancelled';
  department_id?: string;
  lead_agent_id?: string;
  budget_allocated: number;
  budget_spent: number;
  start_date?: string;
  target_date?: string;
  completion_date?: string;
  success_metrics: Record<string, unknown>;
  assigned_agents: string[];
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: string;
    requestId: string;
    version: string;
  };
}

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

// API Service functions
export const apiService = {
  // Health check
  health: async () => {
    const response = await api.get<{ success: boolean; status: string; timestamp: string; service: string; version: string }>('/api/v1/health');
    return response.data;
  },

  // Organizations
  organizations: {
    list: async (page = 1, pageSize = 10) => {
      const response = await api.get<PaginatedResponse<Organization>>('/api/v1/organizations', {
        params: { page, pageSize }
      });
      return response.data;
    },
    
    get: async (id: string) => {
      const response = await api.get<ApiResponse<Organization>>(`/api/v1/organizations/${id}`);
      return response.data;
    },
    
    create: async (data: Partial<Organization>) => {
      const response = await api.post<ApiResponse<Organization>>('/api/v1/organizations', data);
      return response.data;
    },
    
    update: async (id: string, data: Partial<Organization>) => {
      const response = await api.put<ApiResponse<Organization>>(`/api/v1/organizations/${id}`, data);
      return response.data;
    },
    
    delete: async (id: string) => {
      const response = await api.delete<ApiResponse<void>>(`/api/v1/organizations/${id}`);
      return response.data;
    }
  },

  // Departments
  departments: {
    list: async (organizationId?: string, page = 1, pageSize = 10) => {
      const response = await api.get<PaginatedResponse<Department>>('/api/v1/departments', {
        params: { organizationId, page, pageSize }
      });
      return response.data;
    },
    
    get: async (id: string) => {
      const response = await api.get<ApiResponse<Department>>(`/api/v1/departments/${id}`);
      return response.data;
    },
    
    create: async (data: Partial<Department>) => {
      const response = await api.post<ApiResponse<Department>>('/api/v1/departments', data);
      return response.data;
    }
  },

  // Agent Profiles
  agents: {
    list: async (organizationId?: string, page = 1, pageSize = 10) => {
      const response = await api.get<PaginatedResponse<AgentProfile>>('/api/v1/agents', {
        params: { organizationId, page, pageSize }
      });
      return response.data;
    },
    
    get: async (id: string) => {
      const response = await api.get<ApiResponse<AgentProfile>>(`/api/v1/agents/${id}`);
      return response.data;
    },
    
    create: async (data: Partial<AgentProfile>) => {
      const response = await api.post<ApiResponse<AgentProfile>>('/api/v1/agents', data);
      return response.data;
    },
    
    performance: async (agentId: string, days = 30) => {
      const response = await api.get<ApiResponse<AgentPerformance[]>>(`/api/v1/agents/${agentId}/performance`, {
        params: { days }
      });
      return response.data;
    }
  },

  // Business Metrics
  metrics: {
    list: async (organizationId?: string, type?: string, page = 1, pageSize = 10) => {
      const response = await api.get<PaginatedResponse<BusinessMetric>>('/api/v1/metrics', {
        params: { organizationId, type, page, pageSize }
      });
      return response.data;
    },
    
    summary: async (organizationId: string, timeRange = '30d') => {
      const response = await api.get<ApiResponse<{
        totalRevenue: number;
        totalCosts: number;
        profit: number;
        efficiency: number;
        growth: number;
      }>>(`/api/v1/metrics/summary`, {
        params: { organizationId, timeRange }
      });
      return response.data;
    }
  },

  // Projects
  projects: {
    list: async (organizationId?: string, status?: string, page = 1, pageSize = 10) => {
      const response = await api.get<PaginatedResponse<Project>>('/api/v1/projects', {
        params: { organizationId, status, page, pageSize }
      });
      return response.data;
    },
    
    get: async (id: string) => {
      const response = await api.get<ApiResponse<Project>>(`/api/v1/projects/${id}`);
      return response.data;
    },
    
    create: async (data: Partial<Project>) => {
      const response = await api.post<ApiResponse<Project>>('/api/v1/projects', data);
      return response.data;
    }
  }
};

export default apiService;