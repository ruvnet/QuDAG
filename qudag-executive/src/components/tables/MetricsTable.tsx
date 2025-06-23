/**
 * @description Business metrics data table with real API integration
 * @author CleoClaudeDesktop
 * @created 2025-06-23
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Real metrics data table
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Minus,
  Target,
  Award,
  Calculator,
  Calendar
} from 'lucide-react';
import { DataTable } from '../DataTable';
import type { Column } from '../DataTable';
import { apiService } from '../../services/api';
import type { BusinessMetric } from '../../services/api';
import { cn } from '../../lib/utils';

interface MetricsTableProps {
  organizationId?: string;
  metricType?: string;
  theme?: 'light' | 'dark';
}

const metricIcons = {
  revenue: DollarSign,
  costs: Calculator,
  profit: TrendingUp,
  efficiency: Target,
  quality: Award,
};

const metricColors = {
  revenue: 'text-green-600',
  costs: 'text-red-600',
  profit: 'text-blue-600',
  efficiency: 'text-purple-600',
  quality: 'text-indigo-600',
};

export function MetricsTable({ organizationId, metricType, theme = 'light' }: MetricsTableProps) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['metrics', organizationId, metricType, page, search, sortKey, sortDirection],
    queryFn: () => apiService.metrics.list(organizationId, metricType, page, 10),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const formatCurrency = (value: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const getTrendIcon = (current: number, previous?: number) => {
    if (!previous) return <Minus className="w-4 h-4 text-gray-400" />;
    
    if (current > previous) {
      return <TrendingUp className="w-4 h-4 text-green-500" />;
    } else if (current < previous) {
      return <TrendingDown className="w-4 h-4 text-red-500" />;
    } else {
      return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const columns: Column<BusinessMetric>[] = [
    {
      key: 'metric_type',
      title: 'Type',
      sortable: true,
      render: (value) => {
        const Icon = metricIcons[value as keyof typeof metricIcons] || Target;
        const colorClass = metricColors[value as keyof typeof metricColors] || 'text-gray-500';
        return (
          <div className="flex items-center gap-2">
            <Icon className={cn('w-4 h-4', colorClass)} />
            <span className="capitalize font-medium">{value}</span>
          </div>
        );
      },
    },
    {
      key: 'metric_subtype',
      title: 'Subtype',
      sortable: true,
      render: (value) => (
        <span className={cn(
          'text-sm',
          value ? 'capitalize' : 'text-gray-400',
          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
        )}>
          {value || 'General'}
        </span>
      ),
    },
    {
      key: 'value',
      title: 'Value',
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center gap-2">
          <span className="font-semibold text-lg">
            {row.metric_type === 'efficiency' || row.metric_type === 'quality'
              ? formatPercentage(value)
              : formatCurrency(value, row.currency)
            }
          </span>
          {getTrendIcon(value)}
        </div>
      ),
    },
    {
      key: 'currency',
      title: 'Currency',
      sortable: true,
      render: (value, row) => (
        <span className={cn(
          'px-2 py-1 rounded-full text-xs font-medium',
          theme === 'dark' 
            ? 'bg-gray-700 text-gray-300' 
            : 'bg-gray-100 text-gray-700'
        )}>
          {['efficiency', 'quality'].includes(row.metric_type) ? 'N/A' : value}
        </span>
      ),
    },
    {
      key: 'period_start',
      title: 'Period',
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <div className="text-sm">
            <div>{new Date(value).toLocaleDateString()}</div>
            <div className={cn(
              'text-xs',
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            )}>
              to {new Date(row.period_end).toLocaleDateString()}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'department_id',
      title: 'Department',
      render: (value) => (
        <span className={cn(
          'text-sm',
          value ? '' : 'text-gray-400',
          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
        )}>
          {value ? `Dept-${value.slice(0, 8)}` : 'Organization'}
        </span>
      ),
    },
    {
      key: 'agent_id',
      title: 'Agent',
      render: (value) => (
        <span className={cn(
          'text-sm font-mono',
          value ? '' : 'text-gray-400',
          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
        )}>
          {value ? `${value.slice(0, 8)}...` : 'All Agents'}
        </span>
      ),
    },
    {
      key: 'created_at',
      title: 'Recorded',
      sortable: true,
      render: (value) => (
        <div className="text-sm">
          <div>{new Date(value).toLocaleDateString()}</div>
          <div className={cn(
            'text-xs',
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          )}>
            {new Date(value).toLocaleTimeString()}
          </div>
        </div>
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
            ? col.key.split('.').reduce((obj: any, k) => obj?.[k], row)
            : row[col.key as keyof BusinessMetric];
          return typeof value === 'object' ? JSON.stringify(value) : value;
        }).join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `business-metrics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DataTable
      data={data?.data || []}
      columns={columns}
      loading={isLoading}
      error={error?.message}
      title="Business Metrics"
      description="Track revenue, costs, efficiency, and performance indicators"
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
          value={metricType || ''}
          onChange={(e) => {
            // This would need to be passed up to parent component
            console.log('Filter by type:', e.target.value);
          }}
          className={cn(
            'px-3 py-2 border rounded-md text-sm',
            theme === 'dark'
              ? 'bg-gray-700 border-gray-600 text-white'
              : 'bg-white border-gray-300 text-gray-900'
          )}
        >
          <option value="">All Types</option>
          <option value="revenue">Revenue</option>
          <option value="costs">Costs</option>
          <option value="profit">Profit</option>
          <option value="efficiency">Efficiency</option>
          <option value="quality">Quality</option>
        </select>
      }
    />
  );
}