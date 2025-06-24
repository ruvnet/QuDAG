/**
 * @description Projects data table with real API integration  
 * @author CleoClaudeDesktop
 * @created 2025-06-23
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Real projects data table
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Folder, 
  Play, 
  Pause, 
  CheckCircle, 
  XCircle,
  Clock,
  Users,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { DataTable } from '../DataTable';
import type { Column } from '../DataTable';
import { apiService } from '../../services/api';
import type { Project } from '../../services/api';
import { cn } from '../../lib/utils';

interface ProjectsTableProps {
  organizationId?: string;
  status?: string;
  theme?: 'light' | 'dark';
}

const statusIcons = {
  planning: Clock,
  active: Play,
  paused: Pause,
  completed: CheckCircle,
  cancelled: XCircle,
};

const statusColors = {
  planning: 'text-blue-500 bg-blue-50 border-blue-200',
  active: 'text-green-500 bg-green-50 border-green-200',
  paused: 'text-yellow-500 bg-yellow-50 border-yellow-200',
  completed: 'text-emerald-500 bg-emerald-50 border-emerald-200',
  cancelled: 'text-red-500 bg-red-50 border-red-200',
};

const statusColorsDark = {
  planning: 'text-blue-400 bg-blue-900/20 border-blue-800',
  active: 'text-green-400 bg-green-900/20 border-green-800',
  paused: 'text-yellow-400 bg-yellow-900/20 border-yellow-800',
  completed: 'text-emerald-400 bg-emerald-900/20 border-emerald-800',
  cancelled: 'text-red-400 bg-red-900/20 border-red-800',
};

export function ProjectsTable({ organizationId, status, theme = 'light' }: ProjectsTableProps) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['projects', organizationId, status, page, search, sortKey, sortDirection],
    queryFn: () => apiService.projects.list(organizationId, status, page, 10),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getProgressPercentage = (project: Project) => {
    if (project.status === 'completed') return 100;
    if (project.status === 'cancelled') return 0;
    
    const total = project.budget_allocated;
    const spent = project.budget_spent;
    return total > 0 ? Math.min((spent / total) * 100, 100) : 0;
  };

  const getDaysRemaining = (targetDate?: string) => {
    if (!targetDate) return null;
    const target = new Date(targetDate);
    const today = new Date();
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const columns: Column<Project>[] = [
    {
      key: 'name',
      title: 'Project',
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <div className={cn(
            'p-2 rounded-lg',
            theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
          )}>
            <Folder className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <div className="font-medium">{value}</div>
            {row.description && (
              <div className={cn(
                'text-sm truncate max-w-xs',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              )}>
                {row.description}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      title: 'Status',
      sortable: true,
      render: (value) => {
        const Icon = statusIcons[value as keyof typeof statusIcons] || Clock;
        const colorClasses = theme === 'dark' 
          ? statusColorsDark[value as keyof typeof statusColorsDark]
          : statusColors[value as keyof typeof statusColors];
        
        return (
          <div className={cn(
            'inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border',
            colorClasses
          )}>
            <Icon className="w-3 h-3" />
            <span className="capitalize">{value}</span>
          </div>
        );
      },
    },
    {
      key: 'budget_allocated',
      title: 'Budget',
      sortable: true,
      render: (value, row) => (
        <div>
          <div className="font-medium text-green-600">
            {formatCurrency(value)}
          </div>
          <div className={cn(
            'text-xs',
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          )}>
            Spent: {formatCurrency(row.budget_spent)}
          </div>
        </div>
      ),
    },
    {
      key: 'budget_progress',
      title: 'Progress',
      render: (_, row) => {
        const percentage = getProgressPercentage(row);
        const isOverBudget = row.budget_spent > row.budget_allocated;
        
        return (
          <div className="w-24">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium">{percentage.toFixed(0)}%</span>
              {isOverBudget && (
                <AlertTriangle className="w-3 h-3 text-red-500" />
              )}
            </div>
            <div className={cn(
              'w-full h-2 rounded-full',
              theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
            )}>
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  isOverBudget ? 'bg-red-500' : 'bg-blue-500'
                )}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: 'assigned_agents',
      title: 'Team',
      render: (value) => (
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium">
            {Array.isArray(value) ? value.length : 0} agents
          </span>
        </div>
      ),
    },
    {
      key: 'target_date',
      title: 'Due Date',
      sortable: true,
      render: (value) => {
        if (!value) return <span className="text-gray-400">No deadline</span>;
        
        const daysRemaining = getDaysRemaining(value);
        const isOverdue = daysRemaining !== null && daysRemaining < 0;
        const isUrgent = daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0;
        
        return (
          <div className="flex items-center gap-2">
            <Calendar className={cn(
              'w-4 h-4',
              isOverdue ? 'text-red-500' : isUrgent ? 'text-yellow-500' : 'text-gray-400'
            )} />
            <div className="text-sm">
              <div className={cn(
                isOverdue ? 'text-red-600' : isUrgent ? 'text-yellow-600' : ''
              )}>
                {new Date(value).toLocaleDateString()}
              </div>
              {daysRemaining !== null && (
                <div className={cn(
                  'text-xs',
                  isOverdue ? 'text-red-500' : isUrgent ? 'text-yellow-500' : 'text-gray-500'
                )}>
                  {isOverdue 
                    ? `${Math.abs(daysRemaining)} days overdue`
                    : `${daysRemaining} days remaining`
                  }
                </div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: 'lead_agent_id',
      title: 'Lead Agent',
      render: (value) => (
        <span className={cn(
          'text-sm font-mono',
          value ? '' : 'text-gray-400',
          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
        )}>
          {value ? `${value.slice(0, 8)}...` : 'Unassigned'}
        </span>
      ),
    },
    {
      key: 'created_at',
      title: 'Created',
      sortable: true,
      render: (value) => (
        <span className="text-sm">
          {new Date(value).toLocaleDateString()}
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
            : row[col.key as keyof Project];
          return typeof value === 'object' ? JSON.stringify(value) : value;
        }).join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `projects-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DataTable
      data={data?.data || []}
      columns={columns}
      loading={isLoading}
      error={error?.message}
      title="Project Portfolio"
      description="Track project progress, budgets, and team assignments"
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
      actions={
        <select
          value={status || ''}
          onChange={(e) => {
            // This would need to be passed up to parent component
            console.log('Filter by status:', e.target.value);
          }}
          className={cn(
            'px-3 py-2 border rounded-md text-sm',
            theme === 'dark'
              ? 'bg-gray-700 border-gray-600 text-white'
              : 'bg-white border-gray-300 text-gray-900'
          )}
        >
          <option value="">All Projects</option>
          <option value="planning">Planning</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      }
    />
  );
}