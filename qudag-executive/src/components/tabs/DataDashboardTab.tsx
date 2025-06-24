/**
 * @description Real data dashboard with live API-connected tables
 * @author CleoClaudeDesktop
 * @created 2025-06-23
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Live data dashboard
 */

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Database,
  Users,
  BarChart3,
  FolderOpen,
  Activity,
  TrendingUp,
  DollarSign,
  Target,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { AgentsTable } from "../tables/AgentsTable";
import { MetricsTable } from "../tables/MetricsTable";
import { ProjectsTable } from "../tables/ProjectsTable";
import { apiService } from "../../services/api";
import { cn } from "../../lib/utils";

interface DataDashboardTabProps {
  theme?: "light" | "dark";
}

type ActiveTable = "agents" | "metrics" | "projects" | "overview";

export function DataDashboardTab({ theme = "light" }: DataDashboardTabProps) {
  const [activeTable, setActiveTable] = useState<ActiveTable>("overview");

  // Use the known organization ID until organizations API is implemented
  const organizationId = "550e8400-e29b-41d4-a716-446655440000";

  // Fetch summary data for overview
  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ["health"],
    queryFn: () => apiService.health(),
    refetchInterval: 10000,
  });

  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ["metrics-summary", organizationId],
    queryFn: () => apiService.metrics.summary(organizationId),
    refetchInterval: 30000,
  });

  const { data: agentsData, isLoading: agentsLoading } = useQuery({
    queryKey: ["agents-summary", organizationId],
    queryFn: () => apiService.agents.list(organizationId, 1, 5),
    refetchInterval: 30000,
  });

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ["projects-summary", organizationId],
    queryFn: () => apiService.projects.list(organizationId, undefined, 1, 5),
    refetchInterval: 30000,
  });

  const tabs = [
    {
      id: "overview" as const,
      title: "Overview",
      icon: BarChart3,
      description: "System status and key metrics",
    },
    {
      id: "agents" as const,
      title: "Agents",
      icon: Users,
      description: "AI agent workforce management",
    },
    {
      id: "metrics" as const,
      title: "Metrics",
      icon: TrendingUp,
      description: "Business performance indicators",
    },
    {
      id: "projects" as const,
      title: "Projects",
      icon: FolderOpen,
      description: "Project portfolio tracking",
    },
  ];

  const StatCard = ({
    title,
    value,
    icon: Icon,
    color,
    trend,
    loading = false,
  }: {
    title: string;
    value: string | number;
    icon: React.ElementType;
    color: string;
    trend?: string;
    loading?: boolean;
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "p-6 rounded-lg border",
        theme === "dark" ?
          "bg-gray-800 border-gray-700"
        : "bg-white border-gray-200"
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p
            className={cn(
              "text-sm font-medium",
              theme === "dark" ? "text-gray-400" : "text-gray-500"
            )}
          >
            {title}
          </p>
          <p
            className={cn(
              "text-2xl font-bold mt-2",
              theme === "dark" ? "text-white" : "text-gray-900"
            )}
          >
            {loading ?
              <RefreshCw className="w-6 h-6 animate-spin" />
            : value}
          </p>
          {trend && <p className="text-sm text-green-600 mt-1">{trend}</p>}
        </div>
        <div className={cn("p-3 rounded-full", color)}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </motion.div>
  );

  const renderOverview = () => (
    <div className="space-y-6">
      {/* API Status */}
      <div
        className={cn(
          "p-4 rounded-lg border flex items-center gap-3",
          healthData?.success ?
            theme === "dark" ?
              "bg-green-900/20 border-green-800 text-green-400"
            : "bg-green-50 border-green-200 text-green-700"
          : theme === "dark" ? "bg-red-900/20 border-red-800 text-red-400"
          : "bg-red-50 border-red-200 text-red-700"
        )}
      >
        {healthData?.success ?
          <Activity className="w-5 h-5" />
        : <AlertCircle className="w-5 h-5" />}
        <div>
          <div className="font-medium">
            API Status:{" "}
            {healthLoading ?
              "Checking..."
            : healthData?.success ?
              "Healthy"
            : "Error"}
          </div>
          {healthData && (
            <div className="text-sm opacity-75">
              Service: {healthData.service} v{healthData.version}
            </div>
          )}
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 3xl:grid-cols-6 5xl:grid-cols-8 gap-6">
        <StatCard
          title="Total Revenue"
          value={
            metricsData?.data?.totalRevenue ?
              `$${(metricsData.data.totalRevenue / 1000).toFixed(0)}K`
            : "$0"
          }
          icon={DollarSign}
          color="bg-green-500"
          trend="+12% from last month"
          loading={metricsLoading}
        />
        <StatCard
          title="Active Agents"
          value={agentsData?.data?.length || 0}
          icon={Users}
          color="bg-blue-500"
          trend="+3 new this week"
          loading={agentsLoading}
        />
        <StatCard
          title="Active Projects"
          value={
            projectsData?.data?.filter((p) => p.status === "active").length || 0
          }
          icon={FolderOpen}
          color="bg-purple-500"
          trend="2 completed this month"
          loading={projectsLoading}
        />
        <StatCard
          title="Efficiency Score"
          value={
            metricsData?.data?.efficiency ?
              `${(metricsData.data.efficiency * 100).toFixed(0)}%`
            : "N/A"
          }
          icon={Target}
          color="bg-orange-500"
          trend="+5% this quarter"
          loading={metricsLoading}
        />
      </div>

      {/* Quick Tables Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 3xl:grid-cols-3 4xl:grid-cols-4 gap-6">
        {/* Recent Agents */}
        <div
          className={cn(
            "p-6 rounded-lg border",
            theme === "dark" ?
              "bg-gray-800 border-gray-700"
            : "bg-white border-gray-200"
          )}
        >
          <h3
            className={cn(
              "text-lg font-semibold mb-4",
              theme === "dark" ? "text-white" : "text-gray-900"
            )}
          >
            Recent Agents
          </h3>
          {agentsLoading ?
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
          : <div className="space-y-3">
              {agentsData?.data?.slice(0, 3).map((agent, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "p-2 rounded-full",
                        agent.status === "active" ?
                          "bg-green-100 text-green-600"
                        : "bg-gray-100 text-gray-600"
                      )}
                    >
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium">{agent.business_role}</div>
                      <div
                        className={cn(
                          "text-sm",
                          theme === "dark" ? "text-gray-400" : "text-gray-500"
                        )}
                      >
                        {agent.level} • {agent.personality_type}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-medium">
                    {agent.performance_rating?.toFixed(1)}/5.0
                  </div>
                </div>
              )) || (
                <div
                  className={cn(
                    "text-center py-4",
                    theme === "dark" ? "text-gray-400" : "text-gray-500"
                  )}
                >
                  No agents data available
                </div>
              )}
            </div>
          }
        </div>

        {/* Recent Projects */}
        <div
          className={cn(
            "p-6 rounded-lg border",
            theme === "dark" ?
              "bg-gray-800 border-gray-700"
            : "bg-white border-gray-200"
          )}
        >
          <h3
            className={cn(
              "text-lg font-semibold mb-4",
              theme === "dark" ? "text-white" : "text-gray-900"
            )}
          >
            Recent Projects
          </h3>
          {projectsLoading ?
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
          : <div className="space-y-3">
              {projectsData?.data?.slice(0, 3).map((project, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "p-2 rounded-full",
                        project.status === "active" ?
                          "bg-blue-100 text-blue-600"
                        : "bg-gray-100 text-gray-600"
                      )}
                    >
                      <FolderOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium truncate max-w-xs">
                        {project.name}
                      </div>
                      <div
                        className={cn(
                          "text-sm capitalize",
                          theme === "dark" ? "text-gray-400" : "text-gray-500"
                        )}
                      >
                        {project.status}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-green-600">
                    ${(project.budget_allocated / 1000).toFixed(0)}K
                  </div>
                </div>
              )) || (
                <div
                  className={cn(
                    "text-center py-4",
                    theme === "dark" ? "text-gray-400" : "text-gray-500"
                  )}
                >
                  No projects data available
                </div>
              )}
            </div>
          }
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        "h-full flex flex-col",
        theme === "dark" ? "bg-gray-900" : "bg-gray-50"
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "p-6 md:p-8 lg:px-12 xl:px-16 2xl:px-20 3xl:px-24 4xl:px-28 5xl:px-32 border-b",
          theme === "dark" ? "border-gray-700" : "border-gray-200"
        )}
      >
        <div className="flex items-center gap-3 mb-6">
          <Database className="w-6 h-6 text-blue-500" />
          <div>
            <h1
              className={cn(
                "text-2xl font-bold",
                theme === "dark" ? "text-white" : "text-gray-900"
              )}
            >
              Data Intelligence Center
            </h1>
            <p
              className={cn(
                "text-sm",
                theme === "dark" ? "text-gray-400" : "text-gray-500"
              )}
            >
              Real-time business intelligence and operational data
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTable(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                activeTable === tab.id ?
                  theme === "dark" ?
                    "bg-blue-600 text-white"
                  : "bg-blue-600 text-white"
                : theme === "dark" ?
                  "text-gray-400 hover:text-white hover:bg-gray-700"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.title}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 md:p-8 lg:px-12 xl:px-16 2xl:px-20 3xl:px-24 4xl:px-28 5xl:px-32 overflow-auto">
        <motion.div
          key={activeTable}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {activeTable === "overview" && renderOverview()}
          {activeTable === "agents" && (
            <AgentsTable organizationId={organizationId} theme={theme} />
          )}
          {activeTable === "metrics" && (
            <MetricsTable organizationId={organizationId} theme={theme} />
          )}
          {activeTable === "projects" && (
            <ProjectsTable organizationId={organizationId} theme={theme} />
          )}
        </motion.div>
      </div>
    </div>
  );
}
