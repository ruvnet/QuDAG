/**
 * @description Business metrics model for time-series financial data
 * @author CleoClaudeDesktop
 * @created 2025-06-23
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial metrics model implementation
 */

import { sql } from 'slonik';
import { BaseModel } from './base';
import { BusinessMetric, TimeRangeParams, FilterParams } from '../types';
import { cacheKeys, withCache } from '../cache';
import { config } from '../config';
import { Decimal } from 'decimal.js';

interface MetricAggregation {
  metric_type: string;
  metric_subtype?: string;
  total: Decimal;
  count: number;
  avg: Decimal;
  min: Decimal;
  max: Decimal;
  period: string;
}

export class MetricsModel extends BaseModel<BusinessMetric> {
  constructor(db?: any) {
    super('business_metrics', db);
  }

  /**
   * @description Record a new metric
   * @param {Partial<BusinessMetric>} data - Metric data
   * @returns {Promise<BusinessMetric>} Created metric
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async record(data: Partial<BusinessMetric>): Promise<BusinessMetric> {
    const query = sql`
      INSERT INTO ${this.table} (
        organization_id,
        metric_type,
        metric_subtype,
        value,
        currency,
        period_start,
        period_end,
        department_id,
        agent_id,
        metadata
      ) VALUES (
        ${data.organization_id},
        ${data.metric_type},
        ${data.metric_subtype || null},
        ${data.value},
        ${data.currency || 'rUv'},
        ${data.period_start},
        ${data.period_end},
        ${data.department_id || null},
        ${data.agent_id || null},
        ${sql.json(data.metadata || {})}
      )
      RETURNING 
        id::text,
        organization_id::text,
        metric_type,
        metric_subtype,
        value,
        currency,
        period_start,
        period_end,
        department_id::text,
        agent_id,
        metadata,
        created_at
    `;

    const result = await this.executeQuery(query);
    return result.rows[0];
  }

  /**
   * @description Get aggregated metrics for a time range
   * @param {string} organizationId - Organization ID
   * @param {TimeRangeParams} timeRange - Time range for metrics
   * @param {string[]} metricTypes - Types of metrics to retrieve
   * @param {string} granularity - Aggregation granularity (hour, day, week, month)
   * @returns {Promise<MetricAggregation[]>} Aggregated metrics
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async getAggregated(
    organizationId: string,
    timeRange: TimeRangeParams,
    metricTypes: string[] = [],
    granularity: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Promise<MetricAggregation[]> {
    const cacheKey = `${cacheKeys.metrics(
      organizationId,
      metricTypes.join('-'),
      timeRange.start.toISOString()
    )}:${granularity}`;

    return withCache(cacheKey, async () => {
      const dateFormat = {
        hour: 'YYYY-MM-DD HH24:00:00',
        day: 'YYYY-MM-DD',
        week: 'YYYY-IW',
        month: 'YYYY-MM'
      }[granularity];

      const query = sql`
        SELECT 
          metric_type,
          metric_subtype,
          SUM(value) as total,
          COUNT(*) as count,
          AVG(value) as avg,
          MIN(value) as min,
          MAX(value) as max,
          TO_CHAR(period_start, ${dateFormat}) as period
        FROM ${this.table}
        WHERE 
          organization_id = ${organizationId}
          AND period_start >= ${timeRange.start}
          AND period_end <= ${timeRange.end}
          ${metricTypes.length > 0 
            ? sql`AND metric_type = ANY(${sql.array(metricTypes, 'text')})`
            : sql``
          }
        GROUP BY 
          metric_type,
          metric_subtype,
          TO_CHAR(period_start, ${dateFormat})
        ORDER BY 
          period DESC,
          metric_type,
          metric_subtype
      `;

      const result = await this.executeQuery(query);
      return result.rows;
    }, config.redis.ttl.metrics);
  }

  /**
   * @description Get metrics by department
   * @param {string} organizationId - Organization ID
   * @param {string} departmentId - Department ID
   * @param {TimeRangeParams} timeRange - Time range
   * @returns {Promise<BusinessMetric[]>} Department metrics
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async getByDepartment(
    organizationId: string,
    departmentId: string,
    timeRange: TimeRangeParams
  ): Promise<BusinessMetric[]> {
    const query = sql`
      SELECT 
        id::text,
        organization_id::text,
        metric_type,
        metric_subtype,
        value,
        currency,
        period_start,
        period_end,
        department_id::text,
        agent_id,
        metadata,
        created_at
      FROM ${this.table}
      WHERE 
        organization_id = ${organizationId}
        AND department_id = ${departmentId}
        AND period_start >= ${timeRange.start}
        AND period_end <= ${timeRange.end}
      ORDER BY period_start DESC
    `;

    const result = await this.executeQuery(query);
    return result.rows;
  }

  /**
   * @description Get metrics by agent
   * @param {string} agentId - Agent ID
   * @param {TimeRangeParams} timeRange - Time range
   * @returns {Promise<BusinessMetric[]>} Agent metrics
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async getByAgent(
    agentId: string,
    timeRange: TimeRangeParams
  ): Promise<BusinessMetric[]> {
    const query = sql`
      SELECT 
        id::text,
        organization_id::text,
        metric_type,
        metric_subtype,
        value,
        currency,
        period_start,
        period_end,
        department_id::text,
        agent_id,
        metadata,
        created_at
      FROM ${this.table}
      WHERE 
        agent_id = ${agentId}
        AND period_start >= ${timeRange.start}
        AND period_end <= ${timeRange.end}
      ORDER BY period_start DESC
    `;

    const result = await this.executeQuery(query);
    return result.rows;
  }

  /**
   * @description Compare metrics across time periods
   * @param {string} organizationId - Organization ID
   * @param {TimeRangeParams} currentPeriod - Current period
   * @param {TimeRangeParams} previousPeriod - Previous period for comparison
   * @param {string[]} metricTypes - Metric types to compare
   * @returns {Promise<any>} Comparison results
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async comparePerioods(
    organizationId: string,
    currentPeriod: TimeRangeParams,
    previousPeriod: TimeRangeParams,
    metricTypes: string[] = []
  ): Promise<any> {
    const query = sql`
      WITH current_metrics AS (
        SELECT 
          metric_type,
          metric_subtype,
          SUM(value) as total,
          COUNT(*) as count,
          AVG(value) as avg
        FROM ${this.table}
        WHERE 
          organization_id = ${organizationId}
          AND period_start >= ${currentPeriod.start}
          AND period_end <= ${currentPeriod.end}
          ${metricTypes.length > 0 
            ? sql`AND metric_type = ANY(${sql.array(metricTypes, 'text')})`
            : sql``
          }
        GROUP BY metric_type, metric_subtype
      ),
      previous_metrics AS (
        SELECT 
          metric_type,
          metric_subtype,
          SUM(value) as total,
          COUNT(*) as count,
          AVG(value) as avg
        FROM ${this.table}
        WHERE 
          organization_id = ${organizationId}
          AND period_start >= ${previousPeriod.start}
          AND period_end <= ${previousPeriod.end}
          ${metricTypes.length > 0 
            ? sql`AND metric_type = ANY(${sql.array(metricTypes, 'text')})`
            : sql``
          }
        GROUP BY metric_type, metric_subtype
      )
      SELECT 
        COALESCE(c.metric_type, p.metric_type) as metric_type,
        COALESCE(c.metric_subtype, p.metric_subtype) as metric_subtype,
        c.total as current_total,
        p.total as previous_total,
        c.avg as current_avg,
        p.avg as previous_avg,
        CASE 
          WHEN p.total IS NULL OR p.total = 0 THEN NULL
          ELSE ((c.total - p.total) / p.total * 100)
        END as change_percent
      FROM current_metrics c
      FULL OUTER JOIN previous_metrics p 
        ON c.metric_type = p.metric_type 
        AND COALESCE(c.metric_subtype, '') = COALESCE(p.metric_subtype, '')
      ORDER BY metric_type, metric_subtype
    `;

    const result = await this.executeQuery(query);
    return result.rows;
  }

  /**
   * @description Get top performing entities (departments/agents) by metric
   * @param {string} organizationId - Organization ID
   * @param {string} metricType - Metric type to rank by
   * @param {TimeRangeParams} timeRange - Time range
   * @param {string} groupBy - 'department' or 'agent'
   * @param {number} limit - Number of results
   * @returns {Promise<any[]>} Top performers
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async getTopPerformers(
    organizationId: string,
    metricType: string,
    timeRange: TimeRangeParams,
    groupBy: 'department' | 'agent' = 'agent',
    limit: number = 10
  ): Promise<any[]> {
    const groupField = groupBy === 'department' ? 'department_id' : 'agent_id';
    
    const query = sql`
      SELECT 
        ${sql.identifier([groupField])} as entity_id,
        SUM(value) as total_value,
        COUNT(*) as transaction_count,
        AVG(value) as avg_value,
        MIN(period_start) as first_transaction,
        MAX(period_end) as last_transaction
      FROM ${this.table}
      WHERE 
        organization_id = ${organizationId}
        AND metric_type = ${metricType}
        AND period_start >= ${timeRange.start}
        AND period_end <= ${timeRange.end}
        AND ${sql.identifier([groupField])} IS NOT NULL
      GROUP BY ${sql.identifier([groupField])}
      ORDER BY total_value DESC
      LIMIT ${limit}
    `;

    const result = await this.executeQuery(query);
    return result.rows;
  }

  /**
   * @description Calculate ROI for agents or departments
   * @param {string} organizationId - Organization ID
   * @param {TimeRangeParams} timeRange - Time range
   * @param {string} entityType - 'agent' or 'department'
   * @param {string} entityId - Entity ID
   * @returns {Promise<any>} ROI calculations
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async calculateROI(
    organizationId: string,
    timeRange: TimeRangeParams,
    entityType: 'agent' | 'department',
    entityId: string
  ): Promise<any> {
    const entityField = entityType === 'department' ? 'department_id' : 'agent_id';
    
    const query = sql`
      WITH revenue AS (
        SELECT SUM(value) as total_revenue
        FROM ${this.table}
        WHERE 
          organization_id = ${organizationId}
          AND metric_type = 'revenue'
          AND ${sql.identifier([entityField])} = ${entityId}
          AND period_start >= ${timeRange.start}
          AND period_end <= ${timeRange.end}
      ),
      costs AS (
        SELECT SUM(value) as total_costs
        FROM ${this.table}
        WHERE 
          organization_id = ${organizationId}
          AND metric_type = 'costs'
          AND ${sql.identifier([entityField])} = ${entityId}
          AND period_start >= ${timeRange.start}
          AND period_end <= ${timeRange.end}
      )
      SELECT 
        COALESCE(r.total_revenue, 0) as revenue,
        COALESCE(c.total_costs, 0) as costs,
        COALESCE(r.total_revenue, 0) - COALESCE(c.total_costs, 0) as profit,
        CASE 
          WHEN COALESCE(c.total_costs, 0) = 0 THEN NULL
          ELSE ((COALESCE(r.total_revenue, 0) - COALESCE(c.total_costs, 0)) / c.total_costs * 100)
        END as roi_percent
      FROM revenue r, costs c
    `;

    const result = await this.executeQuery(query);
    return result.rows[0];
  }
}