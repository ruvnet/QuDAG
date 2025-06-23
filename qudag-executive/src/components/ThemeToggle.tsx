import { motion } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { cn } from "../lib/utils";

interface ThemeToggleProps {
  theme: "light" | "dark";
  onToggle: () => void;
  className?: string;
}

export function ThemeToggle({ theme, onToggle, className }: ThemeToggleProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onToggle}
      className={cn(
        "relative p-2 rounded-lg transition-colors duration-200",
        theme === "dark" ?
          "bg-gray-800 text-yellow-400 hover:bg-gray-700"
        : "bg-gray-100 text-gray-600 hover:bg-gray-200",
        className
      )}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      <div className="relative w-5 h-5">
        <motion.div
          initial={false}
          animate={{
            scale: theme === "light" ? 1 : 0,
            rotate: theme === "light" ? 0 : 180,
          }}
          transition={{
            duration: 0.3,
            ease: [0.4, 0, 0.2, 1],
          }}
          className="absolute inset-0"
        >
          <Sun className="w-5 h-5" />
        </motion.div>

        <motion.div
          initial={false}
          animate={{
            scale: theme === "dark" ? 1 : 0,
            rotate: theme === "dark" ? 0 : -180,
          }}
          transition={{
            duration: 0.3,
            ease: [0.4, 0, 0.2, 1],
          }}
          className="absolute inset-0"
        >
          <Moon className="w-5 h-5" />
        </motion.div>
      </div>
    </motion.button>
  );
}
