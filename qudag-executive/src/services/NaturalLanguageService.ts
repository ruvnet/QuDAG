/**
 * @description Natural Language Processing Service for CEO Commands
 * @author Claude Code  
 * @created 2025-06-23
 * @lastModified 2025-06-23 - Revolutionary NLP for business commands
 */

import type { CEOCommand, CommandIntent } from '../types';

interface CommandPattern {
  pattern: RegExp;
  intent: CommandIntent;
  entityExtractor: (match: RegExpMatchArray) => Record<string, string | number | boolean>;
  examples: string[];
}

// Business role mapping - translating CEO language to system concepts
const ROLE_MAPPING: Record<string, string> = {
  'sales agent': 'sales_specialist',
  'salesperson': 'sales_specialist',
  'sales rep': 'sales_specialist',
  'customer service': 'customer_service_specialist',
  'support agent': 'customer_service_specialist',
  'marketing': 'marketing_specialist',
  'analyst': 'data_analyst',
  'data analyst': 'data_analyst',
  'developer': 'software_developer',
  'programmer': 'software_developer',
  'manager': 'operations_manager',
  'supervisor': 'operations_manager',
  'specialist': 'general_specialist'
};

// Department mapping
const DEPARTMENT_MAPPING: Record<string, string> = {
  'sales': 'sales',
  'marketing': 'marketing', 
  'customer service': 'customer_service',
  'support': 'customer_service',
  'operations': 'operations',
  'finance': 'finance',
  'hr': 'human_resources',
  'development': 'engineering',
  'engineering': 'engineering',
  'r&d': 'research_development'
};

// Command patterns for intent recognition
const COMMAND_PATTERNS: CommandPattern[] = [
  // Hiring Commands
  {
    pattern: /(?:hire|add|deploy|recruit)\s+(\d+)?\s*(?:new\s+)?(\w+(?:\s+\w+)*?)(?:\s+(?:agent|specialist|person|employee))s?\s*(?:for|to|in)?\s*(\w+(?:\s+\w+)*)?/i,
    intent: { action: 'hire', target: 'agent' },
    entityExtractor: (match) => ({
      quantity: match[1] ? parseInt(match[1]) : 1,
      role: match[2]?.trim().toLowerCase() || 'general',
      department: match[3]?.trim().toLowerCase() || null
    }),
    examples: ["Hire 5 sales agents", "Add customer service specialist", "Deploy marketing team"]
  },
  
  // Metrics and Analytics Commands  
  {
    pattern: /(?:show|display|view|get)\s+(?:me\s+)?(?:the\s+)?(\w+(?:\s+\w+)*?)\s*(?:metrics|data|analytics|performance|report)/i,
    intent: { action: 'show', target: 'metrics' },
    entityExtractor: (match) => ({
      metricType: match[1]?.trim().toLowerCase() || 'general',
      timeframe: 'current_month'
    }),
    examples: ["Show me revenue metrics", "Display agent performance", "View cost analysis"]
  },

  // Optimization Commands
  {
    pattern: /(?:optimize|improve|reduce|minimize)\s+(?:the\s+)?(\w+(?:\s+\w+)*?)(?:\s+(?:costs?|spending|expenses?|operations?|efficiency))?/i,
    intent: { action: 'optimize', target: 'system' },
    entityExtractor: (match) => ({
      target: match[1]?.trim().toLowerCase() || 'general',
      objective: 'efficiency'
    }),
    examples: ["Optimize marketing costs", "Reduce operational expenses", "Improve efficiency"]
  },

  // Scaling Commands
  {
    pattern: /(?:scale|expand|grow|increase)\s+(?:the\s+)?(\w+(?:\s+\w+)*?)(?:\s+(?:team|department|operations?))?\s*(?:by\s+(\d+)%?|to\s+(\d+))?/i,
    intent: { action: 'scale', target: 'department' },
    entityExtractor: (match) => ({
      target: match[1]?.trim().toLowerCase() || 'business',
      scaleBy: match[2] ? parseInt(match[2]) : null,
      scaleTo: match[3] ? parseInt(match[3]) : null
    }),
    examples: ["Scale customer service by 50%", "Expand to 100 agents", "Grow marketing team"]
  },

  // Report Generation Commands
  {
    pattern: /(?:generate|create|prepare|make)\s+(?:a\s+)?(\w+(?:\s+\w+)*?)\s*(?:report|summary|analysis|presentation)/i,
    intent: { action: 'generate', target: 'report' },
    entityExtractor: (match) => ({
      reportType: match[1]?.trim().toLowerCase() || 'general',
      format: 'executive_summary'
    }),
    examples: ["Generate board report", "Create performance summary", "Prepare quarterly analysis"]
  },

  // Analysis Commands
  {
    pattern: /(?:analyze|examine|review|assess)\s+(?:the\s+)?(\w+(?:\s+\w+)*?)(?:\s+(?:performance|data|trends|metrics))?/i,
    intent: { action: 'analyze', target: 'metrics' },
    entityExtractor: (match) => ({
      analysisTarget: match[1]?.trim().toLowerCase() || 'general',
      depth: 'standard'
    }),
    examples: ["Analyze top performers", "Review cost trends", "Assess market performance"]
  },

  // Help Commands
  {
    pattern: /(?:help|what|how)\s+(?:can|do|to)\s+(?:i|you)\s*(.*)?/i,
    intent: { action: 'help', target: 'general' },
    entityExtractor: (match) => ({
      helpTopic: match[1]?.trim().toLowerCase() || 'general'
    }),
    examples: ["Help me get started", "What can you do", "How to hire agents"]
  }
];

