import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  DollarSign,
  TrendingUp,
  Users,
  Activity,
  Settings,
  LogOut,
} from "lucide-react";
import { MetricCard } from "./components/MetricCard";
import { RevenueChart } from "./components/RevenueChart";
import { AgentTable } from "./components/AgentTable";
import { formatCurrency, formatNumber, getTrend } from "./lib/utils";

// Create a client
const queryClient = new QueryClient();

// Mock data - replace with real API calls
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

function Dashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState("7d");
  const [notification, setNotification] = useState<{
    message: string;
    type: "info" | "success";
  } | null>(null);

  const profit = mockMetrics.revenue.current - mockMetrics.costs.total;
  const profitMargin = profit / mockMetrics.revenue.current;
  const revenueTrend = getTrend(
    mockMetrics.revenue.current,
    mockMetrics.revenue.previous
  );

  const handleQuickAction = (action: string) => {
    setNotification({
      message: `${action} - This would open a wizard to guide you through the process`,
      type: "info",
    });
    setTimeout(() => setNotification(null), 4000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${
            notification.type === "success" ? "bg-green-500" : "bg-blue-500"
          } text-white max-w-md`}
        >
          {notification.message}
        </div>
      )}

      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">
                QuDAG Executive
              </h1>
              <span className="ml-3 text-sm text-gray-500">
                Zero Person Enterprise Dashboard
              </span>
            </div>

            <div className="flex items-center gap-4">
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="text-sm border-gray-300 rounded-md"
              >
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </select>

              <button className="p-2 text-gray-400 hover:text-gray-500">
                <Settings className="w-5 h-5" />
              </button>

              <button className="p-2 text-gray-400 hover:text-gray-500">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
        <div className="mb-8">
          <RevenueChart data={mockRevenueData} />
        </div>

        {/* Cost Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <AgentTable agents={mockAgents} />
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Cost Breakdown
            </h3>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Compute</span>
                  <span className="font-medium">
                    {formatCurrency(mockMetrics.costs.compute)}
                  </span>
                </div>
                <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
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
                  <span className="text-gray-600">Storage</span>
                  <span className="font-medium">
                    {formatCurrency(mockMetrics.costs.storage)}
                  </span>
                </div>
                <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
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
                  <span className="text-gray-600">Network</span>
                  <span className="font-medium">
                    {formatCurrency(mockMetrics.costs.network)}
                  </span>
                </div>
                <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-purple-500 h-2 rounded-full"
                    style={{
                      width: `${(mockMetrics.costs.network / mockMetrics.costs.total) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-900">
                    Total Costs
                  </span>
                  <span className="text-lg font-bold text-gray-900">
                    {formatCurrency(mockMetrics.costs.total)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Quick Actions
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => handleQuickAction("Deploy New Agent")}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Deploy New Agent
            </button>
            <button
              onClick={() => handleQuickAction("Scale Operations")}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Scale Operations
            </button>
            <button
              onClick={() => handleQuickAction("Optimize Costs")}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Optimize Costs
            </button>
            <button
              onClick={() => handleQuickAction("View Reports")}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              View Reports
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  );
}

export default App;
