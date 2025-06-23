/**
 * @description Seed the PostgreSQL database with test data
 * @author CleoClaudeDesktop
 * @created 2025-06-23
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Database seeding
 */

import { createPool, sql } from 'slonik';
import { testOrganizations, testDepartments, testAgents, testMetrics, testProjects } from './test-data';

const DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/qudag_bi';

async function seedDatabase() {
  const pool = await createPool(DATABASE_URL);
  
  try {
    console.log('🌱 Starting database seeding...');
    
    // Clear existing data
    console.log('🧹 Clearing existing data...');
    await pool.query(sql`DELETE FROM executive.scenarios`);
    await pool.query(sql`DELETE FROM executive.projects`);
    await pool.query(sql`DELETE FROM executive.business_metrics`);
    await pool.query(sql`DELETE FROM executive.agent_performance`);
    await pool.query(sql`DELETE FROM executive.command_history`);
    await pool.query(sql`DELETE FROM executive.saved_reports`);
    await pool.query(sql`DELETE FROM executive.alert_configs`);
    await pool.query(sql`DELETE FROM executive.agent_relationships`);
    await pool.query(sql`DELETE FROM executive.agent_profiles`);
    await pool.query(sql`DELETE FROM executive.departments`);
    await pool.query(sql`DELETE FROM executive.organizations`);
    
    // Insert Organizations
    console.log('🏢 Inserting organizations...');
    for (const org of testOrganizations) {
      await pool.query(sql`
        INSERT INTO executive.organizations (
          id, tenant_id, name, logo_url, industry, size, 
          created_at, updated_at, settings, metadata
        ) VALUES (
          ${org.id}, ${org.tenant_id}, ${org.name}, ${org.logo_url}, 
          ${org.industry}, ${org.size}, ${org.created_at}, ${org.updated_at},
          ${JSON.stringify(org.settings)}, ${JSON.stringify(org.metadata)}
        )
      `);
    }
    
    // Insert Departments
    console.log('🏬 Inserting departments...');
    for (const dept of testDepartments) {
      await pool.query(sql`
        INSERT INTO executive.departments (
          id, organization_id, name, type, parent_id, manager_agent_id,
          budget_allocation, created_at, metadata
        ) VALUES (
          ${dept.id}, ${dept.organization_id}, ${dept.name}, ${dept.type},
          ${dept.parent_id || null}, ${dept.manager_agent_id || null},
          ${dept.budget_allocation}, ${dept.created_at}, ${JSON.stringify(dept.metadata)}
        )
      `);
    }
    
    // Insert Agent Profiles
    console.log('🤖 Inserting agent profiles...');
    for (const agent of testAgents) {
      await pool.query(sql`
        INSERT INTO executive.agent_profiles (
          agent_id, organization_id, department_id, business_role, title,
          level, personality_type, personality_traits, compatibility,
          cost_per_hour, hired_at, last_active, status, performance_rating,
          custom_settings, metadata
        ) VALUES (
          ${agent.agent_id}, ${agent.organization_id}, ${agent.department_id},
          ${agent.business_role}, ${agent.title}, ${agent.level}, ${agent.personality_type},
          ${JSON.stringify(agent.personality_traits)}, ${JSON.stringify({ best_with: [], avoid_with: [] })},
          ${agent.cost_per_hour}, ${agent.hired_at}, ${agent.last_active}, ${agent.status},
          ${agent.performance_rating}, ${JSON.stringify(agent.custom_settings)}, ${JSON.stringify(agent.metadata)}
        )
      `);
    }
    
    // Insert Business Metrics
    console.log('📊 Inserting business metrics...');
    for (const metric of testMetrics) {
      await pool.query(sql`
        INSERT INTO executive.business_metrics (
          id, organization_id, metric_type, metric_subtype, value, currency,
          period_start, period_end, department_id, agent_id, metadata, created_at
        ) VALUES (
          ${metric.id}, ${metric.organization_id}, ${metric.metric_type}, ${metric.metric_subtype},
          ${metric.value}, ${metric.currency}, ${metric.period_start}, ${metric.period_end},
          ${metric.department_id || null}, ${metric.agent_id || null}, 
          ${JSON.stringify(metric.metadata)}, ${metric.created_at}
        )
      `);
    }
    
    // Insert Projects
    console.log('🎯 Inserting projects...');
    for (const project of testProjects) {
      await pool.query(sql`
        INSERT INTO executive.projects (
          id, organization_id, name, description, status, department_id,
          lead_agent_id, budget_allocated, budget_spent, start_date, target_date,
          completion_date, success_metrics, assigned_agents, created_at, updated_at, metadata
        ) VALUES (
          ${project.id}, ${project.organization_id}, ${project.name}, ${project.description},
          ${project.status}, ${project.department_id}, ${project.lead_agent_id},
          ${project.budget_allocated}, ${project.budget_spent}, ${project.start_date},
          ${project.target_date}, ${project.completion_date || null}, 
          ${JSON.stringify(project.success_metrics)}, ${JSON.stringify(project.assigned_agents)},
          ${project.created_at}, ${project.updated_at}, ${JSON.stringify(project.metadata)}
        )
      `);
    }
    
    console.log('✅ Database seeding completed successfully!');
    console.log(`   - ${testOrganizations.length} organizations`);
    console.log(`   - ${testDepartments.length} departments`);
    console.log(`   - ${testAgents.length} agent profiles`);
    console.log(`   - ${testMetrics.length} business metrics`);
    console.log(`   - ${testProjects.length} projects`);
    
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  seedDatabase().catch(console.error);
}

export { seedDatabase };