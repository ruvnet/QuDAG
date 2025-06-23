import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Plus,
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
} from "lucide-react";
import { cn } from "../lib/utils";
import type { Tab } from "../types";

// Icon mapping for string-based icons
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

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onNewTab?: () => void;
  theme: "light" | "dark";
}

export function TabBar({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onNewTab,
  theme,
}: TabBarProps) {
  if (tabs.length === 0) {
    return null;
  }

  const renderIcon = (iconName: string) => {
    const IconComponent = iconMap[iconName as keyof typeof iconMap];
    return IconComponent ?
        <IconComponent className="w-4 h-4" />
      : <Home className="w-4 h-4" />;
  };

  return (
    <div
      className={cn(
        "flex items-center border-b transition-colors duration-200",
        theme === "dark" ?
          "bg-gray-800 border-gray-700"
        : "bg-gray-50 border-gray-200"
      )}
    >
      {/* Tabs Container */}
      <div className="flex-1 flex items-center overflow-x-auto scrollbar-hide">
        <AnimatePresence mode="popLayout">
          {tabs.map((tab) => (
            <motion.div
              key={tab.id}
              layout
              initial={{ opacity: 0, x: 20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -20, scale: 0.9 }}
              transition={{
                duration: 0.2,
                ease: [0.4, 0, 0.2, 1],
              }}
              className="flex-shrink-0"
            >
              <div
                className={cn(
                  "group relative flex items-center gap-2 px-4 py-2.5 border-r cursor-pointer transition-all duration-200",
                  "min-w-[120px] max-w-[200px]",
                  activeTabId === tab.id ?
                    theme === "dark" ?
                      "bg-gray-900 text-white border-gray-600"
                    : "bg-white text-gray-900 border-gray-300"
                  : theme === "dark" ?
                    "bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border-gray-700"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900 border-gray-200"
                )}
                onClick={() => onTabClick(tab.id)}
              >
                {/* Active Tab Indicator */}
                {activeTabId === tab.id && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className={cn(
                      "absolute bottom-0 left-0 right-0 h-0.5",
                      theme === "dark" ? "bg-blue-400" : "bg-blue-500"
                    )}
                    transition={{
                      duration: 0.3,
                      ease: [0.4, 0, 0.2, 1],
                    }}
                  />
                )}

                {/* Tab Icon */}
                <div className="flex-shrink-0 w-4 h-4">
                  {renderIcon(tab.icon)}
                </div>

                {/* Tab Title */}
                <div className="flex-1 truncate text-sm font-medium">
                  {tab.title}
                </div>

                {/* Close Button */}
                {tab.closable !== false && (
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTabClose(tab.id);
                    }}
                    className={cn(
                      "flex-shrink-0 p-1 rounded-full transition-colors opacity-0 group-hover:opacity-100",
                      theme === "dark" ?
                        "hover:bg-gray-600 text-gray-400 hover:text-white"
                      : "hover:bg-gray-200 text-gray-500 hover:text-gray-700"
                    )}
                  >
                    <X className="w-3 h-3" />
                  </motion.button>
                )}

                {/* Loading indicator for active tab */}
                {activeTabId === tab.id && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 pointer-events-none"
                  >
                    <div
                      className={cn(
                        "absolute top-0 left-0 h-0.5 bg-gradient-to-r animate-pulse",
                        theme === "dark" ?
                          "from-blue-400 to-purple-400"
                        : "from-blue-500 to-purple-500"
                      )}
                      style={{
                        width: "100%",
                        animationDuration: "2s",
                      }}
                    />
                  </motion.div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* New Tab Button */}
      {onNewTab && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onNewTab}
          className={cn(
            "flex-shrink-0 p-2 m-1 rounded-lg transition-colors",
            theme === "dark" ?
              "text-gray-400 hover:text-white hover:bg-gray-700"
            : "text-gray-500 hover:text-gray-700 hover:bg-gray-200"
          )}
        >
          <Plus className="w-4 h-4" />
        </motion.button>
      )}

      {/* Tab Actions */}
      <div className="flex-shrink-0 flex items-center gap-1 px-2">
        {/* Tab count indicator */}
        <div
          className={cn(
            "px-2 py-1 text-xs font-medium rounded-full",
            theme === "dark" ?
              "bg-gray-700 text-gray-300"
            : "bg-gray-200 text-gray-600"
          )}
        >
          {tabs.length}
        </div>
      </div>
    </div>
  );
}
