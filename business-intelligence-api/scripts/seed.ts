/**
 * @description Database seeding script for development
 * @author CleoClaudeDesktop
 * @created 2025-06-23
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial seed script
 */

import 'dotenv/config';
import { createPool, sql } from 'slonik';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../src/utils/logger';

async function seed() {
  const pool = await createPool(process.env.DATABASE_URL!);

  try {
    logger.info('Starting database seeding...');

    // Create test organization
    const orgId = uuidv4();
    const tenantId = uuidv4();
    
    await pool.query(sql`
      INSERT INTO executive.organizations (
        id, tenant_id, name, logo_url, industry, size, settings
      ) VALUES (
        ${orgId},
        ${tenantId},
        'Acme Corporation',
        'https://example.com/logo.png',
        'technology',
        'startup',
        ${sql.json({
          theme: 'dark',
          language: 'en',
          timezone: 'America/Los_Angeles',
          features: {
            voice_commands: true,
            predictive_analytics: true,
            auto_scaling: true,
          },
        })}
      )
    `);

    logger.info('Created test organization');

    // Create departments
    const departments = [
      { id: uuidv4(), name: 'Sales', type: 'sales' },
      { id: uuidv4(), name: 'Customer Service', type: 'service' },
      { id: uuidv4(), name: 'Operations', type: 'operations' },
      { id: uuidv4(), name: 'Engineering', type: 'r&d' },
      { id: uuidv4(), name: 'Finance', type: 'finance' },
    ];

    for (const dept of departments) {
      await pool.query(sql`
        INSERT INTO executive.departments (
          id, organization_id, name, type, budget_allocation
        ) VALUES (
          ${dept.id},
          ${orgId},
          ${dept.name},
          ${dept.type},
          ${10000}
        )
      `);
    }

    logger.info('Created departments');

    // Create sample agents
    const agentTypes = [
      { role: 'Sales Representative', level: 'specialist', personality: 'hunter', dept: 'sales' },
      { role: 'Customer Success Manager', level: 'specialist', personality: 'farmer', dept: 'service' },
      { role: 'Data Analyst', level: 'specialist', personality: 'analyst', dept: 'operations' },
      { role: 'Creative Director', level: 'manager', personality: 'creative', dept: 'r&d' },
      { role: 'Operations Manager', level: 'manager', personality: 'executor', dept: 'operations' },
    ];

    const agents = [];
    for (let i = 0; i < 20; i++) {
      const type = agentTypes[i % agentTypes.length];
      const dept = departments.find(d => d.type === type.dept);
      const agentId = `agent-${uuidv4().substring(0, 8)}`;
      
      agents.push({
        id: agentId,
        departmentId: dept!.id,
        ...type,
      });

      await pool.query(sql`
        INSERT INTO executive.agent_profiles (
          agent_id,
          organization_id,
          department_id,
          business_role,
          level,
          personality_type,
          personality_traits,
          cost_per_hour,
          performance_rating
        ) VALUES (
          ${agentId},
          ${orgId},
          ${dept!.id},
          ${type.role},
          ${type.level},
          ${type.personality},
          ${sql.json({
            speed: 50 + Math.random() * 50,
            accuracy: 50 + Math.random() * 50,
            creativity: 50 + Math.random() * 50,
            collaboration: 50 + Math.random() * 50,
          })},
          ${10 + Math.random() * 90},
          ${3 + Math.random() * 2}
        )
      `);
    }

    logger.info('Created sample agents');

    // Create sample metrics for the last 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    for (let d = 0; d < 30; d++) {
      const date = new Date(thirtyDaysAgo.getTime() + d * 24 * 60 * 60 * 1000);
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));

      // Revenue metrics
      for (const agent of agents.slice(0, 10)) {
        const revenue = 1000 + Math.random() * 9000;
        await pool.query(sql`
          INSERT INTO executive.business_metrics (
            organization_id,
            metric_type,
            metric_subtype,
            value,
            period_start,
            period_end,
            department_id,
            agent_id
          ) VALUES (
            ${orgId},
            'revenue',
            'sales_revenue',
            ${revenue},
            ${dayStart},
            ${dayEnd},
            ${agent.departmentId},
            ${agent.id}
          )
        `);
      }

      // Cost metrics
      for (const dept of departments) {
        const costs = 500 + Math.random() * 4500;
        await pool.query(sql`
          INSERT INTO executive.business_metrics (
            organization_id,
            metric_type,
            metric_subtype,
            value,
            period_start,
            period_end,
            department_id
          ) VALUES (
            ${orgId},
            'costs',
            'operational_costs',
            ${costs},
            ${dayStart},
            ${dayEnd},
            ${dept.id}
          )
        `);
      }

      // Efficiency metrics
      const efficiency = 60 + Math.random() * 30;
      await pool.query(sql`
        INSERT INTO executive.business_metrics (
          organization_id,
          metric_type,
          value,
          period_start,
          period_end
        ) VALUES (
          ${orgId},
          'efficiency',
          ${efficiency},
          ${dayStart},
          ${dayEnd}
        )
      `);
    }

    logger.info('Created sample metrics');

    // Create sample commands
    const commands = [
      'Hire 3 sales agents',
      'Show revenue dashboard',
      'Optimize team performance',
      'Compare this month to last month',
      'Forecast next quarter revenue',
    ];

    const userId = uuidv4();
    for (const command of commands) {
      await pool.query(sql`
        INSERT INTO executive.command_history (
          organization_id,
          user_id,
          command_text,
          command_type,
          success,
          execution_time_ms,
          executed_at
        ) VALUES (
          ${orgId},
          ${userId},
          ${command},
          ${command.includes('hire') ? 'hire' : command.includes('show') ? 'report' : 'analyze'},
          ${true},
          ${100 + Math.random() * 900},
          ${new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000)}
        )
      `);
    }

    logger.info('Created sample command history');

    // Create a sample dashboard
    await pool.query(sql`
      INSERT INTO executive.saved_reports (
        organization_id,
        name,
        type,
        description,
        configuration,
        is_public,
        created_by
      ) VALUES (
        ${orgId},
        'Executive Overview',
        'dashboard',
        'Main dashboard for executive team',
        ${sql.json({
          widgets: [
            {
              id: 'revenue-widget',
              type: 'metric',
              title: 'Total Revenue',
              dataSource: {
                metric: 'revenue',
                aggregation: 'sum',
              },
              position: { x: 0, y: 0, width: 4, height: 2 },
            },
            {
              id: 'efficiency-gauge',
              type: 'gauge',
              title: 'Efficiency Score',
              dataSource: {
                metric: 'efficiency',
                aggregation: 'avg',
              },
              position: { x: 4, y: 0, width: 4, height: 2 },
            },
          ],
          layout: 'grid',
          refreshInterval: 300000,
        })},
        ${true},
        ${userId}
      )
    `);

    logger.info('Created sample dashboard');

    logger.info('Database seeding completed successfully!');
    logger.info(`Organization ID: ${orgId}`);
    logger.info(`Tenant ID: ${tenantId}`);
  } catch (error) {
    logger.error(error, 'Seeding failed');
    throw error;
  } finally {
    await pool.end();
  }
}

// Run seeding
seed().catch(error => {
  console.error('Seeding failed:', error);
  process.exit(1);
});