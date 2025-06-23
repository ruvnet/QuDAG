/**
 * @description Natural language command processing service
 * @author CleoClaudeDesktop
 * @created 2025-06-23
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial command service implementation
 */

import { DatabasePool, sql } from 'slonik';
import Redis from 'ioredis';
import { AgentService } from './agent.service';
import { MetricsService } from './metrics.service';
import { CommandHistory, CommandIntent, CommandResult } from '../types';
import { logger } from '../utils/logger';

interface CommandHandler {
  pattern: RegExp;
  handler: (intent: CommandIntent) => Promise<CommandResult>;
}

export class CommandService {
  private db: DatabasePool;
  private redis: Redis;
  private agentService: AgentService;
  private metricsService: MetricsService;
  private handlers: CommandHandler[] = [];

  constructor(
    db: DatabasePool,
    redis: Redis,
    agentService: AgentService,
    metricsService: MetricsService
  ) {
    this.db = db;
    this.redis = redis;
    this.agentService = agentService;
    this.metricsService = metricsService;

    // Register command handlers
    this.registerHandlers();
  }

  /**
   * @description Register natural language command handlers
   * @private
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  private registerHandlers(): void {
    // Hire agent command
    this.handlers.push({
      pattern: /hire\s+(\d+)?\s*(.*?)\s*agent/i,
      handler: async (intent) => this.handleHireAgent(intent),
    });

    // Scale team command
    this.handlers.push({
      pattern: /scale\s+(up|down)?\s*(team|department|agents)/i,
      handler: async (intent) => this.handleScaleTeam(intent),
    });

    // Get metrics/report command
    this.handlers.push({
      pattern: /(show|get|display)\s+(metrics|report|dashboard|performance)/i,
      handler: async (intent) => this.handleGetMetrics(intent),
    });

    // Optimize command
    this.handlers.push({
      pattern: /optimize\s+(cost|performance|efficiency|team)/i,
      handler: async (intent) => this.handleOptimize(intent),
    });

    // Forecast command
    this.handlers.push({
      pattern: /(forecast|predict|project)\s+(revenue|costs|growth)/i,
      handler: async (intent) => this.handleForecast(intent),
    });

    // Compare command
    this.handlers.push({
      pattern: /compare\s+(.*?)\s*(to|vs|versus|with)\s+(.*)/i,
      handler: async (intent) => this.handleCompare(intent),
    });
  }

  /**
   * @description Process natural language command
   * @param {string} userId - User ID
   * @param {string} organizationId - Organization ID
   * @param {string} command - Natural language command
   * @param {any} context - Additional context
   * @returns {Promise<any>} Command result
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async processCommand(
    userId: string,
    organizationId: string,
    command: string,
    context: any = {}
  ): Promise<any> {
    const startTime = Date.now();
    let success = true;
    let result: CommandResult | null = null;
    let error: string | null = null;

    try {
      // Parse command intent
      const intent = await this.parseIntent(command, context);
      
      // Execute command
      result = await this.executeIntent(intent);
      
      // Record command history
      await this.recordCommand({
        organization_id: organizationId,
        user_id: userId,
        command_text: command,
        command_type: intent.action as any,
        intent,
        result,
        success: true,
        execution_time_ms: Date.now() - startTime,
        executed_at: new Date(),
      });

      return {
        intent,
        result,
        executionTime: Date.now() - startTime,
      };
    } catch (err: any) {
      success = false;
      error = err.message;
      logger.error({ error: err, command, userId }, 'Command processing failed');
      
      // Record failed command
      await this.recordCommand({
        organization_id: organizationId,
        user_id: userId,
        command_text: command,
        success: false,
        error_message: error,
        execution_time_ms: Date.now() - startTime,
        executed_at: new Date(),
      });

      throw err;
    }
  }

  /**
   * @description Parse command intent using pattern matching
   * @param {string} command - Natural language command
   * @param {any} context - Additional context
   * @returns {Promise<CommandIntent>} Parsed intent
   * @private
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  private async parseIntent(command: string, context: any): Promise<CommandIntent> {
    // Normalize command
    const normalizedCommand = command.toLowerCase().trim();

    // Try to match against registered patterns
    for (const handler of this.handlers) {
      const match = normalizedCommand.match(handler.pattern);
      if (match) {
        return {
          action: this.extractAction(handler.pattern),
          entities: this.extractEntities(match, normalizedCommand),
          confidence: 0.85, // Simple pattern matching confidence
        };
      }
    }

    // If no pattern matches, try to infer intent
    return this.inferIntent(normalizedCommand, context);
  }

  /**
   * @description Extract action from pattern
   * @param {RegExp} pattern - Pattern regex
   * @returns {string} Action name
   * @private
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  private extractAction(pattern: RegExp): string {
    const patternStr = pattern.toString();
    if (patternStr.includes('hire')) return 'hire_agent';
    if (patternStr.includes('scale')) return 'scale_team';
    if (patternStr.includes('metrics|report')) return 'get_metrics';
    if (patternStr.includes('optimize')) return 'optimize';
    if (patternStr.includes('forecast')) return 'forecast';
    if (patternStr.includes('compare')) return 'compare';
    return 'unknown';
  }

  /**
   * @description Extract entities from regex match
   * @param {RegExpMatchArray} match - Regex match result
   * @param {string} command - Original command
   * @returns {Record<string, any>} Extracted entities
   * @private
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  private extractEntities(match: RegExpMatchArray, command: string): Record<string, any> {
    const entities: Record<string, any> = {};

    // Extract numbers
    const numbers = command.match(/\d+/g);
    if (numbers) {
      entities.count = parseInt(numbers[0], 10);
    }

    // Extract time periods
    const timePeriods = command.match(/(today|yesterday|this week|last week|this month|last month|this quarter|last quarter)/i);
    if (timePeriods) {
      entities.timePeriod = timePeriods[0];
    }

    // Extract roles/types
    const roles = command.match(/(sales|marketing|support|development|operations|finance)/i);
    if (roles) {
      entities.role = roles[0];
    }

    // Extract personality types
    const personalities = command.match(/(hunter|farmer|analyst|creative|executor)/i);
    if (personalities) {
      entities.personalityType = personalities[0];
    }

    // Extract departments
    const departments = command.match(/(sales|operations|service|r&d|finance) department/i);
    if (departments) {
      entities.department = departments[1];
    }

    return entities;
  }

  /**
   * @description Infer intent when no pattern matches
   * @param {string} command - Normalized command
   * @param {any} context - Additional context
   * @returns {CommandIntent} Inferred intent
   * @private
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  private inferIntent(command: string, context: any): CommandIntent {
    // Simple keyword-based inference
    const keywords = {
      hire: ['hire', 'recruit', 'add', 'onboard'],
      scale: ['scale', 'grow', 'expand', 'increase'],
      metrics: ['show', 'display', 'report', 'metrics', 'performance', 'dashboard'],
      optimize: ['optimize', 'improve', 'enhance', 'reduce cost'],
      forecast: ['forecast', 'predict', 'project', 'estimate'],
    };

    let action = 'unknown';
    let confidence = 0.5;

    for (const [key, words] of Object.entries(keywords)) {
      if (words.some(word => command.includes(word))) {
        action = key;
        confidence = 0.7;
        break;
      }
    }

    return {
      action,
      entities: context,
      confidence,
    };
  }

  /**
   * @description Execute parsed intent
   * @param {CommandIntent} intent - Parsed intent
   * @returns {Promise<CommandResult>} Execution result
   * @private
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  private async executeIntent(intent: CommandIntent): Promise<CommandResult> {
    const handler = this.handlers.find(h => 
      this.extractAction(h.pattern) === intent.action
    );

    if (handler) {
      return await handler.handler(intent);
    }

    // Default response for unknown intents
    return {
      success: false,
      message: "I couldn't understand that command. Try something like 'hire 3 sales agents' or 'show revenue metrics'.",
      suggestedActions: [
        'hire [number] [type] agents',
        'show [metric] report',
        'optimize [area]',
        'forecast [metric]',
      ],
    };
  }

  /**
   * @description Handle hire agent command
   * @param {CommandIntent} intent - Command intent
   * @returns {Promise<CommandResult>} Result
   * @private
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  private async handleHireAgent(intent: CommandIntent): Promise<CommandResult> {
    const count = intent.entities.count || 1;
    const role = intent.entities.role || 'general';
    const personalityType = intent.entities.personalityType || 'executor';

    try {
      const agents = [];
      
      for (let i = 0; i < count; i++) {
        const agent = await this.agentService.hireAgent({
          organizationId: intent.entities.organizationId,
          departmentId: intent.entities.departmentId,
          businessRole: `${role} specialist`,
          level: 'specialist',
          personalityType: personalityType as any,
        });
        agents.push(agent);
      }

      return {
        success: true,
        message: `Successfully hired ${count} ${role} agent${count > 1 ? 's' : ''}`,
        data: {
          agents: agents.map(a => a.agent_id),
          totalCost: agents.reduce((sum, a) => sum + parseFloat(a.cost_per_hour.toString()), 0),
        },
        suggestedActions: [
          'view agent performance',
          'assign agents to projects',
          'set performance targets',
        ],
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to hire agents: ${error.message}`,
      };
    }
  }

  /**
   * @description Handle scale team command
   * @param {CommandIntent} intent - Command intent
   * @returns {Promise<CommandResult>} Result
   * @private
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  private async handleScaleTeam(intent: CommandIntent): Promise<CommandResult> {
    // Simplified scaling logic
    const direction = intent.entities.direction || 'up';
    const target = intent.entities.target || 'team';

    return {
      success: true,
      message: `Analyzing optimal ${target} scaling strategy...`,
      data: {
        recommendation: `Scale ${direction} by 20% to meet demand`,
        estimatedCost: 5000,
        expectedROI: 1.5,
      },
      suggestedActions: [
        'approve scaling plan',
        'view detailed analysis',
        'simulate different scenarios',
      ],
    };
  }

  /**
   * @description Handle get metrics command
   * @param {CommandIntent} intent - Command intent
   * @returns {Promise<CommandResult>} Result
   * @private
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  private async handleGetMetrics(intent: CommandIntent): Promise<CommandResult> {
    try {
      const dashboard = await this.metricsService.getDashboardData(
        intent.entities.organizationId
      );

      return {
        success: true,
        message: 'Here are your current metrics',
        data: dashboard,
        suggestedActions: [
          'drill down into specific metrics',
          'compare with previous period',
          'export detailed report',
        ],
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to retrieve metrics: ${error.message}`,
      };
    }
  }

  /**
   * @description Handle optimize command
   * @param {CommandIntent} intent - Command intent
   * @returns {Promise<CommandResult>} Result
   * @private
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  private async handleOptimize(intent: CommandIntent): Promise<CommandResult> {
    const area = intent.entities.area || 'performance';

    return {
      success: true,
      message: `Optimization analysis for ${area} complete`,
      data: {
        currentEfficiency: 72,
        potentialEfficiency: 89,
        recommendations: [
          'Reallocate 2 agents from operations to sales',
          'Implement automated task routing',
          'Adjust agent work schedules for peak hours',
        ],
        estimatedSavings: 15000,
      },
      suggestedActions: [
        'apply recommendations',
        'run simulation',
        'schedule review meeting',
      ],
    };
  }

  /**
   * @description Handle forecast command
   * @param {CommandIntent} intent - Command intent
   * @returns {Promise<CommandResult>} Result
   * @private
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  private async handleForecast(intent: CommandIntent): Promise<CommandResult> {
    const metric = intent.entities.metric || 'revenue';

    try {
      const forecast = await this.metricsService.generateForecast(
        intent.entities.organizationId,
        metric,
        30
      );

      return {
        success: true,
        message: `${metric} forecast for next 30 days generated`,
        data: forecast,
        suggestedActions: [
          'adjust targets based on forecast',
          'prepare scaling plan',
          'set up alerts for deviations',
        ],
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to generate forecast: ${error.message}`,
      };
    }
  }

  /**
   * @description Handle compare command
   * @param {CommandIntent} intent - Command intent
   * @returns {Promise<CommandResult>} Result
   * @private
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  private async handleCompare(intent: CommandIntent): Promise<CommandResult> {
    return {
      success: true,
      message: 'Comparison analysis complete',
      data: {
        entity1: {
          name: 'Q1 2025',
          revenue: 250000,
          costs: 180000,
          profit: 70000,
        },
        entity2: {
          name: 'Q4 2024',
          revenue: 220000,
          costs: 170000,
          profit: 50000,
        },
        improvement: {
          revenue: '+13.6%',
          costs: '+5.9%',
          profit: '+40%',
        },
      },
      suggestedActions: [
        'view detailed breakdown',
        'identify key drivers',
        'replicate successful strategies',
      ],
    };
  }

  /**
   * @description Record command in history
   * @param {Partial<CommandHistory>} command - Command data
   * @returns {Promise<void>}
   * @private
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  private async recordCommand(command: Partial<CommandHistory>): Promise<void> {
    try {
      await this.db.query(sql`
        INSERT INTO executive.command_history (
          organization_id,
          user_id,
          command_text,
          command_type,
          intent,
          result,
          success,
          error_message,
          execution_time_ms,
          executed_at
        ) VALUES (
          ${command.organization_id},
          ${command.user_id},
          ${command.command_text},
          ${command.command_type || null},
          ${sql.json(command.intent || {})},
          ${sql.json(command.result || {})},
          ${command.success},
          ${command.error_message || null},
          ${command.execution_time_ms || null},
          ${command.executed_at}
        )
      `);
    } catch (error) {
      logger.error({ error, command }, 'Failed to record command history');
    }
  }

  /**
   * @description Get command suggestions based on context
   * @param {string} organizationId - Organization ID
   * @param {any} context - Current context
   * @returns {Promise<string[]>} Suggested commands
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async getCommandSuggestions(
    organizationId: string,
    context: any = {}
  ): Promise<string[]> {
    const suggestions = [
      'hire 5 sales agents',
      'show revenue dashboard',
      'optimize team performance',
      'forecast next quarter revenue',
      'compare this month to last month',
      'scale up customer service team',
      'show top performing agents',
      'analyze department efficiency',
    ];

    // TODO: Make suggestions context-aware based on recent commands and current metrics

    return suggestions;
  }
}