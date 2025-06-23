import { Activity, DollarSign, TrendingUp, AlertCircle } from "lucide-react";
import { formatCurrency, formatPercentage } from "../lib/utils";
import type { AgentPerformance } from "../lib/api";

interface AgentTableProps {
  agents: AgentPerformance[];
}

export function AgentTable({ agents }: AgentTableProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">
          Agent Performance
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Agent
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tasks
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Success Rate
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Revenue
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cost
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                ROI
              </th>
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-200">
            {agents.map((agent) => (
              <tr key={agent.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                      <Activity className="h-5 w-5 text-gray-600" />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {agent.name}
                      </div>
                      <div className="text-sm text-gray-500">{agent.type}</div>
                    </div>
                  </div>
                </td>

                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      agent.status === "active" ? "bg-green-100 text-green-800"
                      : agent.status === "idle" ?
                        "bg-yellow-100 text-yellow-800"
                      : "bg-red-100 text-red-800"
                    }`}
                  >
                    {agent.status === "error" && (
                      <AlertCircle className="w-3 h-3 mr-1" />
                    )}
                    {agent.status}
                  </span>
                </td>

                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                  {agent.tasksCompleted.toLocaleString()}
                </td>

                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <span
                    className={`font-medium ${
                      agent.successRate >= 0.95 ? "text-green-600"
                      : agent.successRate >= 0.85 ? "text-yellow-600"
                      : "text-red-600"
                    }`}
                  >
                    {formatPercentage(agent.successRate)}
                  </span>
                </td>

                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                  <div className="flex items-center justify-end">
                    <DollarSign className="w-4 h-4 text-gray-400 mr-1" />
                    {formatCurrency(agent.revenueGenerated)}
                  </div>
                </td>

                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                  {formatCurrency(agent.costIncurred)}
                </td>

                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <div className="flex items-center justify-end">
                    <TrendingUp
                      className={`w-4 h-4 mr-1 ${
                        agent.roi > 0 ? "text-green-500" : "text-red-500"
                      }`}
                    />
                    <span
                      className={`font-medium ${
                        agent.roi > 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {formatPercentage(agent.roi)}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
