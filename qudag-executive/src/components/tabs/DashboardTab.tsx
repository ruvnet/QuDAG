import { motion } from "framer-motion";
import { DollarSign, TrendingUp, Users, Activity } from "lucide-react";
import { MetricCard } from "../MetricCard";
import { RevenueChart } from "../RevenueChart";
import { AgentTable } from "../AgentTable";
import { ScrollContainer } from "../ScrollContainer";
import { formatCurrency, formatNumber, getTrend } from "../../lib/utils";

// Mock data - same as original App.tsx
const mockMetrics = {
  revenue: {
    current: 248500,
    previous: 198200,
    growth: 0.254,
    currency: "rUv",
  },
  agents: {
    total: 24,
    active: 19,
    efficiency: 0.92,
  },
  operations: {
    totalTasks: 15842,
    completedTasks: 14698,
    successRate: 0.928,
    avgCompletionTime: 142,
  },
  costs: {
    compute: 42300,
    storage: 8900,
    network: 12400,
    total: 63600,
  },
};

const mockRevenueData = [
  { date: "Jan 1", revenue: 182000, costs: 58000, profit: 124000 },
  { date: "Jan 8", revenue: 195000, costs: 61000, profit: 134000 },
  { date: "Jan 15", revenue: 208000, costs: 62000, profit: 146000 },
  { date: "Jan 22", revenue: 224000, costs: 63000, profit: 161000 },
  { date: "Jan 29", revenue: 248500, costs: 63600, profit: 184900 },
];

const mockAgents = [
  {
    id: "1",
    name: "Sales Bot Alpha",
    type: "Sales Automation",
    tasksCompleted: 3421,
    successRate: 0.96,
    revenueGenerated: 89400,
    costIncurred: 12300,
    roi: 6.27,
    status: "active" as const,
  },
  {
    id: "2",
    name: "Support Agent Beta",
    type: "Customer Service",
    tasksCompleted: 5832,
    successRate: 0.91,
    revenueGenerated: 45200,
    costIncurred: 8900,
    roi: 4.08,
    status: "active" as const,
  },
  {
    id: "3",
    name: "Research Swarm Gamma",
    type: "Data Analysis",
    tasksCompleted: 1247,
    successRate: 0.88,
    revenueGenerated: 67300,
    costIncurred: 18700,
    roi: 2.6,
    status: "idle" as const,
  },
  {
    id: "4",
    name: "Content Creator Delta",
    type: "Content Generation",
    tasksCompleted: 892,
    successRate: 0.94,
    revenueGenerated: 34100,
    costIncurred: 6400,
    roi: 4.33,
    status: "active" as const,
  },
];

interface DashboardTabProps {
  theme?: "light" | "dark";
}

export function DashboardTab({ theme = "light" }: DashboardTabProps) {
  const profit = mockMetrics.revenue.current - mockMetrics.costs.total;
  const profitMargin = profit / mockMetrics.revenue.current;
  const revenueTrend = getTrend(
    mockMetrics.revenue.current,
    mockMetrics.revenue.previous
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="h-full flex flex-col"
    >
      <ScrollContainer theme={theme}>
        <div className="p-6 md:p-8 lg:p-12 xl:p-16 2xl:p-20 3xl:p-24 4xl:p-28 5xl:p-32 space-y-6">
          {/* Top KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Total Revenue"
              value={formatCurrency(mockMetrics.revenue.current)}
              change={mockMetrics.revenue.growth}
              trend={revenueTrend}
              subtitle="vs last period"
              icon={<DollarSign className="w-6 h-6 text-gray-600" />}
            />

            <MetricCard
              title="Net Profit"
              value={formatCurrency(profit)}
              change={profitMargin}
              trend="up"
              subtitle={`${(profitMargin * 100).toFixed(1)}% margin`}
              icon={<TrendingUp className="w-6 h-6 text-gray-600" />}
            />

            <MetricCard
              title="Active Agents"
              value={`${mockMetrics.agents.active}/${mockMetrics.agents.total}`}
              change={mockMetrics.agents.efficiency}
              trend="neutral"
              subtitle={`${(mockMetrics.agents.efficiency * 100).toFixed(0)}% efficiency`}
              icon={<Users className="w-6 h-6 text-gray-600" />}
            />

            <MetricCard
              title="Operations"
              value={formatNumber(mockMetrics.operations.completedTasks)}
              change={mockMetrics.operations.successRate}
              trend="up"
              subtitle="completed tasks"
              icon={<Activity className="w-6 h-6 text-gray-600" />}
            />
          </div>

          {/* Revenue Chart */}
          <div>
            <RevenueChart data={mockRevenueData} />
          </div>

          {/* Cost Breakdown and Agent Table */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <AgentTable agents={mockAgents} />
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Cost Breakdown
              </h3>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      Compute
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(mockMetrics.costs.compute)}
                    </span>
                  </div>
                  <div className="mt-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{
                        width: `${(mockMetrics.costs.compute / mockMetrics.costs.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      Storage
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(mockMetrics.costs.storage)}
                    </span>
                  </div>
                  <div className="mt-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{
                        width: `${(mockMetrics.costs.storage / mockMetrics.costs.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      Network
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(mockMetrics.costs.network)}
                    </span>
                  </div>
                  <div className="mt-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-purple-500 h-2 rounded-full"
                      style={{
                        width: `${(mockMetrics.costs.network / mockMetrics.costs.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      Total Costs
                    </span>
                    <span className="text-lg font-bold text-gray-900 dark:text-white">
                      {formatCurrency(mockMetrics.costs.total)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom padding for scroll */}
          <div className="h-6" />
        </div>
      </ScrollContainer>
    </motion.div>
  );
}
