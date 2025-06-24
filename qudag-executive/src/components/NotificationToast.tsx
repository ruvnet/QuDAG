import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "../lib/utils";
import type { Notification } from "../types";

interface NotificationToastProps {
  notifications: Notification[];
  onRemove: (id: string) => void;
  theme?: "light" | "dark";
}

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap = {
  success: {
    light: "bg-green-50 border-green-200 text-green-800",
    dark: "bg-green-900/20 border-green-800 text-green-200",
    icon: "text-green-500",
  },
  error: {
    light: "bg-red-50 border-red-200 text-red-800",
    dark: "bg-red-900/20 border-red-800 text-red-200",
    icon: "text-red-500",
  },
  warning: {
    light: "bg-yellow-50 border-yellow-200 text-yellow-800",
    dark: "bg-yellow-900/20 border-yellow-800 text-yellow-200",
    icon: "text-yellow-500",
  },
  info: {
    light: "bg-blue-50 border-blue-200 text-blue-800",
    dark: "bg-blue-900/20 border-blue-800 text-blue-200",
    icon: "text-blue-500",
  },
};

export function NotificationToast({
  notifications,
  onRemove,
  theme,
}: NotificationToastProps) {
  // Defensive check for theme - fallback to 'light' if undefined
  const safeTheme = theme || "light";

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      <AnimatePresence mode="popLayout">
        {notifications.map((notification) => {
          const Icon = iconMap[notification.type];
          const colors = colorMap[notification.type];

          return (
            <motion.div
              key={notification.id}
              layout
              initial={{ opacity: 0, x: 300, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 300, scale: 0.9 }}
              transition={{
                duration: 0.3,
                ease: [0.4, 0, 0.2, 1],
              }}
              className={cn(
                "flex items-start gap-3 p-4 rounded-lg border shadow-lg backdrop-blur-sm",
                colors[safeTheme]
              )}
            >
              {/* Icon */}
              <div className={cn("flex-shrink-0 mt-0.5", colors.icon)}>
                <Icon className="w-5 h-5" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-5">
                  {notification.message}
                </p>
                <p className="text-xs opacity-75 mt-1">
                  {new Date(notification.timestamp).toLocaleTimeString()}
                </p>
              </div>

              {/* Close Button */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => onRemove(notification.id)}
                className={cn(
                  "flex-shrink-0 p-1 rounded-full transition-colors",
                  safeTheme === "dark" ?
                    "hover:bg-gray-700 text-gray-400 hover:text-white"
                  : "hover:bg-gray-200 text-gray-500 hover:text-gray-700"
                )}
              >
                <X className="w-4 h-4" />
              </motion.button>

              {/* Progress bar for auto-close */}
              {notification.autoClose !== false && (
                <motion.div
                  initial={{ scaleX: 1 }}
                  animate={{ scaleX: 0 }}
                  transition={{ duration: 4, ease: "linear" }}
                  className={cn(
                    "absolute bottom-0 left-0 h-1 rounded-b-lg origin-left",
                    colors.icon
                  )}
                  style={{ width: "100%" }}
                />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