export class NaturalLanguageService {
  private commandHistory: CEOCommand[] = [];

  /**
   * Parse a natural language command into structured intent
   */
  parseCommand(input: string): CEOCommand {
    const command: CEOCommand = {
      id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      input: input.trim(),
      intent: { action: 'help', target: 'general' },
      entities: {},
      confidence: 0,
      timestamp: Date.now(),
      status: 'pending'
    };

    // Try to match against known patterns
    for (const pattern of COMMAND_PATTERNS) {
      const match = input.match(pattern.pattern);
      if (match) {
        command.intent = pattern.intent;
        command.entities = pattern.entityExtractor(match);
        command.confidence = this.calculateConfidence(match, pattern);
        break;
      }
    }

    // Post-process entities for business translation
    this.translateBusinessEntities(command);
    
    // Add to history
    this.commandHistory.unshift(command);
    if (this.commandHistory.length > 50) {
      this.commandHistory = this.commandHistory.slice(0, 50);
    }

    return command;
  }

  /**
   * Translate business language to system entities
   */
  private translateBusinessEntities(command: CEOCommand): void {
    // Translate roles
    if (command.entities.role) {
      const businessRole = command.entities.role.toLowerCase();
      command.entities.systemRole = ROLE_MAPPING[businessRole] || businessRole;
    }

    // Translate departments
    if (command.entities.department) {
      const businessDept = command.entities.department.toLowerCase(); 
      command.entities.systemDepartment = DEPARTMENT_MAPPING[businessDept] || businessDept;
    }

    // Parse timeframes
    if (command.entities.timeframe) {
      command.entities.parsedTimeframe = this.parseTimeframe(command.entities.timeframe);
    }

    // Set default quantities
    if (command.intent.action === 'hire' && !command.entities.quantity) {
      command.entities.quantity = 1;
    }
  }

  /**
   * Parse human timeframes into system timeframes
   */
  private parseTimeframe(timeframe: string): string {
    const normalized = timeframe.toLowerCase();
    
    if (normalized.includes('today') || normalized.includes('now')) return 'today';
    if (normalized.includes('week')) return 'this_week';
    if (normalized.includes('month')) return 'this_month';
    if (normalized.includes('quarter')) return 'this_quarter';
    if (normalized.includes('year')) return 'this_year';
    if (normalized.includes('last')) return 'last_period';
    
    return 'current_period';
  }

  /**
   * Calculate confidence score for command recognition
   */
  private calculateConfidence(match: RegExpMatchArray, _pattern: CommandPattern): number {
    let confidence = 0.7; // Base confidence
    
    // Boost confidence for longer matches
    if (match[0].length > 20) confidence += 0.1;
    
    // Boost confidence for specific entities
    if (match.some(group => group && /\d+/.test(group))) confidence += 0.1; // Numbers
    if (match.some(group => group && Object.keys(ROLE_MAPPING).includes(group.toLowerCase()))) confidence += 0.1; // Known roles
    if (match.some(group => group && Object.keys(DEPARTMENT_MAPPING).includes(group.toLowerCase()))) confidence += 0.1; // Known departments
    
    return Math.min(confidence, 0.95); // Cap at 95%
  }

