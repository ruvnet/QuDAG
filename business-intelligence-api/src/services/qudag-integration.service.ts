/**
 * @description QuDAG platform integration service
 * @author CleoClaudeDesktop
 * @created 2025-06-23
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial QuDAG integration
 */

import axios, { AxiosInstance } from 'axios';
import WebSocket from 'ws';
import { config } from '../config';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

interface QuDAGAgent {
  id: string;
  personality: {
    traits: {
      speed: number;
      accuracy: number;
      creativity: number;
      collaboration: number;
    };
    capabilities: string[];
  };
  performance: {
    successRate: number;
    avgResponseTime: number;
    totalTasks: number;
  };
  status: string;
  currentTask?: any;
}

interface HireAgentParams {
  personality: {
    type: string;
    traits: Record<string, number>;
  };
  capabilities: string[];
  metadata: Record<string, any>;
}

interface TaskExecutionParams {
  agentId: string;
  task: {
    type: string;
    params: any;
  };
  priority?: 'low' | 'normal' | 'high' | 'critical';
}

export class QuDAGIntegration extends EventEmitter {
  private api: AxiosInstance;
  private ws: WebSocket | null = null;
  private reconnectInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.api = axios.create({
      baseURL: config.qudag.apiUrl,
      headers: {
        'Authorization': `Bearer ${config.qudag.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Add request/response interceptors
    this.api.interceptors.request.use(
      (req) => {
        logger.debug({ url: req.url, method: req.method }, 'QuDAG API request');
        return req;
      },
      (error) => {
        logger.error({ error }, 'QuDAG API request error');
        return Promise.reject(error);
      }
    );

    this.api.interceptors.response.use(
      (res) => {
        logger.debug({ url: res.config.url, status: res.status }, 'QuDAG API response');
        return res;
      },
      (error) => {
        logger.error({ error: error.message, response: error.response?.data }, 'QuDAG API response error');
        return Promise.reject(error);
      }
    );
  }

  /**
   * @description Initialize WebSocket connection for real-time updates
   * @returns {Promise<void>}
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.connectWebSocket();
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * @description Connect to QuDAG WebSocket
   * @private
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  private connectWebSocket(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    this.ws = new WebSocket(config.qudag.wsUrl, {
      headers: {
        'Authorization': `Bearer ${config.qudag.apiKey}`,
      },
    });

    this.ws.on('open', () => {
      logger.info('QuDAG WebSocket connected');
      this.emit('connected');
      
      // Clear reconnect interval
      if (this.reconnectInterval) {
        clearInterval(this.reconnectInterval);
        this.reconnectInterval = null;
      }

      // Subscribe to relevant events
      this.ws?.send(JSON.stringify({
        type: 'subscribe',
        topics: ['agent:status', 'agent:performance', 'task:completed', 'metrics:update'],
      }));
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        logger.debug({ type: message.type }, 'QuDAG WebSocket message received');
        this.handleWebSocketMessage(message);
      } catch (error) {
        logger.error({ error }, 'Failed to parse WebSocket message');
      }
    });

    this.ws.on('error', (error) => {
      logger.error({ error }, 'QuDAG WebSocket error');
      this.emit('error', error);
    });

    this.ws.on('close', () => {
      logger.warn('QuDAG WebSocket disconnected');
      this.emit('disconnected');
      this.scheduleReconnect();
    });
  }

  /**
   * @description Handle incoming WebSocket messages
   * @param {any} message - WebSocket message
   * @private
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  private handleWebSocketMessage(message: any): void {
    switch (message.type) {
      case 'agent:status':
        this.emit('agent:status', message.data);
        break;
      case 'agent:performance':
        this.emit('agent:performance', message.data);
        break;
      case 'task:completed':
        this.emit('task:completed', message.data);
        break;
      case 'metrics:update':
        this.emit('metrics:update', message.data);
        break;
      default:
        logger.debug({ type: message.type }, 'Unhandled WebSocket message type');
    }
  }

  /**
   * @description Schedule WebSocket reconnection
   * @private
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  private scheduleReconnect(): void {
    if (this.reconnectInterval) {
      return;
    }

    this.reconnectInterval = setInterval(() => {
      logger.info('Attempting to reconnect to QuDAG WebSocket...');
      this.connectWebSocket();
    }, 5000);
  }

  /**
   * @description Hire a new agent
   * @param {HireAgentParams} params - Agent hiring parameters
   * @returns {Promise<QuDAGAgent>} Created agent
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async hireAgent(params: HireAgentParams): Promise<QuDAGAgent> {
    try {
      const response = await this.api.post('/agents/hire', params);
      return response.data;
    } catch (error) {
      logger.error({ error, params }, 'Failed to hire agent');
      throw error;
    }
  }

  /**
   * @description Get agent details
   * @param {string} agentId - Agent ID
   * @returns {Promise<QuDAGAgent>} Agent details
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async getAgent(agentId: string): Promise<QuDAGAgent> {
    try {
      const response = await this.api.get(`/agents/${agentId}`);
      return response.data;
    } catch (error) {
      logger.error({ error, agentId }, 'Failed to get agent');
      throw error;
    }
  }

  /**
   * @description Update agent configuration
   * @param {string} agentId - Agent ID
   * @param {any} updates - Update data
   * @returns {Promise<QuDAGAgent>} Updated agent
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async updateAgent(agentId: string, updates: any): Promise<QuDAGAgent> {
    try {
      const response = await this.api.patch(`/agents/${agentId}`, updates);
      return response.data;
    } catch (error) {
      logger.error({ error, agentId, updates }, 'Failed to update agent');
      throw error;
    }
  }

  /**
   * @description Execute task with agent
   * @param {TaskExecutionParams} params - Task execution parameters
   * @returns {Promise<any>} Task result
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async executeTask(params: TaskExecutionParams): Promise<any> {
    try {
      const response = await this.api.post('/tasks/execute', params);
      return response.data;
    } catch (error) {
      logger.error({ error, params }, 'Failed to execute task');
      throw error;
    }
  }

  /**
   * @description Get agent performance metrics
   * @param {string} agentId - Agent ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<any>} Performance metrics
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async getAgentMetrics(
    agentId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    try {
      const response = await this.api.get(`/agents/${agentId}/metrics`, {
        params: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      });
      return response.data;
    } catch (error) {
      logger.error({ error, agentId, startDate, endDate }, 'Failed to get agent metrics');
      throw error;
    }
  }

  /**
   * @description Scale agent team
   * @param {any} params - Scaling parameters
   * @returns {Promise<any>} Scaling result
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async scaleTeam(params: any): Promise<any> {
    try {
      const response = await this.api.post('/agents/scale', params);
      return response.data;
    } catch (error) {
      logger.error({ error, params }, 'Failed to scale team');
      throw error;
    }
  }

  /**
   * @description Get exchange rates for rUv tokens
   * @returns {Promise<any>} Exchange rates
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async getExchangeRates(): Promise<any> {
    try {
      const response = await axios.get(`${config.qudag.exchangeUrl}/rates`);
      return response.data;
    } catch (error) {
      logger.error({ error }, 'Failed to get exchange rates');
      throw error;
    }
  }

  /**
   * @description Close connections
   * @returns {Promise<void>}
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async close(): Promise<void> {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.removeAllListeners();
  }
}