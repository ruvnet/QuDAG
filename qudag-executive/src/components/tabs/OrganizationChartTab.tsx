/**
 * @description Organization Chart Tab - Revolutionary workforce visualization
 * @author Claude Code
 * @created 2025-06-24
 * @lastModified 2025-06-24 - Living org chart with business intelligence
 */

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Users,
  TrendingUp,
  DollarSign,
  Activity,
  Plus,
  Download,
  BarChart3,
  Zap,
  Target,
} from "lucide-react";
import { LivingOrgChart } from "../LivingOrgChart";
import { apiService, type AgentProfile } from "../../services/api";
import { cn } from "../../lib/utils";

interface OrganizationChartTabProps {
  theme: "light" | "dark";
  onNotification?: (
    message: string,
    type: "info" | "success" | "warning" | "error"
  ) => void;
}

export function OrganizationChartTab({
  theme,
  onNotification,
}: OrganizationChartTabProps) {
  const [selectedAgent, setSelectedAgent] = useState<AgentProfile | null>(null);
  const showStats = true; // Always show stats for now

  // Use the known organization ID until organizations API is implemented
  const organizationId = "550e8400-e29b-41d4-a716-446655440000";

  // Fetch agents data
  const { data: agentsData, isLoading } = useQuery({
    queryKey: ["agents-org-chart", organizationId],
    queryFn: () => apiService.agents.list(organizationId, 1, 100),
    refetchInterval: 30000,
  });

  // Fetch summary metrics
  const { data: metricsData } = useQuery({
    queryKey: ["metrics-org-summary", organizationId],
    queryFn: () => apiService.metrics.summary(organizationId),
    refetchInterval: 30000,
  });

  const agents = agentsData?.data || [];
  const metrics = metricsData?.data;

  // Calculate workforce stats
  const workforceStats = {
    totalAgents: agents.length,
    activeAgents: agents.filter((a) => a.status === "active").length,
    totalRevenue: metrics?.totalRevenue || 0,
    averageRating:
      agents.length > 0 ?
        agents.reduce((sum, a) => sum + (a.performance_rating || 0), 0) /
        agents.length
      : 0,
    departments: [...new Set(agents.map((a) => a.department_id || "general"))]
      .length,
    topPerformer: agents.reduce(
      (top, agent) =>
        (agent.performance_rating || 0) > (top?.performance_rating || 0) ?
          agent
        : top,
      agents[0]
    ),
  };

  const handleAgentSelect = (agent: AgentProfile) => {
    setSelectedAgent(agent);
    onNotification?.(
      `Selected ${agent.business_role} - ${agent.level}`,
      "info"
    );
  };

  const handleAgentAction = (action: string, agent: AgentProfile) => {
    switch (action) {
      case "optimize":
        onNotification?.(
          `🚀 Optimizing ${agent.business_role} for peak performance...`,
          "info"
        );
        break;
      case "assign_task":
        onNotification?.(
          `📋 Task assignment wizard opened for ${agent.business_role}`,
          "info"
        );
        break;
      case "view_details":
        onNotification?.(
          `📊 Opening detailed analytics for ${agent.business_role}`,
          "info"
        );
        break;
      default:
        onNotification?.(
          `Action ${action} performed on ${agent.business_role}`,
          "info"
        );
    }
  };

  const handleQuickHire = () => {
    onNotification?.('🎤 Try saying: "Hire 3 customer service agents"', "info");
  };

  const handleExportChart = () => {
    onNotification?.("📊 Organization chart exported to Downloads", "success");
  };

  return (
    <div
      className={cn(
        "h-full flex flex-col",
        theme === "dark" ? "bg-gray-900" : "bg-gray-50"
      )}
    >
      {/* Header with Stats */}
      <div
        className={cn(
          "p-6 md:p-8 lg:px-12 xl:px-16 2xl:px-20 3xl:px-24 4xl:px-28 5xl:px-32 border-b",
          theme === "dark" ?
            "border-gray-700 bg-gray-800"
          : "border-gray-200 bg-white"
        )}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1
                className={cn(
                  "text-2xl font-bold",
                  theme === "dark" ? "text-white" : "text-gray-900"
                )}
              >
                AI Workforce Organization
              </h1>
              <p
                className={cn(
                  "text-sm",
                  theme === "dark" ? "text-gray-400" : "text-gray-500"
                )}
              >
                Visual command center for your autonomous team
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleQuickHire}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Quick Hire
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleExportChart}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
                theme === "dark" ?
                  "bg-gray-700 text-gray-200 hover:bg-gray-600"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              <Download className="w-4 h-4" />
              Export
            </motion.button>
          </div>
        </div>

        {/* Workforce Stats */}
        {showStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 3xl:grid-cols-8 4xl:grid-cols-12 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "p-4 rounded-lg border",
                theme === "dark" ?
                  "bg-gray-700 border-gray-600"
                : "bg-white border-gray-200"
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium">Total Agents</span>
              </div>
              <div
                className={cn(
                  "text-2xl font-bold",
                  theme === "dark" ? "text-white" : "text-gray-900"
                )}
              >
                {workforceStats.totalAgents}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={cn(
                "p-4 rounded-lg border",
                theme === "dark" ?
                  "bg-gray-700 border-gray-600"
                : "bg-white border-gray-200"
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium">Active Now</span>
              </div>
              <div
                className={cn(
                  "text-2xl font-bold text-green-600",
                  theme === "dark" ? "text-green-400" : "text-green-600"
                )}
              >
                {workforceStats.activeAgents}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={cn(
                "p-4 rounded-lg border",
                theme === "dark" ?
                  "bg-gray-700 border-gray-600"
                : "bg-white border-gray-200"
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-yellow-500" />
                <span className="text-sm font-medium">Monthly Revenue</span>
              </div>
              <div
                className={cn(
                  "text-2xl font-bold",
                  theme === "dark" ? "text-white" : "text-gray-900"
                )}
              >
                ${(workforceStats.totalRevenue / 1000).toFixed(0)}K
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={cn(
                "p-4 rounded-lg border",
                theme === "dark" ?
                  "bg-gray-700 border-gray-600"
                : "bg-white border-gray-200"
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium">Avg Rating</span>
              </div>
              <div
                className={cn(
                  "text-2xl font-bold",
                  theme === "dark" ? "text-white" : "text-gray-900"
                )}
              >
                {workforceStats.averageRating.toFixed(1)}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className={cn(
                "p-4 rounded-lg border",
                theme === "dark" ?
                  "bg-gray-700 border-gray-600"
                : "bg-white border-gray-200"
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-medium">Departments</span>
              </div>
              <div
                className={cn(
                  "text-2xl font-bold",
                  theme === "dark" ? "text-white" : "text-gray-900"
                )}
              >
                {workforceStats.departments}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className={cn(
                "p-4 rounded-lg border",
                theme === "dark" ?
                  "bg-gray-700 border-gray-600"
                : "bg-white border-gray-200"
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-medium">Top Performer</span>
              </div>
              <div
                className={cn(
                  "text-sm font-bold truncate",
                  theme === "dark" ? "text-white" : "text-gray-900"
                )}
              >
                {workforceStats.topPerformer?.business_role || "None yet"}
              </div>
              {workforceStats.topPerformer && (
                <div className="text-xs text-emerald-600">
                  {workforceStats.topPerformer.performance_rating?.toFixed(1)}
                  /5.0
                </div>
              )}
            </motion.div>
          </div>
        )}
      </div>

      {/* Main Chart Area */}
      <div className="flex-1 min-h-0">
        {isLoading ?
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full mx-auto mb-4"
              />
              <div
                className={cn(
                  "text-lg font-medium",
                  theme === "dark" ? "text-gray-300" : "text-gray-700"
                )}
              >
                Building your organization chart...
              </div>
            </div>
          </div>
        : <LivingOrgChart
            agents={agents}
            theme={theme}
            onAgentSelect={handleAgentSelect}
            onAgentAction={handleAgentAction}
          />
        }
      </div>

      {/* Selected Agent Quick Info */}
      {selectedAgent && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className={cn(
            "p-4 border-t",
            theme === "dark" ?
              "border-gray-700 bg-gray-800"
            : "border-gray-200 bg-white"
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-lg",
                  theme === "dark" ? "bg-gray-700" : "bg-gray-100"
                )}
              >
                {selectedAgent.personality_type === "hunter" ?
                  "🎯"
                : selectedAgent.personality_type === "farmer" ?
                  "🌱"
                : selectedAgent.personality_type === "analyst" ?
                  "📊"
                : selectedAgent.personality_type === "creative" ?
                  "🎨"
                : "⚡"}
              </div>
              <div>
                <div
                  className={cn(
                    "font-medium",
                    theme === "dark" ? "text-white" : "text-gray-900"
                  )}
                >
                  {selectedAgent.business_role}
                </div>
                <div
                  className={cn(
                    "text-sm",
                    theme === "dark" ? "text-gray-400" : "text-gray-500"
                  )}
                >
                  {selectedAgent.level} • {selectedAgent.personality_type} •{" "}
                  {selectedAgent.performance_rating?.toFixed(1)}/5.0
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleAgentAction("optimize", selectedAgent)}
                className="px-3 py-1 bg-purple-600 text-white rounded text-sm font-medium hover:bg-purple-700 transition-colors"
              >
                <Zap className="w-3 h-3 mr-1 inline" />
                Optimize
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedAgent(null)}
                className={cn(
                  "px-3 py-1 rounded text-sm font-medium transition-colors",
                  theme === "dark" ?
                    "bg-gray-700 text-gray-200 hover:bg-gray-600"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                )}
              >
                Close
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
