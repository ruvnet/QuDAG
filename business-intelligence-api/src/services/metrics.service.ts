/**
 * @description Business metrics service for analytics and reporting
 * @author CleoClaudeDesktop
 * @created 2025-06-23
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial metrics service implementation
 */

import { DatabasePool } from 'slonik';
import Redis from 'ioredis';
import { MetricsModel } from '../models/metrics';
import { BusinessMetric, TimeRangeParams } from '../types';
import { logger } from '../utils/logger';
import { Decimal } from 'decimal.js';
import { subDays, subMonths, startOfDay, endOfDay } from 'date-fns';

export class MetricsService {
  private model: MetricsModel;
  private redis: Redis;

  constructor(db: DatabasePool, redis: Redis) {
    this.model = new MetricsModel(db);
    this.redis = redis;
  }

  /**
   * @description Record a new business metric
   * @param {Partial<BusinessMetric>} data - Metric data
   * @returns {Promise<BusinessMetric>} Created metric
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async recordMetric(data: Partial<BusinessMetric>): Promise<BusinessMetric> {
    try {
      // Validate required fields
      if (!data.organization_id || !data.metric_type || !data.value) {
        throw new Error('Missing required fields: organization_id, metric_type, value');
      }

      // Set default period if not provided
      if (!data.period_start) {
        data.period_start = startOfDay(new Date());
      }
      if (!data.period_end) {
        data.period_end = endOfDay(new Date());
      }

      const metric = await this.model.record(data);
      
      logger.info({ 
        metricId: metric.id, 
        type: metric.metric_type,
        value: metric.value.toString()
      }, 'Metric recorded');

      // Publish metric update event
      await this.redis.publish('metrics:recorded', JSON.stringify(metric));

      // Update real-time dashboard data
      await this.updateRealtimeMetrics(metric);

      return metric;
    } catch (error) {
      logger.error({ error, data }, 'Failed to record metric');
      throw error;
    }
  }

  /**
   * @description Update real-time metrics in Redis
   * @param {BusinessMetric} metric - Metric to update
   * @private
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  private async updateRealtimeMetrics(metric: BusinessMetric): Promise<void> {
    const key = `realtime:${metric.organization_id}:${metric.metric_type}`;
    const ttl = 3600; // 1 hour

    try {
      // Get current value
      const current = await this.redis.get(key);
      const currentValue = current ? new Decimal(current) : new Decimal(0);
      
      // Add new value
      const newValue = currentValue.plus(metric.value);
      
      // Update Redis
      await this.redis.set(key, newValue.toString(), 'EX', ttl);
    } catch (error) {
      logger.error({ error, metric }, 'Failed to update realtime metrics');
    }
  }

  /**
   * @description Get aggregated metrics for organization
   * @param {string} organizationId - Organization ID
   * @param {TimeRangeParams} timeRange - Time range
   * @param {string[]} metricTypes - Metric types to include
   * @param {string} granularity - Aggregation granularity
   * @returns {Promise<any[]>} Aggregated metrics
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async getAggregatedMetrics(
    organizationId: string,
    timeRange: TimeRangeParams,
    metricTypes: string[] = [],
    granularity: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Promise<any[]> {
    try {
      return await this.model.getAggregated(
        organizationId,
        timeRange,
        metricTypes,
        granularity
      );
    } catch (error) {
      logger.error({ error, organizationId, timeRange }, 'Failed to get aggregated metrics');
      throw error;
    }
  }

  /**
   * @description Get organization dashboard data
   * @param {string} organizationId - Organization ID
   * @returns {Promise<any>} Dashboard data
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async getDashboardData(organizationId: string): Promise<any> {
    try {
      const now = new Date();
      const todayRange = {
        start: startOfDay(now),
        end: endOfDay(now),
      };
      const monthRange = {
        start: startOfDay(subDays(now, 30)),
        end: endOfDay(now),
      };

      // Get various metrics in parallel
      const [
        todayMetrics,
        monthMetrics,
        topAgents,
        topDepartments,
        realtimeData,
      ] = await Promise.all([
        // Today's metrics
        this.model.getAggregated(organizationId, todayRange, [], 'hour'),
        // Last 30 days
        this.model.getAggregated(organizationId, monthRange, [], 'day'),
        // Top performing agents
        this.model.getTopPerformers(organizationId, 'revenue', monthRange, 'agent', 5),
        // Top departments
        this.model.getTopPerformers(organizationId, 'revenue', monthRange, 'department', 5),
        // Real-time data from Redis
        this.getRealtimeData(organizationId),
      ]);

      // Calculate key metrics
      const totalRevenue = monthMetrics
        .filter(m => m.metric_type === 'revenue')
        .reduce((sum, m) => sum.plus(m.total), new Decimal(0));

      const totalCosts = monthMetrics
        .filter(m => m.metric_type === 'costs')
        .reduce((sum, m) => sum.plus(m.total), new Decimal(0));

      const profit = totalRevenue.minus(totalCosts);
      const profitMargin = totalRevenue.isZero() 
        ? new Decimal(0) 
        : profit.dividedBy(totalRevenue).times(100);

      return {
        summary: {
          revenue: totalRevenue.toString(),
          costs: totalCosts.toString(),
          profit: profit.toString(),
          profitMargin: profitMargin.toFixed(2),
        },
        today: todayMetrics,
        trend: monthMetrics,
        topAgents,
        topDepartments,
        realtime: realtimeData,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      logger.error({ error, organizationId }, 'Failed to get dashboard data');
      throw error;
    }
  }

  /**
   * @description Get real-time data from Redis
   * @param {string} organizationId - Organization ID
   * @returns {Promise<any>} Real-time metrics
   * @private
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  private async getRealtimeData(organizationId: string): Promise<any> {
    const metricTypes = ['revenue', 'costs', 'efficiency', 'quality'];
    const data: Record<string, string> = {};

    for (const type of metricTypes) {
      const key = `realtime:${organizationId}:${type}`;
      const value = await this.redis.get(key);
      data[type] = value || '0';
    }

    return data;
  }

  /**
   * @description Compare metrics across time periods
   * @param {string} organizationId - Organization ID
   * @param {TimeRangeParams} currentPeriod - Current period
   * @param {TimeRangeParams} previousPeriod - Previous period
   * @param {string[]} metricTypes - Metric types
   * @returns {Promise<any>} Comparison results
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async compareMetrics(
    organizationId: string,
    currentPeriod: TimeRangeParams,
    previousPeriod: TimeRangeParams,
    metricTypes: string[] = []
  ): Promise<any> {
    try {
      const comparison = await this.model.comparePerioods(
        organizationId,
        currentPeriod,
        previousPeriod,
        metricTypes
      );

      // Calculate summary statistics
      const summary = comparison.reduce((acc: any, item: any) => {
        if (!acc[item.metric_type]) {
          acc[item.metric_type] = {
            current: new Decimal(0),
            previous: new Decimal(0),
            change: new Decimal(0),
            changePercent: 0,
          };
        }

        const current = new Decimal(item.current_total || 0);
        const previous = new Decimal(item.previous_total || 0);

        acc[item.metric_type].current = acc[item.metric_type].current.plus(current);
        acc[item.metric_type].previous = acc[item.metric_type].previous.plus(previous);

        return acc;
      }, {});

      // Calculate change percentages
      Object.keys(summary).forEach(type => {
        const current = summary[type].current;
        const previous = summary[type].previous;
        
        summary[type].change = current.minus(previous);
        summary[type].changePercent = previous.isZero() 
          ? 0 
          : current.minus(previous).dividedBy(previous).times(100).toNumber();
        
        // Convert Decimal to string for JSON serialization
        summary[type].current = summary[type].current.toString();
        summary[type].previous = summary[type].previous.toString();
        summary[type].change = summary[type].change.toString();
      });

      return {
        details: comparison,
        summary,
        currentPeriod,
        previousPeriod,
      };
    } catch (error) {
      logger.error({ error, organizationId }, 'Failed to compare metrics');
      throw error;
    }
  }

  /**
   * @description Calculate ROI for entity
   * @param {string} organizationId - Organization ID
   * @param {TimeRangeParams} timeRange - Time range
   * @param {string} entityType - 'agent' or 'department'
   * @param {string} entityId - Entity ID
   * @returns {Promise<any>} ROI data
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
    try {
      const roi = await this.model.calculateROI(
        organizationId,
        timeRange,
        entityType,
        entityId
      );

      // Add additional context
      const metrics = entityType === 'agent'
        ? await this.model.getByAgent(entityId, timeRange)
        : await this.model.getByDepartment(organizationId, entityId, timeRange);

      return {
        ...roi,
        revenue: roi.revenue.toString(),
        costs: roi.costs.toString(),
        profit: roi.profit.toString(),
        roi_percent: roi.roi_percent ? parseFloat(roi.roi_percent).toFixed(2) : null,
        transactionCount: metrics.length,
        timeRange,
        entityType,
        entityId,
      };
    } catch (error) {
      logger.error({ error, organizationId, entityId }, 'Failed to calculate ROI');
      throw error;
    }
  }

  /**
   * @description Get performance trends
   * @param {string} organizationId - Organization ID
   * @param {number} days - Number of days to analyze
   * @returns {Promise<any>} Performance trends
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async getPerformanceTrends(organizationId: string, days: number = 30): Promise<any> {
    try {
      const endDate = new Date();
      const startDate = subDays(endDate, days);
      
      const timeRange = {
        start: startOfDay(startDate),
        end: endOfDay(endDate),
      };

      // Get daily metrics
      const dailyMetrics = await this.model.getAggregated(
        organizationId,
        timeRange,
        ['revenue', 'costs', 'efficiency', 'quality'],
        'day'
      );

      // Group by date
      const trendData = dailyMetrics.reduce((acc: any, metric: any) => {
        if (!acc[metric.period]) {
          acc[metric.period] = {};
        }
        acc[metric.period][metric.metric_type] = {
          value: metric.total.toString(),
          avg: metric.avg.toString(),
          count: metric.count,
        };
        return acc;
      }, {});

      // Calculate moving averages
      const dates = Object.keys(trendData).sort();
      const movingAverages = this.calculateMovingAverages(dates, trendData, 7);

      return {
        daily: trendData,
        movingAverages,
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          days,
        },
      };
    } catch (error) {
      logger.error({ error, organizationId, days }, 'Failed to get performance trends');
      throw error;
    }
  }

  /**
   * @description Calculate moving averages
   * @param {string[]} dates - Array of dates
   * @param {any} data - Daily data
   * @param {number} window - Window size
   * @returns {any} Moving averages
   * @private
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  private calculateMovingAverages(
    dates: string[],
    data: any,
    window: number
  ): any {
    const metricTypes = ['revenue', 'costs', 'efficiency', 'quality'];
    const result: any = {};

    dates.forEach((date, index) => {
      if (index < window - 1) return;

      result[date] = {};
      
      metricTypes.forEach(type => {
        let sum = new Decimal(0);
        let count = 0;

        for (let i = index - window + 1; i <= index; i++) {
          if (data[dates[i]] && data[dates[i]][type]) {
            sum = sum.plus(data[dates[i]][type].value);
            count++;
          }
        }

        if (count > 0) {
          result[date][type] = sum.dividedBy(count).toString();
        }
      });
    });

    return result;
  }

  /**
   * @description Generate metric forecast
   * @param {string} organizationId - Organization ID
   * @param {string} metricType - Metric type
   * @param {number} forecastDays - Days to forecast
   * @returns {Promise<any>} Forecast data
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async generateForecast(
    organizationId: string,
    metricType: string,
    forecastDays: number = 30
  ): Promise<any> {
    try {
      // Get historical data (90 days)
      const historicalDays = 90;
      const endDate = new Date();
      const startDate = subDays(endDate, historicalDays);
      
      const timeRange = {
        start: startOfDay(startDate),
        end: endOfDay(endDate),
      };

      const historicalData = await this.model.getAggregated(
        organizationId,
        timeRange,
        [metricType],
        'day'
      );

      // Simple linear regression forecast
      // In production, use more sophisticated forecasting methods
      const forecast = this.calculateLinearForecast(
        historicalData,
        forecastDays
      );

      return {
        historical: historicalData,
        forecast,
        metricType,
        forecastDays,
        confidence: 0.75, // Placeholder confidence score
      };
    } catch (error) {
      logger.error({ error, organizationId, metricType }, 'Failed to generate forecast');
      throw error;
    }
  }

  /**
   * @description Calculate linear forecast (simplified)
   * @param {any[]} data - Historical data
   * @param {number} days - Days to forecast
   * @returns {any[]} Forecast data
   * @private
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  private calculateLinearForecast(data: any[], days: number): any[] {
    if (data.length < 2) return [];

    // Calculate trend (simplified linear regression)
    const values = data.map(d => parseFloat(d.total.toString()));
    const avgValue = values.reduce((a, b) => a + b, 0) / values.length;
    const trend = (values[values.length - 1] - values[0]) / values.length;

    const forecast = [];
    const lastDate = new Date(data[data.length - 1].period);

    for (let i = 1; i <= days; i++) {
      const forecastDate = new Date(lastDate);
      forecastDate.setDate(forecastDate.getDate() + i);
      
      const forecastValue = avgValue + (trend * (data.length + i));
      
      forecast.push({
        period: forecastDate.toISOString().split('T')[0],
        value: Math.max(0, forecastValue).toFixed(2),
        is_forecast: true,
      });
    }

    return forecast;
  }
}