/**
 * @description Metrics collector service for periodic data collection
 * @author CleoClaudeDesktop
 * @created 2025-06-23
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial metrics collector implementation
 */

import { Services } from './index';
import { config } from '../config';
import { logger } from '../utils/logger';
import { sql } from 'slonik';
import { Decimal } from 'decimal.js';
import { startOfDay, endOfDay } from 'date-fns';

interface CollectorJob {
  name: string;
  interval: number; // milliseconds
  handler: () => Promise<void>;
  timer?: NodeJS.Timeout;
}

export class MetricsCollector {
  private services: Services;
  private jobs: CollectorJob[] = [];
  private isRunning: boolean = false;

  constructor(services: Services) {
    this.services = services;
    this.setupJobs();
  }

  /**
   * @description Setup periodic collection jobs
   * @private
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  private setupJobs(): void {
    // Collect agent performance metrics every 5 minutes
    this.jobs.push({
      name: 'agent-performance',
      interval: 5 * 60 * 1000, // 5 minutes
      handler: () => this.collectAgentPerformance(),
    });

    // Aggregate business metrics every 30 minutes
    this.jobs.push({
      name: 'business-metrics',
      interval: 30 * 60 * 1000, // 30 minutes
      handler: () => this.aggregateBusinessMetrics(),
    });

    // Update real-time dashboard data every minute
    this.jobs.push({
      name: 'realtime-updates',
      interval: 60 * 1000, // 1 minute
      handler: () => this.updateRealtimeData(),
    });

    // Check for anomalies every 10 minutes
    this.jobs.push({
      name: 'anomaly-detection',
      interval: 10 * 60 * 1000, // 10 minutes
      handler: () => this.detectAnomalies(),
    });

    // Generate daily reports at midnight
    this.jobs.push({
      name: 'daily-reports',
      interval: 24 * 60 * 60 * 1000, // 24 hours
      handler: () => this.generateDailyReports(),
    });
  }

  /**
   * @description Start metrics collection
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Metrics collector already running');
      return;
    }

    logger.info('Starting metrics collector...');
    this.isRunning = true;

    // Start all jobs
    this.jobs.forEach(job => {
      // Run immediately
      job.handler().catch(error => {
        logger.error({ error, job: job.name }, 'Job execution failed');
      });

      // Schedule periodic execution
      job.timer = setInterval(() => {
        job.handler().catch(error => {
          logger.error({ error, job: job.name }, 'Job execution failed');
        });
      }, job.interval);

      logger.info({ job: job.name, interval: job.interval }, 'Job scheduled');
    });
  }

  /**
   * @description Stop metrics collection
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping metrics collector...');
    this.isRunning = false;

    // Clear all timers
    this.jobs.forEach(job => {
      if (job.timer) {
        clearInterval(job.timer);
        job.timer = undefined;
      }
    });
  }

  /**
   * @description Collect agent performance metrics from QuDAG
   * @private
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  private async collectAgentPerformance(): Promise<void> {
    try {
      logger.debug('Collecting agent performance metrics...');

      // Get all active agents
      const organizations = await this.services.organization.list();
      
      for (const org of organizations.items) {
        const agents = await this.services.agent.listByOrganization(
          org.id,
          [{ field: 'status', operator: '=', value: 'active' }]
        );

        for (const agent of agents.items) {
          try {
            // Get performance data from QuDAG
            const now = new Date();
            const performance = await this.services.qudag.getAgentMetrics(
              agent.agent_id,
              startOfDay(now),
              endOfDay(now)
            );

            // Store in database
            await this.storeAgentPerformance(agent.agent_id, org.id, performance);

            // Record associated business metrics
            if (performance.revenue > 0) {
              await this.services.metrics.recordMetric({
                organization_id: org.id,
                metric_type: 'revenue',
                metric_subtype: 'agent_generated',
                value: new Decimal(performance.revenue),
                period_start: startOfDay(now),
                period_end: endOfDay(now),
                agent_id: agent.agent_id,
              });
            }

            if (performance.costs > 0) {
              await this.services.metrics.recordMetric({
                organization_id: org.id,
                metric_type: 'costs',
                metric_subtype: 'agent_operations',
                value: new Decimal(performance.costs),
                period_start: startOfDay(now),
                period_end: endOfDay(now),
                agent_id: agent.agent_id,
              });
            }
          } catch (error) {
            logger.error({ error, agentId: agent.agent_id }, 'Failed to collect agent metrics');
          }
        }
      }

      logger.info('Agent performance collection completed');
    } catch (error) {
      logger.error({ error }, 'Failed to collect agent performance');
    }
  }

  /**
   * @description Store agent performance in database
   * @param {string} agentId - Agent ID
   * @param {string} organizationId - Organization ID
   * @param {any} performance - Performance data
   * @private
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  private async storeAgentPerformance(
    agentId: string,
    organizationId: string,
    performance: any
  ): Promise<void> {
    const db = this.services.organization['db']; // Access db through service

    await db.query(sql`
      INSERT INTO executive.agent_performance (
        agent_id,
        organization_id,
        metric_date,
        tasks_completed,
        tasks_failed,
        success_rate,
        avg_response_time_ms,
        revenue_generated,
        costs_incurred,
        roi,
        quality_score,
        metadata
      ) VALUES (
        ${agentId},
        ${organizationId},
        CURRENT_DATE,
        ${performance.tasksCompleted || 0},
        ${performance.tasksFailed || 0},
        ${performance.successRate || 0},
        ${performance.avgResponseTime || 0},
        ${performance.revenue || 0},
        ${performance.costs || 0},
        ${performance.roi || 0},
        ${performance.qualityScore || 0},
        ${sql.json(performance.metadata || {})}
      )
      ON CONFLICT (agent_id, organization_id, metric_date)
      DO UPDATE SET
        tasks_completed = EXCLUDED.tasks_completed,
        tasks_failed = EXCLUDED.tasks_failed,
        success_rate = EXCLUDED.success_rate,
        avg_response_time_ms = EXCLUDED.avg_response_time_ms,
        revenue_generated = EXCLUDED.revenue_generated,
        costs_incurred = EXCLUDED.costs_incurred,
        roi = EXCLUDED.roi,
        quality_score = EXCLUDED.quality_score,
        metadata = EXCLUDED.metadata
    `);
  }

  /**
   * @description Aggregate business metrics
   * @private
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  private async aggregateBusinessMetrics(): Promise<void> {
    try {
      logger.debug('Aggregating business metrics...');

      const organizations = await this.services.organization.list();
      
      for (const org of organizations.items) {
        // Calculate department-level metrics
        await this.calculateDepartmentMetrics(org.id);
        
        // Calculate organization-level metrics
        await this.calculateOrganizationMetrics(org.id);
        
        // Update efficiency scores
        await this.updateEfficiencyScores(org.id);
      }

      logger.info('Business metrics aggregation completed');
    } catch (error) {
      logger.error({ error }, 'Failed to aggregate business metrics');
    }
  }

  /**
   * @description Calculate department-level metrics
   * @param {string} organizationId - Organization ID
   * @private
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  private async calculateDepartmentMetrics(organizationId: string): Promise<void> {
    const db = this.services.organization['db'];

    // Aggregate metrics by department for today
    const query = sql`
      WITH department_metrics AS (
        SELECT 
          d.id as department_id,
          d.name as department_name,
          COUNT(DISTINCT ap.agent_id) as agent_count,
          SUM(ap.revenue_generated) as total_revenue,
          SUM(ap.costs_incurred) as total_costs,
          AVG(ap.success_rate) as avg_success_rate,
          AVG(ap.quality_score) as avg_quality_score
        FROM executive.departments d
        LEFT JOIN executive.agent_profiles a ON a.department_id = d.id
        LEFT JOIN executive.agent_performance ap ON ap.agent_id = a.agent_id
          AND ap.metric_date = CURRENT_DATE
        WHERE d.organization_id = ${organizationId}
        GROUP BY d.id, d.name
      )
      SELECT * FROM department_metrics WHERE agent_count > 0
    `;

    const result = await db.query(query);

    // Record department metrics
    for (const dept of result.rows) {
      const efficiency = dept.total_revenue && dept.total_costs 
        ? (dept.total_revenue - dept.total_costs) / dept.total_costs * 100
        : 0;

      await this.services.metrics.recordMetric({
        organization_id: organizationId,
        metric_type: 'efficiency',
        metric_subtype: 'department_efficiency',
        value: new Decimal(efficiency),
        period_start: startOfDay(new Date()),
        period_end: endOfDay(new Date()),
        department_id: dept.department_id,
        metadata: {
          department_name: dept.department_name,
          agent_count: dept.agent_count,
          avg_success_rate: dept.avg_success_rate,
          avg_quality_score: dept.avg_quality_score,
        },
      });
    }
  }

  /**
   * @description Calculate organization-level metrics
   * @param {string} organizationId - Organization ID
   * @private
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  private async calculateOrganizationMetrics(organizationId: string): Promise<void> {
    const now = new Date();
    const timeRange = {
      start: startOfDay(now),
      end: endOfDay(now),
    };

    // Get today's aggregated metrics
    const metrics = await this.services.metrics.getAggregatedMetrics(
      organizationId,
      timeRange,
      ['revenue', 'costs'],
      'day'
    );

    // Calculate profit
    const revenue = metrics
      .filter(m => m.metric_type === 'revenue')
      .reduce((sum, m) => sum.plus(m.total), new Decimal(0));

    const costs = metrics
      .filter(m => m.metric_type === 'costs')
      .reduce((sum, m) => sum.plus(m.total), new Decimal(0));

    const profit = revenue.minus(costs);

    // Record profit metric
    if (!profit.isZero()) {
      await this.services.metrics.recordMetric({
        organization_id: organizationId,
        metric_type: 'profit',
        value: profit,
        period_start: timeRange.start,
        period_end: timeRange.end,
      });
    }
  }

  /**
   * @description Update efficiency scores
   * @param {string} organizationId - Organization ID
   * @private
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  private async updateEfficiencyScores(organizationId: string): Promise<void> {
    const db = this.services.organization['db'];

    // Calculate and update agent efficiency scores
    const query = sql`
      WITH agent_efficiency AS (
        SELECT 
          agent_id,
          CASE 
            WHEN costs_incurred = 0 THEN 0
            ELSE ((revenue_generated - costs_incurred) / costs_incurred * 100)
          END as efficiency_score,
          quality_score * 20 as weighted_quality, -- Scale to 0-100
          success_rate as success_score
        FROM executive.agent_performance
        WHERE 
          organization_id = ${organizationId}
          AND metric_date = CURRENT_DATE
      )
      UPDATE executive.agent_profiles ap
      SET 
        performance_rating = LEAST(5.0, GREATEST(0.0, 
          (ae.efficiency_score * 0.4 + ae.weighted_quality * 0.4 + ae.success_score * 0.2) / 20.0
        )),
        last_active = CURRENT_TIMESTAMP
      FROM agent_efficiency ae
      WHERE ap.agent_id = ae.agent_id
    `;

    await db.query(query);
  }

  /**
   * @description Update real-time dashboard data
   * @private
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  private async updateRealtimeData(): Promise<void> {
    try {
      logger.debug('Updating real-time data...');

      // This would connect to QuDAG WebSocket for real-time updates
      // For now, we'll simulate with periodic polling

      const organizations = await this.services.organization.list();
      
      for (const org of organizations.items) {
        // Get active agent count
        const agents = await this.services.agent.listByOrganization(
          org.id,
          [{ field: 'status', operator: '=', value: 'active' }]
        );

        // Update real-time metrics in Redis
        const redis = this.services.metrics['redis'];
        const ttl = 300; // 5 minutes

        await redis.set(
          `realtime:${org.id}:active_agents`,
          agents.total.toString(),
          'EX',
          ttl
        );

        // Broadcast update via WebSocket (when implemented)
        await redis.publish('realtime:update', JSON.stringify({
          organizationId: org.id,
          activeAgents: agents.total,
          timestamp: new Date().toISOString(),
        }));
      }
    } catch (error) {
      logger.error({ error }, 'Failed to update real-time data');
    }
  }

  /**
   * @description Detect anomalies in metrics
   * @private
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  private async detectAnomalies(): Promise<void> {
    try {
      logger.debug('Running anomaly detection...');

      const organizations = await this.services.organization.list();
      
      for (const org of organizations.items) {
        // Get recent trends
        const trends = await this.services.metrics.getPerformanceTrends(org.id, 7);
        
        // Simple anomaly detection: Check for significant deviations
        const dailyData = Object.values(trends.daily);
        if (dailyData.length < 2) continue;

        const latest: any = dailyData[dailyData.length - 1];
        const previous: any = dailyData[dailyData.length - 2];

        // Check for significant drops in revenue (>20%)
        if (latest.revenue && previous.revenue) {
          const revenueDrop = (parseFloat(previous.revenue.value) - parseFloat(latest.revenue.value)) 
            / parseFloat(previous.revenue.value) * 100;
          
          if (revenueDrop > 20) {
            await this.triggerAlert(org.id, 'revenue_drop', {
              current: latest.revenue.value,
              previous: previous.revenue.value,
              dropPercent: revenueDrop,
            });
          }
        }

        // Check for efficiency below threshold (< 50%)
        if (latest.efficiency && parseFloat(latest.efficiency.value) < 50) {
          await this.triggerAlert(org.id, 'low_efficiency', {
            efficiency: latest.efficiency.value,
            threshold: 50,
          });
        }
      }

      logger.info('Anomaly detection completed');
    } catch (error) {
      logger.error({ error }, 'Failed to detect anomalies');
    }
  }

  /**
   * @description Trigger alert
   * @param {string} organizationId - Organization ID
   * @param {string} alertType - Type of alert
   * @param {any} data - Alert data
   * @private
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  private async triggerAlert(
    organizationId: string,
    alertType: string,
    data: any
  ): Promise<void> {
    logger.warn({ organizationId, alertType, data }, 'Alert triggered');

    // Store alert in database
    const db = this.services.organization['db'];
    
    await db.query(sql`
      INSERT INTO executive.alerts (
        organization_id,
        type,
        severity,
        message,
        data,
        created_at
      ) VALUES (
        ${organizationId},
        ${alertType},
        'high',
        ${this.getAlertMessage(alertType, data)},
        ${sql.json(data)},
        CURRENT_TIMESTAMP
      )
    `);

    // Publish alert event
    const redis = this.services.metrics['redis'];
    await redis.publish('alert:triggered', JSON.stringify({
      organizationId,
      alertType,
      data,
      timestamp: new Date().toISOString(),
    }));
  }

  /**
   * @description Get alert message
   * @param {string} alertType - Alert type
   * @param {any} data - Alert data
   * @returns {string} Alert message
   * @private
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  private getAlertMessage(alertType: string, data: any): string {
    const messages: Record<string, string> = {
      revenue_drop: `Revenue dropped by ${data.dropPercent.toFixed(1)}% from ${data.previous} to ${data.current}`,
      low_efficiency: `Efficiency is at ${data.efficiency}%, below the ${data.threshold}% threshold`,
      high_costs: `Costs exceeded budget by ${data.overagePercent}%`,
      agent_failure: `Agent ${data.agentId} has a high failure rate of ${data.failureRate}%`,
    };

    return messages[alertType] || `Alert: ${alertType}`;
  }

  /**
   * @description Generate daily reports
   * @private
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  private async generateDailyReports(): Promise<void> {
    try {
      logger.info('Generating daily reports...');

      const organizations = await this.services.organization.list();
      
      for (const org of organizations.items) {
        // Get scheduled reports
        const db = this.services.organization['db'];
        
        const reports = await db.query(sql`
          SELECT * FROM executive.saved_reports
          WHERE 
            organization_id = ${org.id}
            AND schedule IS NOT NULL
            AND schedule->>'frequency' = 'daily'
        `);

        for (const report of reports.rows) {
          try {
            // Generate report based on configuration
            const reportData = await this.generateReport(org.id, report.configuration);
            
            // Store generated report
            await db.query(sql`
              UPDATE executive.saved_reports
              SET 
                last_generated_at = CURRENT_TIMESTAMP,
                metadata = jsonb_set(
                  COALESCE(metadata, '{}'::jsonb),
                  '{last_report_data}',
                  ${sql.json(reportData)}
                )
              WHERE id = ${report.id}
            `);

            // Send to recipients
            if (report.recipients && report.recipients.length > 0) {
              // TODO: Implement email/notification sending
              logger.info({ 
                reportId: report.id, 
                recipients: report.recipients 
              }, 'Report sent to recipients');
            }
          } catch (error) {
            logger.error({ error, reportId: report.id }, 'Failed to generate report');
          }
        }
      }

      logger.info('Daily report generation completed');
    } catch (error) {
      logger.error({ error }, 'Failed to generate daily reports');
    }
  }

  /**
   * @description Generate report based on configuration
   * @param {string} organizationId - Organization ID
   * @param {any} configuration - Report configuration
   * @returns {Promise<any>} Report data
   * @private
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  private async generateReport(
    organizationId: string,
    configuration: any
  ): Promise<any> {
    const { metrics, timeRange, groupBy } = configuration;

    // Get metrics data
    const data = await this.services.metrics.getAggregatedMetrics(
      organizationId,
      {
        start: new Date(timeRange.start),
        end: new Date(timeRange.end),
      },
      metrics,
      'day'
    );

    // Get comparison data if requested
    let comparison = null;
    if (configuration.comparison) {
      // Calculate previous period
      const currentStart = new Date(timeRange.start);
      const currentEnd = new Date(timeRange.end);
      const duration = currentEnd.getTime() - currentStart.getTime();
      
      const previousStart = new Date(currentStart.getTime() - duration);
      const previousEnd = new Date(currentEnd.getTime() - duration);

      comparison = await this.services.metrics.compareMetrics(
        organizationId,
        { start: currentStart, end: currentEnd },
        { start: previousStart, end: previousEnd },
        metrics
      );
    }

    return {
      generatedAt: new Date().toISOString(),
      configuration,
      data,
      comparison,
      summary: this.generateReportSummary(data, comparison),
    };
  }

  /**
   * @description Generate report summary
   * @param {any} data - Report data
   * @param {any} comparison - Comparison data
   * @returns {any} Summary
   * @private
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  private generateReportSummary(data: any, comparison: any): any {
    const summary: any = {
      totalMetrics: data.length,
      dateRange: {
        start: data[0]?.period || null,
        end: data[data.length - 1]?.period || null,
      },
    };

    // Calculate totals by metric type
    const totals: Record<string, Decimal> = {};
    data.forEach((item: any) => {
      if (!totals[item.metric_type]) {
        totals[item.metric_type] = new Decimal(0);
      }
      totals[item.metric_type] = totals[item.metric_type].plus(item.total);
    });

    summary.totals = Object.fromEntries(
      Object.entries(totals).map(([key, value]) => [key, value.toString()])
    );

    if (comparison) {
      summary.comparison = comparison.summary;
    }

    return summary;
  }
}

/**
 * @description Start metrics collector with services
 * @param {Services} services - Initialized services
 * @returns {MetricsCollector} Metrics collector instance
 * @author CleoClaudeDesktop
 * @since 1.0.0
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
 */
export function startMetricsCollector(services: Services): MetricsCollector {
  const collector = new MetricsCollector(services);
  collector.start();
  return collector;
}