  /**
   * Get command suggestions based on input
   */
  getCommandSuggestions(input: string): string[] {
    if (!input.trim()) return [];
    
    const suggestions: string[] = [];
    const inputLower = input.toLowerCase();
    
    // Find patterns that partially match
    for (const pattern of COMMAND_PATTERNS) {
      for (const example of pattern.examples) {
        if (example.toLowerCase().includes(inputLower) || 
            inputLower.split(' ').some(word => example.toLowerCase().includes(word))) {
          suggestions.push(example);
        }
      }
    }
    
    return [...new Set(suggestions)].slice(0, 5);
  }

  /**
   * Get recent command history
   */
  getRecentCommands(limit: number = 10): CEOCommand[] {
    return this.commandHistory.slice(0, limit);
  }

  /**
   * Validate if a command can be executed
   */
  validateCommand(command: CEOCommand): { valid: boolean; reason?: string } {
    // Check confidence threshold
    if (command.confidence < 0.3) {
      return { 
        valid: false, 
        reason: "I'm not sure what you want to do. Please try rephrasing your command." 
      };
    }

    // Validate hiring commands
    if (command.intent.action === 'hire') {
      if (!command.entities.role && !command.entities.systemRole) {
        return { 
          valid: false, 
          reason: "Please specify what type of agent you want to hire (e.g., 'sales agent', 'customer service specialist')." 
        };
      }
      
      const quantity = command.entities.quantity || 1;
      if (quantity > 100) {
        return { 
          valid: false, 
          reason: "That's a lot of agents! Consider hiring in smaller batches for better management." 
        };
      }
    }

    // Validate scaling commands
    if (command.intent.action === 'scale') {
      const scaleBy = command.entities.scaleBy;
      const scaleTo = command.entities.scaleTo;
      
      if (scaleBy && scaleBy > 500) {
        return { 
          valid: false, 
          reason: "Scaling by more than 500% at once could be risky. Consider a gradual approach." 
        };
      }
      
      if (scaleTo && scaleTo > 1000) {
        return { 
          valid: false, 
          reason: "That's a massive operation! Let's start with a smaller target and scale gradually." 
        };
      }
    }

    return { valid: true };
  }

  /**
   * Generate helpful error messages for failed commands
   */
  generateHelpfulError(command: CEOCommand): string {
    const action = command.intent.action;
    
    const helpMessages: Record<string, string> = {
      hire: "Try: 'Hire 3 sales agents' or 'Add a customer service specialist to the support team'",
      show: "Try: 'Show me revenue metrics' or 'Display agent performance for this month'",
      optimize: "Try: 'Optimize marketing costs' or 'Reduce operational expenses'",
      scale: "Try: 'Scale customer service by 50%' or 'Expand to 100 agents'",
      generate: "Try: 'Generate board report' or 'Create quarterly performance summary'",
      analyze: "Try: 'Analyze top performing agents' or 'Review cost trends'"
    };

    return helpMessages[action] || "Try commands like 'Hire 5 sales agents' or 'Show me this month's metrics'";
  }

  /**
   * Extract business insights from command patterns
   */
  getBusinessInsights(): { insight: string; confidence: number }[] {
    if (this.commandHistory.length < 5) return [];

    const insights: { insight: string; confidence: number }[] = [];
    
    // Analyze hiring patterns
    const hiringCommands = this.commandHistory.filter(cmd => cmd.intent.action === 'hire');
    if (hiringCommands.length >= 3) {
      const totalAgents = hiringCommands.reduce((sum, cmd) => sum + (cmd.entities.quantity || 1), 0);
      insights.push({
        insight: `You've been hiring actively - ${totalAgents} agents planned. Consider setting up training protocols.`,
        confidence: 0.8
      });
    }

    // Analyze optimization patterns
    const optimizeCommands = this.commandHistory.filter(cmd => cmd.intent.action === 'optimize');
    if (optimizeCommands.length >= 2) {
      insights.push({
        insight: "You're focused on optimization. Consider setting up automated monitoring for continuous improvement.",
        confidence: 0.7
      });
    }

    return insights;
  }
}

// Export singleton instance
export const nlService = new NaturalLanguageService();