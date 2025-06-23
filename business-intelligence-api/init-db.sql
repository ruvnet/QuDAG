-- QuDAG Executive Intelligence Center
-- Business Database Schema
-- Version: 1.0.0
-- Created: 2025-06-23

-- Create schema for executive/business data
CREATE SCHEMA IF NOT EXISTS executive;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations (multi-tenant support)
CREATE TABLE executive.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE, -- Links to Firebase/Auth tenant
    name VARCHAR(255) NOT NULL,
    logo_url VARCHAR(500),
    industry VARCHAR(100),
    size VARCHAR(50), -- startup, smb, enterprise
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    settings JSONB DEFAULT '{
        "theme": "dark",
        "language": "en",
        "timezone": "UTC",
        "features": {
            "voice_commands": true,
            "predictive_analytics": true,
            "auto_scaling": true
        }
    }'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Departments within organization
CREATE TABLE executive.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES executive.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- sales, operations, service, r&d, finance
    parent_id UUID REFERENCES executive.departments(id) ON DELETE SET NULL,
    manager_agent_id VARCHAR(255), -- QuDAG agent ID of department head
    budget_allocation DECIMAL(20, 8) DEFAULT 0, -- rUv tokens allocated
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(organization_id, name)
);

-- Agent business profiles (extends core QuDAG agent data)
CREATE TABLE executive.agent_profiles (
    agent_id VARCHAR(255) PRIMARY KEY, -- QuDAG agent ID
    organization_id UUID NOT NULL REFERENCES executive.organizations(id) ON DELETE CASCADE,
    department_id UUID REFERENCES executive.departments(id) ON DELETE SET NULL,
    business_role VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    level VARCHAR(50), -- executive, manager, specialist, operator
    personality_type VARCHAR(50), -- hunter, farmer, analyst, creative, executor
    personality_traits JSONB DEFAULT '{
        "speed": 50,
        "accuracy": 50,
        "creativity": 50,
        "collaboration": 50
    }'::jsonb,
    compatibility JSONB DEFAULT '{
        "best_with": [],
        "avoid_with": []
    }'::jsonb,
    cost_per_hour DECIMAL(20, 8) DEFAULT 0,
    hired_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active', -- active, idle, error, maintenance, retired
    performance_rating DECIMAL(3, 2) DEFAULT 0.00, -- 0.00 to 5.00
    custom_settings JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Agent relationships (who reports to whom)
CREATE TABLE executive.agent_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES executive.organizations(id) ON DELETE CASCADE,
    supervisor_agent_id VARCHAR(255) NOT NULL,
    subordinate_agent_id VARCHAR(255) NOT NULL,
    relationship_type VARCHAR(50) DEFAULT 'reports_to', -- reports_to, collaborates_with, backs_up
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(supervisor_agent_id, subordinate_agent_id, relationship_type)
);

