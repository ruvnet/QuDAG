import { motion } from "framer-motion";
import { Construction, ArrowRight } from "lucide-react";
import { ScrollContainer } from "../ScrollContainer";

interface PlaceholderTabProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  features?: string[];
  quickActions?: Array<{
    label: string;
    description: string;
    icon: React.ReactNode;
    color: "blue" | "green" | "purple" | "orange" | "red";
    action: () => void;
  }>;
  onNotification?: (
    message: string,
    type: "info" | "success" | "warning" | "error"
  ) => void;
}

const colorClasses = {
  blue: "bg-blue-600 hover:bg-blue-700 text-white",
  green: "bg-green-600 hover:bg-green-700 text-white",
  purple: "bg-purple-600 hover:bg-purple-700 text-white",
  orange: "bg-orange-600 hover:bg-orange-700 text-white",
  red: "bg-red-600 hover:bg-red-700 text-white",
};

export function PlaceholderTab({
  title,
  description,
  icon,
  features = [],
  quickActions = [],
  onNotification,
}: PlaceholderTabProps) {
  const handleComingSoon = () => {
    onNotification?.(
      `${title} is coming soon! This feature is currently in development.`,
      "info"
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="h-full flex flex-col"
    >
      <ScrollContainer>
        <div className="p-6">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Header Section */}
            <div className="text-center space-y-6">
              {/* Icon */}
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, duration: 0.3 }}
                className="flex justify-center"
              >
                <div className="p-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl text-white shadow-lg">
                  <div className="w-16 h-16">{icon}</div>
                </div>
              </motion.div>

              {/* Title and Description */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.3 }}
                className="space-y-4"
              >
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
                  {title}
                </h1>
                <p className="text-xl text-gray-600 dark:text-gray-400 leading-relaxed max-w-2xl mx-auto">
                  {description}
                </p>
              </motion.div>

              {/* Coming Soon Badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, duration: 0.3 }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 rounded-full border border-yellow-200 dark:border-yellow-800"
              >
                <Construction className="w-4 h-4" />
                <span className="font-medium">Under Development</span>
              </motion.div>
            </div>

            {/* Quick Actions Section */}
            {quickActions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.3 }}
                className="space-y-6"
              >
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center">
                  Quick Actions
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {quickActions.map((action, index) => (
                    <motion.button
                      key={action.label}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + index * 0.1, duration: 0.3 }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={action.action}
                      className={`p-4 rounded-lg transition-all duration-200 text-left ${colorClasses[action.color]} shadow-lg hover:shadow-xl`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-6 h-6 mt-0.5">
                          {action.icon}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">
                            {action.label}
                          </h3>
                          <p className="text-sm opacity-90 mt-1">
                            {action.description}
                          </p>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Features List */}
            {features.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.3 }}
                className="space-y-6"
              >
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white text-center">
                  Coming Features
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {features.map((feature, index) => (
                    <motion.div
                      key={feature}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.8 + index * 0.1, duration: 0.3 }}
                      className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
                    >
                      <ArrowRight className="w-5 h-5 text-blue-500 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300 font-medium">
                        {feature}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Progress Section */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 0.3 }}
              className="space-y-6"
            >
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Development Progress
                    </h4>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      25%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "25%" }}
                      transition={{ delay: 1, duration: 1, ease: "easeOut" }}
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full"
                    />
                  </div>
                  <div className="flex justify-center">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleComingSoon}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-lg"
                    >
                      Get Notified When Ready
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Bottom padding for scroll */}
            <div className="h-6" />
          </div>
        </div>
      </ScrollContainer>
    </motion.div>
  );
}
