import axios from "axios";

// API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    "Content-Type": "application/json",
  },
});

// API types for business metrics
export interface BusinessMetrics {
  revenue: {
    current: number;
    previous: number;
    growth: number;
    currency: string;
  };
  agents: {
    total: number;
    active: number;
    efficiency: number;
  };
  operations: {
    totalTasks: number;
    completedTasks: number;
    successRate: number;
    avgCompletionTime: number;
  };
  costs: {
    compute: number;
    storage: number;
    network: number;
    total: number;
  };
}

export interface RevenueStream {
  id: string;
  name: string;
  type: "recurring" | "one-time" | "usage-based";
  amount: number;
  lastUpdate: string;
  status: "active" | "paused" | "terminated";
  agentId?: string;
}

export interface AgentPerformance {
  id: string;
  name: string;
  type: string;
  tasksCompleted: number;
  successRate: number;
  revenueGenerated: number;
  costIncurred: number;
  roi: number;
  status: "active" | "idle" | "error";
}

export interface Transaction {
  id: string;
  timestamp: string;
  type: "revenue" | "cost" | "transfer";
  amount: number;
  description: string;
  agentId?: string;
  status: "completed" | "pending" | "failed";
}

// API endpoints
export const businessApi = {
  // Dashboard metrics
  getMetrics: async (): Promise<BusinessMetrics> => {
    const { data } = await api.get("/business/metrics");
    return data;
  },

  // Revenue streams
  getRevenueStreams: async (): Promise<RevenueStream[]> => {
    const { data } = await api.get("/business/revenue-streams");
    return data;
  },

  // Agent performance
  getAgentPerformance: async (): Promise<AgentPerformance[]> => {
    const { data } = await api.get("/business/agents");
    return data;
  },

  // Transaction history
  getTransactions: async (limit = 50): Promise<Transaction[]> => {
    const { data } = await api.get(`/business/transactions?limit=${limit}`);
    return data;
  },

  // Account balance
  getBalance: async (): Promise<{ balance: number; currency: string }> => {
    const { data } = await api.get("/accounts/balance");
    return data;
  },
};

// Define proper types for WebSocket data
export interface WebSocketMessage {
  topic: string;
  type: "metrics" | "transaction" | "agent_status" | "system_alert";
  data: BusinessMetrics | Transaction | AgentPerformance | SystemAlert;
  timestamp: string;
}

export interface SystemAlert {
  id: string;
  level: "info" | "warning" | "error" | "critical";
  message: string;
  source: string;
}

// WebSocket connection for real-time updates
export class RealtimeConnection {
  private ws: WebSocket | null = null;
  private subscribers: Map<string, Set<(data: WebSocketMessage) => void>> =
    new Map();

  connect() {
    const wsUrl = API_BASE_URL.replace("http", "ws") + "/ws";
    this.ws = new WebSocket(wsUrl);

    this.ws.onmessage = (event) => {
      const data: WebSocketMessage = JSON.parse(event.data);
      const topic = data.topic || "default";

      const handlers = this.subscribers.get(topic);
      if (handlers) {
        handlers.forEach((handler) => handler(data));
      }
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    this.ws.onclose = () => {
      // Reconnect after 3 seconds
      setTimeout(() => this.connect(), 3000);
    };
  }

  subscribe(topic: string, handler: (data: WebSocketMessage) => void) {
    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, new Set());
    }
    this.subscribers.get(topic)!.add(handler);

    return () => {
      this.subscribers.get(topic)?.delete(handler);
    };
  }

  disconnect() {
    this.ws?.close();
  }
}

export const realtime = new RealtimeConnection();