-- Business metrics (time-series data)
CREATE TABLE executive.business_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES executive.organizations(id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL, -- revenue, costs, profit, efficiency, quality
    metric_subtype VARCHAR(100), -- sales_revenue, service_revenue, compute_costs, etc.
    value DECIMAL(20, 8) NOT NULL,
    currency VARCHAR(10) DEFAULT 'rUv',
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    department_id UUID REFERENCES executive.departments(id) ON DELETE SET NULL,
    agent_id VARCHAR(255), -- Attribution to specific agent
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Agent performance metrics
CREATE TABLE executive.agent_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(255) NOT NULL,
    organization_id UUID NOT NULL REFERENCES executive.organizations(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL,
    tasks_completed INTEGER DEFAULT 0,
    tasks_failed INTEGER DEFAULT 0,
    success_rate DECIMAL(5, 2) DEFAULT 0.00,
    avg_response_time_ms INTEGER DEFAULT 0,
    revenue_generated DECIMAL(20, 8) DEFAULT 0,
    costs_incurred DECIMAL(20, 8) DEFAULT 0,
    roi DECIMAL(10, 2) DEFAULT 0.00,
    quality_score DECIMAL(3, 2) DEFAULT 0.00, -- 0.00 to 5.00
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(agent_id, organization_id, metric_date)
);

-- Natural language commands history
CREATE TABLE executive.command_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES executive.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- CEO/user who issued command
    command_text TEXT NOT NULL,
    command_type VARCHAR(50), -- hire, scale, analyze, report, optimize
    intent JSONB, -- Parsed intent structure
    result JSONB, -- Command execution result
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    execution_time_ms INTEGER,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Saved reports and dashboards
CREATE TABLE executive.saved_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES executive.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- dashboard, report, analysis, board_package
    description TEXT,
    configuration JSONB NOT NULL, -- Report configuration/filters
    schedule JSONB, -- Cron-like schedule for automated reports
    recipients JSONB DEFAULT '[]'::jsonb, -- Email/notification recipients
    is_public BOOLEAN DEFAULT false,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_generated_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Projects and initiatives
CREATE TABLE executive.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES executive.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'planning', -- planning, active, paused, completed, cancelled
    department_id UUID REFERENCES executive.departments(id) ON DELETE SET NULL,
    lead_agent_id VARCHAR(255),
    budget_allocated DECIMAL(20, 8) DEFAULT 0,
    budget_spent DECIMAL(20, 8) DEFAULT 0,
    start_date DATE,
    target_date DATE,
    completion_date DATE,
    success_metrics JSONB DEFAULT '{}'::jsonb,
    assigned_agents JSONB DEFAULT '[]'::jsonb, -- Array of agent IDs
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Scenario planning simulations
CREATE TABLE executive.scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES executive.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50), -- scaling, cost_optimization, market_change, competitor_response
    parameters JSONB NOT NULL, -- Simulation parameters
    results JSONB, -- Simulation results
    recommendations JSONB, -- AI-generated recommendations
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    executed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Alert configurations
CREATE TABLE executive.alert_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES executive.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- metric_threshold, anomaly, prediction
    condition JSONB NOT NULL, -- Alert condition configuration
    severity VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical
    notification_channels JSONB DEFAULT '["dashboard"]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for performance
CREATE INDEX idx_organizations_tenant ON executive.organizations(tenant_id);
CREATE INDEX idx_departments_org ON executive.departments(organization_id);
CREATE INDEX idx_agent_profiles_org ON executive.agent_profiles(organization_id);
CREATE INDEX idx_agent_profiles_dept ON executive.agent_profiles(department_id);
CREATE INDEX idx_agent_profiles_status ON executive.agent_profiles(status);
CREATE INDEX idx_metrics_org_time ON executive.business_metrics(organization_id, period_start DESC);
CREATE INDEX idx_metrics_type ON executive.business_metrics(metric_type, metric_subtype);
CREATE INDEX idx_agent_perf_agent_date ON executive.agent_performance(agent_id, metric_date DESC);
CREATE INDEX idx_agent_perf_org ON executive.agent_performance(organization_id);
CREATE INDEX idx_commands_org_time ON executive.command_history(organization_id, executed_at DESC);
CREATE INDEX idx_commands_user ON executive.command_history(user_id);
CREATE INDEX idx_projects_org_status ON executive.projects(organization_id, status);

-- Create update trigger for updated_at
CREATE OR REPLACE FUNCTION executive.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON executive.organizations
    FOR EACH ROW EXECUTE FUNCTION executive.update_updated_at_column();

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON executive.departments
    FOR EACH ROW EXECUTE FUNCTION executive.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON executive.projects
    FOR EACH ROW EXECUTE FUNCTION executive.update_updated_at_column();

CREATE TRIGGER update_saved_reports_updated_at BEFORE UPDATE ON executive.saved_reports
    FOR EACH ROW EXECUTE FUNCTION executive.update_updated_at_column();

-- Row Level Security (RLS) for multi-tenancy
ALTER TABLE executive.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE executive.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE executive.agent_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE executive.business_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE executive.agent_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE executive.command_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE executive.saved_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE executive.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE executive.scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE executive.alert_configs ENABLE ROW LEVEL SECURITY;

-- Create application user
CREATE USER qudag_app_user WITH PASSWORD 'qudag_secure_password';

-- Create RLS policies (to be customized based on auth system)
-- Example policy for organizations
CREATE POLICY "Users can view their own organization" ON executive.organizations
    FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Grant permissions
GRANT USAGE ON SCHEMA executive TO qudag_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA executive TO qudag_app_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA executive TO qudag_app_user;
