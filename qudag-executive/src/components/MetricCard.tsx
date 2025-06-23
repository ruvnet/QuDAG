import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn, formatPercentage } from "../lib/utils";

interface MetricCardProps {
  title: string;
  value: string;
  change?: number;
  trend?: "up" | "down" | "neutral";
  subtitle?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function MetricCard({
  title,
  value,
  change,
  trend,
  subtitle,
  icon,
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-lg shadow-sm border border-gray-200 p-6",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>

          {(change !== undefined || subtitle) && (
            <div className="flex items-center gap-2 mt-2">
              {change !== undefined && (
                <span
                  className={cn(
                    "flex items-center text-sm font-medium",
                    trend === "up" && "text-green-600",
                    trend === "down" && "text-red-600",
                    trend === "neutral" && "text-gray-500"
                  )}
                >
                  {trend === "up" && <TrendingUp className="w-4 h-4 mr-1" />}
                  {trend === "down" && (
                    <TrendingDown className="w-4 h-4 mr-1" />
                  )}
                  {trend === "neutral" && <Minus className="w-4 h-4 mr-1" />}
                  {formatPercentage(Math.abs(change))}
                </span>
              )}
              {subtitle && (
                <span className="text-sm text-gray-500">{subtitle}</span>
              )}
            </div>
          )}
        </div>

        {icon && (
          <div className="flex-shrink-0 ml-4">
            <div className="p-3 bg-gray-50 rounded-lg">{icon}</div>
          </div>
        )}
      </div>
    </div>
  );
}
