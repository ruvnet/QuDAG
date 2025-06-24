import { useEffect, useState, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  Settings,
  Activity,
  DollarSign,
  TrendingUp,
  Database,
  Shield,
  Zap,
  Sparkles,
} from "lucide-react";

import { useCockpit } from "./hooks/useCockpit";
import { useVoiceCommands } from "./hooks/useVoiceCommands";
import { Sidebar } from "./components/Sidebar";
import { TabBar } from "./components/TabBar";
import { ThemeToggle } from "./components/ThemeToggle";
import { NotificationToast } from "./components/NotificationToast";
import { CEOCommandBar } from "./components/CEOCommandBar";
import { DataDashboardTab } from "./components/tabs/DataDashboardTab";
import { OrganizationChartTab } from "./components/tabs/OrganizationChartTab";
import { PlaceholderTab } from "./components/tabs/PlaceholderTab";
import { cn } from "./lib/utils";
import { nlService } from "./services/NaturalLanguageService";
import { commandExecutor } from "./services/CommandExecutor";
import type { Tab, SidebarItem } from "./types";

// Create a client
const queryClient = new QueryClient();

function CockpitApp() {
  const {
    theme,
    tabs,
    activeTabId,
    sidebarCollapsed,
    notifications,
    toggleTheme,
    addTab,
    removeTab,
    setActiveTab,
    toggleSidebar,
    addNotification,
    removeNotification,
  } = useCockpit();

  // CEO Command Center State
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(true);

  // Helper function to convert (message, type) calls to {message, type} objects
  const notify = useCallback(
    (message: string, type: "info" | "success" | "warning" | "error") => {
      addNotification({ message, type });
    },
    [addNotification]
  );

  // CEO Command Handler
  const handleCEOCommand = useCallback(
    async (commandText: string) => {
      if (isExecutingCommand) return;

      try {
        setIsExecutingCommand(true);

        // Parse the natural language command
        const command = nlService.parseCommand(commandText);

        // Validate command
        const validation = nlService.validateCommand(command);
        if (!validation.valid) {
          notify(validation.reason || "Invalid command", "warning");
          return;
        }

        // Show confidence and intent to user
        if (command.confidence < 0.7) {
          notify(
            `I think you want to ${command.intent.action}. Let me try...`,
            "info"
          );
        }

        // Execute the command - organization ID should be passed from context/state
        const executionContext = {
          organizationId: "current-org", // TODO: Get from organization context
          onNotification: notify,
          onTabAdd: addTab,
        };

        const result = await commandExecutor.executeCommand(
          command,
          executionContext
        );

        if (result.success) {
          notify(result.message, "success");
        } else {
          notify(result.message, "error");
        }
      } catch (error) {
        console.error("Command execution failed:", error);
        notify(
          "Something went wrong executing your command. Please try again.",
          "error"
        );
      } finally {
        setIsExecutingCommand(false);
      }
    },
    [isExecutingCommand, notify, addTab]
  );

  // Voice Commands Integration
  const { isSupported: voiceSupported, enableWakeWordMode } = useVoiceCommands({
    onCommand: handleCEOCommand,
    onNotification: notify,
    enabled: true,
  });

  // Apply theme to document
  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  // Initialize with dashboard tab
  useEffect(() => {
    if (tabs.length === 0) {
      addTab({
        id: "dashboard",
        title: "Data Intelligence",
        icon: "home",
        render: (context) => <DataDashboardTab theme={context.theme} />,
        closable: false,
      });
    }
  }, [tabs.length, addTab]);

  const handleSidebarItemClick = (item: SidebarItem) => {
    const tabConfigs: Record<string, Omit<Tab, "action">> = {
      dashboard: {
        id: "dashboard",
        title: "Data Intelligence",
        icon: "home",
        render: (ctx) => <DataDashboardTab theme={ctx.theme} />,
        closable: false,
      },
      analytics: {
        id: "analytics",
        title: "Analytics",
        icon: "bar-chart-3",
        render: (ctx) => (
          <PlaceholderTab
            title="Analytics"
            description="Advanced analytics and insights for your autonomous enterprise"
            icon={<BarChart3 className="w-16 h-16" />}
            features={[
              "Predictive Revenue Forecasting",
              "Agent Performance Predictions",
              "Cost Optimization Recommendations",
              "Market Trend Analysis",
              "ROI Optimization Insights",
              "Custom Dashboard Builder",
            ]}
            quickActions={[
              {
                label: "Generate Report",
                description: "Create comprehensive analytics report",
                icon: <BarChart3 className="w-6 h-6" />,
                color: "blue" as const,
                action: () =>
                  ctx.onNotification(
                    "Analytics report generation started",
                    "info"
                  ),
              },
              {
                label: "View Insights",
                description: "Access AI-powered business insights",
                icon: <TrendingUp className="w-6 h-6" />,
                color: "green" as const,
                action: () =>
                  ctx.onNotification("Opening insights dashboard", "info"),
              },
            ]}
            onNotification={ctx.onNotification}
          />
        ),
      },
      agents: {
        id: "agents",
        title: "AI Workforce",
        icon: "users",
        render: (ctx) => (
          <OrganizationChartTab
            theme={ctx.theme}
            onNotification={ctx.onNotification}
          />
        ),
        closable: true,
      },
      revenue: {
        id: "revenue",
        title: "Revenue Streams",
        icon: "dollar-sign",
        render: (ctx) => (
          <PlaceholderTab
            title="Revenue Streams"
            description="Track and optimize your autonomous revenue generation"
            icon={<DollarSign className="w-16 h-16" />}
            features={[
              "Revenue Stream Analytics",
              "Automated Pricing Optimization",
              "Payment Processing Integration",
              "Revenue Forecasting Models",
              "Profit Margin Analysis",
              "Customer Lifetime Value",
            ]}
            quickActions={[
              {
                label: "Optimize Pricing",
                description: "AI-powered pricing optimization",
                icon: <DollarSign className="w-6 h-6" />,
                color: "green" as const,
                action: () =>
                  ctx.onNotification(
                    "Pricing optimization analysis started",
                    "info"
                  ),
              },
              {
                label: "View Reports",
                description: "Generate detailed revenue reports",
                icon: <BarChart3 className="w-6 h-6" />,
                color: "blue" as const,
                action: () =>
                  ctx.onNotification(
                    "Revenue report generation started",
                    "info"
                  ),
              },
            ]}
            onNotification={ctx.onNotification}
          />
        ),
      },
      performance: {
        id: "performance",
        title: "Performance",
        icon: "trending-up",
        render: (ctx) => (
          <PlaceholderTab
            title="Performance Monitoring"
            description="Real-time performance metrics and optimization tools"
            icon={<TrendingUp className="w-16 h-16" />}
            features={[
              "Real-time Performance Dashboards",
              "Automated Alert System",
              "Performance Benchmarking",
              "Resource Utilization Tracking",
              "Bottleneck Detection",
              "Performance Optimization AI",
            ]}
            quickActions={[
              {
                label: "Run Diagnostics",
                description: "Comprehensive system performance check",
                icon: <Activity className="w-6 h-6" />,
                color: "orange" as const,
                action: () =>
                  ctx.onNotification("Performance diagnostics started", "info"),
              },
              {
                label: "Optimize System",
                description: "Auto-optimize system performance",
                icon: <TrendingUp className="w-6 h-6" />,
                color: "green" as const,
                action: () =>
                  ctx.onNotification("System optimization initiated", "info"),
              },
            ]}
            onNotification={ctx.onNotification}
          />
        ),
      },
      operations: {
        id: "operations",
        title: "Operations",
        icon: "activity",
        render: (ctx) => (
          <PlaceholderTab
            title="Operations Center"
            description="Monitor and control your autonomous operations"
            icon={<Activity className="w-16 h-16" />}
            features={[
              "Task Queue Management",
              "Workflow Automation",
              "Error Handling & Recovery",
              "Operational Metrics",
              "Process Optimization",
              "Incident Response System",
            ]}
            quickActions={[
              {
                label: "Monitor Tasks",
                description: "View real-time task queue status",
                icon: <Activity className="w-6 h-6" />,
                color: "blue" as const,
                action: () =>
                  ctx.onNotification(
                    "Task monitoring dashboard opened",
                    "info"
                  ),
              },
              {
                label: "Emergency Stop",
                description: "Safely halt all operations",
                icon: <Shield className="w-6 h-6" />,
                color: "red" as const,
                action: () =>
                  ctx.onNotification(
                    "Emergency stop protocol activated",
                    "warning"
                  ),
              },
            ]}
            onNotification={ctx.onNotification}
          />
        ),
      },

      security: {
        id: "security",
        title: "Security",
        icon: "shield",
        render: (ctx) => (
          <PlaceholderTab
            title="Security Center"
            description="Protect your autonomous enterprise with advanced security"
            icon={<Shield className="w-16 h-16" />}
            features={[
              "Threat Detection & Response",
              "Access Control Management",
              "Security Audit Logs",
              "Vulnerability Scanning",
              "Compliance Monitoring",
              "Incident Response Automation",
            ]}
            quickActions={[
              {
                label: "Security Scan",
                description: "Run comprehensive security audit",
                icon: <Shield className="w-6 h-6" />,
                color: "orange" as const,
                action: () =>
                  ctx.onNotification("Security scan initiated", "info"),
              },
              {
                label: "Threat Analysis",
                description: "Analyze potential security threats",
                icon: <Activity className="w-6 h-6" />,
                color: "red" as const,
                action: () =>
                  ctx.onNotification("Threat analysis started", "info"),
              },
            ]}
            onNotification={ctx.onNotification}
          />
        ),
      },
      automation: {
        id: "automation",
        title: "Automation",
        icon: "zap",
        render: (ctx) => (
          <PlaceholderTab
            title="Automation Hub"
            description="Create and manage automated workflows and processes"
            icon={<Zap className="w-16 h-16" />}
            features={[
              "Workflow Designer",
              "Trigger Management",
              "Process Automation",
              "Integration Hub",
              "Automation Analytics",
              "Smart Scheduling",
            ]}
            quickActions={[
              {
                label: "Create Workflow",
                description: "Design new automated workflow",
                icon: <Zap className="w-6 h-6" />,
                color: "purple" as const,
                action: () =>
                  ctx.onNotification("Workflow designer opened", "info"),
              },
              {
                label: "Schedule Tasks",
                description: "Set up automated task scheduling",
                icon: <Settings className="w-6 h-6" />,
                color: "blue" as const,
                action: () =>
                  ctx.onNotification("Task scheduler opened", "info"),
              },
            ]}
            onNotification={ctx.onNotification}
          />
        ),
      },
      settings: {
        id: "settings",
        title: "Settings",
        icon: "settings",
        render: (ctx) => (
          <PlaceholderTab
            title="Settings"
            description="Configure your QuDAG Executive dashboard and preferences"
            icon={<Settings className="w-16 h-16" />}
            features={[
              "Dashboard Customization",
              "User Preferences",
              "API Configuration",
              "Notification Settings",
              "Theme & Appearance",
              "Data Export Options",
            ]}
            quickActions={[
              {
                label: "Customize Dashboard",
                description: "Personalize your dashboard layout",
                icon: <Settings className="w-6 h-6" />,
                color: "blue" as const,
                action: () =>
                  ctx.onNotification("Dashboard customization opened", "info"),
              },
              {
                label: "Export Data",
                description: "Export your data and configurations",
                icon: <Database className="w-6 h-6" />,
                color: "green" as const,
                action: () =>
                  ctx.onNotification("Data export wizard opened", "info"),
              },
            ]}
            onNotification={ctx.onNotification}
          />
        ),
      },
    };

    const tabConfig = tabConfigs[item.id];
    if (tabConfig) {
      addTab(tabConfig);
    }
  };

  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  const renderActiveTab = () => {
    if (!activeTab) return null;

    const context = {
      theme,
      onNotification: notify,
    };

    return activeTab.render(context);
  };

  return (
    <div
      className={cn(
        "h-screen overflow-hidden transition-colors duration-200",
        theme === "dark" ? "bg-gray-900" : "bg-gray-50"
      )}
    >
      {/* Notifications */}
      <NotificationToast
        notifications={notifications}
        onRemove={removeNotification}
        theme={theme}
      />

      {/* Welcome Message for First-Time Users */}
      <AnimatePresence>
        {showWelcomeMessage && tabs.length <= 1 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center p-4"
            onClick={() => setShowWelcomeMessage(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className={cn(
                "max-w-lg w-full rounded-2xl p-8 text-center",
                theme === "dark" ?
                  "bg-gray-800 border border-gray-700"
                : "bg-white border border-gray-200"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center mb-4">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="p-3 rounded-full bg-purple-100 dark:bg-purple-900"
                >
                  <Sparkles className="w-8 h-8 text-purple-600" />
                </motion.div>
              </div>

              <h2
                className={cn(
                  "text-2xl font-bold mb-3",
                  theme === "dark" ? "text-white" : "text-gray-900"
                )}
              >
                Welcome to Your AI-CEO Command Center! 🚀
              </h2>

              <p
                className={cn(
                  "text-lg mb-6",
                  theme === "dark" ? "text-gray-300" : "text-gray-600"
                )}
              >
                Running your business is now as simple as talking. Try saying:
              </p>

              <div className="space-y-3 mb-6">
                {[
                  "🎯 'Hire 5 sales agents for Q1'",
                  "📊 'Show me this month's metrics'",
                  "⚡ 'Optimize marketing costs'",
                  "🚀 'Generate board report'",
                ].map((example, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={cn(
                      "p-3 rounded-lg text-left",
                      theme === "dark" ? "bg-gray-700" : "bg-gray-50"
                    )}
                  >
                    <span
                      className={cn(
                        "font-medium",
                        theme === "dark" ? "text-gray-200" : "text-gray-800"
                      )}
                    >
                      {example}
                    </span>
                  </motion.div>
                ))}
              </div>

              <div className="flex gap-3 justify-center">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setShowWelcomeMessage(false);
                    notify(
                      "🎤 Try the command bar above or say 'Hey QuDAG' to get started!",
                      "info"
                    );
                  }}
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
                >
                  Let's Get Started!
                </motion.button>

                {voiceSupported && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setShowWelcomeMessage(false);
                      enableWakeWordMode();
                    }}
                    className={cn(
                      "px-6 py-3 rounded-lg font-medium transition-colors",
                      theme === "dark" ?
                        "bg-gray-700 text-gray-200 hover:bg-gray-600"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    )}
                  >
                    Enable Voice Mode
                  </motion.button>
                )}
              </div>

              <p
                className={cn(
                  "text-xs mt-4",
                  theme === "dark" ? "text-gray-500" : "text-gray-400"
                )}
              >
                Press Cmd+K or Ctrl+K anytime to access the command bar
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header
        className={cn(
          "border-b transition-colors duration-200 z-10 relative",
          theme === "dark" ?
            "bg-gray-800 border-gray-700"
          : "bg-white border-gray-200"
        )}
      >
        <div className="flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ rotate: isExecutingCommand ? 360 : 0 }}
                transition={{
                  duration: 1,
                  repeat: isExecutingCommand ? Infinity : 0,
                  ease: "linear",
                }}
              >
                <Sparkles className="w-6 h-6 text-purple-600" />
              </motion.div>
              <div>
                <h1
                  className={cn(
                    "text-xl font-bold",
                    theme === "dark" ? "text-white" : "text-gray-900"
                  )}
                >
                  QuDAG Executive AI-CEO
                </h1>
                <span
                  className={cn(
                    "text-sm",
                    theme === "dark" ? "text-gray-400" : "text-gray-500"
                  )}
                >
                  {isExecutingCommand ?
                    "🧠 AI is thinking..."
                  : "Voice-First Business Operating System"}
                </span>
              </div>
            </div>
          </div>

          {/* Integrated CEO Command Bar in Header */}
          <div className="flex-1 max-w-2xl mx-8">
            <CEOCommandBar
              theme={theme}
              onCommand={handleCEOCommand}
              onNotification={notify}
              isExecuting={isExecutingCommand}
            />
          </div>

          <div className="flex items-center gap-4">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar */}
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={toggleSidebar}
          onItemClick={handleSidebarItemClick}
          theme={theme}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab Bar */}
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onTabClick={setActiveTab}
            onTabClose={removeTab}
            theme={theme}
          />

          {/* Tab Content */}
          <div className="flex-1 min-h-0">
            <AnimatePresence mode="wait">
              {activeTab && (
                <motion.div
                  key={activeTabId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                  className="h-full"
                >
                  {renderActiveTab()}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CockpitApp />
    </QueryClientProvider>
  );
}

export default App;
