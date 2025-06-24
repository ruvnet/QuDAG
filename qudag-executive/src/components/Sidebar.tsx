import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  BarChart3,
  Users,
  Settings,
  Activity,
  DollarSign,
  TrendingUp,
  Database,
  Shield,
  Zap,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "../lib/utils";
import type { SidebarItem } from "../types";

// Icon mapping for theme-aware rendering
const iconMap = {
  home: Home,
  "bar-chart-3": BarChart3,
  users: Users,
  settings: Settings,
  activity: Activity,
  "dollar-sign": DollarSign,
  "trending-up": TrendingUp,
  database: Database,
  shield: Shield,
  zap: Zap,
};

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onItemClick: (item: SidebarItem) => void;
  theme: "light" | "dark";
}

export function Sidebar({
  collapsed,
  onToggle,
  onItemClick,
  theme,
}: SidebarProps) {
  const sidebarItems: Array<{
    id: string;
    label: string;
    icon: keyof typeof iconMap;
    badge?: string;
    disabled?: boolean;
  }> = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: "home",
    },
    {
      id: "analytics",
      label: "Analytics",
      icon: "bar-chart-3",
    },
    {
      id: "agents",
      label: "Agent Management",
      icon: "users",
      badge: "24",
    },
    {
      id: "revenue",
      label: "Revenue Streams",
      icon: "dollar-sign",
    },
    {
      id: "performance",
      label: "Performance",
      icon: "trending-up",
    },
    {
      id: "operations",
      label: "Operations",
      icon: "activity",
      badge: "15.8K",
    },

    {
      id: "security",
      label: "Security",
      icon: "shield",
    },
    {
      id: "automation",
      label: "Automation",
      icon: "zap",
    },
    {
      id: "settings",
      label: "Settings",
      icon: "settings",
    },
  ];

  const renderIcon = (iconName: keyof typeof iconMap) => {
    const IconComponent = iconMap[iconName];
    return <IconComponent className="w-5 h-5" />;
  };

  const handleItemClick = (item: (typeof sidebarItems)[0]) => {
    onItemClick({
      id: item.id,
      label: item.label,
      icon: renderIcon(item.icon),
      action: () => {},
      badge: item.badge,
      disabled: item.disabled,
    });
  };

  return (
    <motion.div
      initial={false}
      animate={{
        width: collapsed ? 64 : 240,
      }}
      transition={{
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1],
      }}
      className={cn(
        "flex flex-col border-r transition-colors duration-200",
        theme === "dark" ?
          "bg-gray-900 border-gray-800"
        : "bg-white border-gray-200"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-inherit">
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "font-bold text-lg",
                theme === "dark" ? "text-white" : "text-gray-900"
              )}
            >
              QuDAG
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={onToggle}
          className={cn(
            "p-2 rounded-lg transition-colors",
            theme === "dark" ?
              "hover:bg-gray-800 text-gray-400 hover:text-white"
            : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"
          )}
        >
          {collapsed ?
            <ChevronRight className="w-4 h-4" />
          : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-2 space-y-1">
        {sidebarItems.map((item) => (
          <motion.button
            key={item.id}
            onClick={() => handleItemClick(item)}
            disabled={item.disabled}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
              "group relative",
              theme === "dark" ?
                "text-gray-300 hover:text-white hover:bg-gray-800"
              : "text-gray-700 hover:text-gray-900 hover:bg-gray-100",
              item.disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <div className="flex-shrink-0">{renderIcon(item.icon)}</div>

            <AnimatePresence mode="wait">
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex-1 text-left font-medium"
                >
                  {item.label}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Badge */}
            {item.badge && (
              <AnimatePresence mode="wait">
                {!collapsed && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      "px-2 py-0.5 text-xs font-medium rounded-full",
                      theme === "dark" ?
                        "bg-blue-900 text-blue-200"
                      : "bg-blue-100 text-blue-800"
                    )}
                  >
                    {item.badge}
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            {/* Tooltip for collapsed state */}
            {collapsed && (
              <div
                className={cn(
                  "absolute left-full ml-2 px-2 py-1 text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50",
                  theme === "dark" ?
                    "bg-gray-800 text-white border border-gray-700"
                  : "bg-gray-900 text-white"
                )}
              >
                {item.label}
                {item.badge && (
                  <span className="ml-2 px-1.5 py-0.5 bg-blue-600 text-xs rounded">
                    {item.badge}
                  </span>
                )}
              </div>
            )}
          </motion.button>
        ))}
      </nav>
    </motion.div>
  );
}
