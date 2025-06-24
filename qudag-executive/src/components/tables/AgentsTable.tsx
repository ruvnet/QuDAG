/**
 * @description Agent profiles data table with real API integration
 * @author CleoClaudeDesktop
 * @created 2025-06-23
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Real agent data table
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  User, 
  Crown, 
  Users, 
  Wrench, 
  Lightbulb,
  Target,
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Settings
} from 'lucide-react';
import { DataTable } from '../DataTable';
import type { Column } from '../DataTable';
import { apiService } from '../../services/api';
import type { AgentProfile } from '../../services/api';
import { cn } from '../../lib/utils';

interface AgentsTableProps {
  organizationId?: string;
  theme?: 'light' | 'dark';
}

const levelIcons = {
  executive: Crown,
  manager: Users,
  specialist: Target,
  operator: Wrench,
};

const personalityIcons = {
  hunter: Target,
  farmer: Activity,
  analyst: Lightbulb,
  creative: Lightbulb,
  executor: CheckCircle,
};

const statusColors = {
  active: 'text-green-500',
  idle: 'text-yellow-500',
  error: 'text-red-500',
  maintenance: 'text-blue-500',
  retired: 'text-gray-500',
};

const statusIcons = {
  active: CheckCircle,
  idle: Clock,
  error: AlertCircle,
  maintenance: Settings,
  retired: Activity,
};

export function AgentsTable({ organizationId, theme = 'light' }: AgentsTableProps) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['agents', organizationId, page, search, sortKey, sortDirection],
    queryFn: async () => {
      console.log('AgentsTable: Fetching agents with organizationId:', organizationId);
      const result = await apiService.agents.list(organizationId, page, 10);
      console.log('AgentsTable: API Response:', result);
      return result;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const columns: Column<AgentProfile>[] = [
    {
      key: 'agent_id',
      title: 'Agent ID',
      sortable: true,
      width: '150px',
      render: (value) => (
        <span className="font-mono text-sm">{value?.slice(0, 8)}...</span>
      ),
    },
    {
      key: 'business_role',
      title: 'Role',
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-blue-500" />
          <div>
            <div className="font-medium">{value}</div>
            {row.title && (
              <div className={cn(
                'text-xs',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              )}>
                {row.title}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'level',
      title: 'Level',
      sortable: true,
      render: (value) => {
        const Icon = levelIcons[value as keyof typeof levelIcons] || User;
        return (
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-purple-500" />
            <span className="capitalize">{value}</span>
          </div>
        );
      },
    },
    {
      key: 'personality_type',
      title: 'Personality',
      sortable: true,
      render: (value) => {
        const Icon = personalityIcons[value as keyof typeof personalityIcons] || User;
        return (
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-indigo-500" />
            <span className="capitalize">{value}</span>
          </div>
        );
      },
    },
    {
      key: 'status',
      title: 'Status',
      sortable: true,
      render: (value) => {
        const Icon = statusIcons[value as keyof typeof statusIcons] || Activity;
        const colorClass = statusColors[value as keyof typeof statusColors] || 'text-gray-500';
        return (
          <div className="flex items-center gap-2">
            <Icon className={cn('w-4 h-4', colorClass)} />
            <span className="capitalize">{value}</span>
          </div>
        );
      },
    },
    {
      key: 'performance_rating',
      title: 'Rating',
      sortable: true,
      render: (value) => (
        <div className="flex items-center gap-2">
          <div className="flex">
            {[1, 2, 3, 4, 5].map((star) => (
              <div
                key={star}
                className={cn(
                  'w-3 h-3 rounded-full mr-1',
                  star <= Math.round(value)
                    ? 'bg-yellow-400'
                    : theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'
                )}
              />
            ))}
          </div>
          <span className="text-sm font-medium">{value?.toFixed(1)}</span>
        </div>
      ),
    },
    {
      key: 'cost_per_hour',
      title: 'Cost/Hour',
      sortable: true,
      render: (value) => (
        <span className="font-medium text-green-600">
          ${typeof value === 'number' ? value.toFixed(2) : '0.00'}
        </span>
      ),
    },
    {
      key: 'personality_traits',
      title: 'Traits',
      render: (value) => (
        <div className="space-y-1">
          {value && Object.entries(value).map(([trait, score]) => (
            <div key={trait} className="flex items-center gap-2 text-xs">
              <span className="w-12 capitalize">{trait.slice(0, 4)}</span>
              <div className={cn(
                'w-16 h-2 rounded-full',
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
              )}>
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${(score as number) || 0}%` }}
                />
              </div>
              <span className="text-xs">{score}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'last_active',
      title: 'Last Active',
      sortable: true,
      render: (value) => (
        <span className="text-sm">
          {value ? new Date(value).toLocaleDateString() : 'Never'}
        </span>
      ),
    },
  ];

  const handleSort = (key: string, direction: 'asc' | 'desc') => {
    setSortKey(key);
    setSortDirection(direction);
  };

  const handleExport = () => {
    // Create CSV export
    const csvData = data?.data || [];
    const csv = [
      columns.map(col => col.title).join(','),
      ...csvData.map(row => 
        columns.map(col => {
          const value = col.key.includes('.') 
            ? col.key.split('.').reduce((obj: Record<string, unknown>, k) => obj?.[k] as Record<string, unknown>, row as Record<string, unknown>)
            : row[col.key as keyof AgentProfile];
          return typeof value === 'object' ? JSON.stringify(value) : value;
        }).join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agents-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  console.log('AgentsTable render:', {
    isLoading,
    error: error?.message,
    dataReceived: data,
    dataArray: data?.data,
    dataLength: data?.data?.length,
    pagination: data?.pagination
  });

  return (
    <DataTable
      data={data?.data || []}
      columns={columns}
      loading={isLoading}
      error={error?.message}
      title="AI Agent Workforce"
      description="Monitor and manage your autonomous AI agents"
      searchValue={search}
      onSearchChange={setSearch}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={handleSort}
      pagination={data?.pagination}
      onPageChange={setPage}
      onRefresh={() => refetch()}
      onExport={handleExport}
      theme={theme}
    />
  );
}