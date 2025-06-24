/**
 * @description Reusable data table component with sorting, filtering, and pagination
 * @author CleoClaudeDesktop
 * @created 2025-06-23
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial data table implementation
 */

import React from 'react';
import { motion } from 'framer-motion';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronUp, 
  ChevronDown,
  Search,
  RefreshCw,
  Download
} from 'lucide-react';
import { cn } from '../lib/utils';

export interface Column<T> {
  key: keyof T | string;
  title: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: unknown, row: T, index: number) => React.ReactNode;
  width?: string;
  className?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  error?: string;
  title?: string;
  description?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  pagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  onPageChange?: (page: number) => void;
  onRefresh?: () => void;
  onExport?: () => void;
  theme?: 'light' | 'dark';
  actions?: React.ReactNode;
}

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  loading = false,
  error,
  title,
  description,
  searchValue = '',
  onSearchChange,
  sortKey,
  sortDirection,
  onSort,
  pagination,
  onPageChange,
  onRefresh,
  onExport,
  theme = 'light',
  actions
}: DataTableProps<T>) {
  const getValue = (row: T, key: string) => {
    if (key.includes('.')) {
      return key.split('.').reduce((obj, k) => obj?.[k], row);
    }
    return row[key];
  };

  const handleSort = (column: Column<T>) => {
    if (!column.sortable || !onSort) return;
    
    const key = column.key as string;
    const newDirection = sortKey === key && sortDirection === 'asc' ? 'desc' : 'asc';
    onSort(key, newDirection);
  };

  return (
    <div className={cn(
      'rounded-lg border',
      theme === 'dark' 
        ? 'bg-gray-800 border-gray-700' 
        : 'bg-white border-gray-200'
    )}>
      {/* Header */}
      {(title || description || onSearchChange || onRefresh || onExport || actions) && (
        <div className={cn(
          'p-6 border-b',
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
        )}>
          <div className="flex items-center justify-between">
            <div>
              {title && (
                <h3 className={cn(
                  'text-lg font-semibold',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  {title}
                </h3>
              )}
              {description && (
                <p className={cn(
                  'text-sm mt-1',
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                )}>
                  {description}
                </p>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {actions}
              
              {onSearchChange && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchValue}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className={cn(
                      'pl-10 pr-4 py-2 border rounded-md w-64',
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    )}
                  />
                </div>
              )}
              
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  disabled={loading}
                  className={cn(
                    'p-2 rounded-md transition-colors',
                    theme === 'dark'
                      ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                      : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700',
                    loading && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                </button>
              )}
              
              {onExport && (
                <button
                  onClick={onExport}
                  className={cn(
                    'p-2 rounded-md transition-colors',
                    theme === 'dark'
                      ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                      : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                  )}
                >
                  <Download className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className={cn(
            theme === 'dark' ? 'bg-gray-750' : 'bg-gray-50'
          )}>
            <tr>
              {columns.map((column, index) => (
                <th
                  key={index}
                  className={cn(
                    'px-6 py-3 text-left text-xs font-medium uppercase tracking-wider',
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-500',
                    column.sortable && 'cursor-pointer hover:bg-opacity-80',
                    column.className
                  )}
                  style={{ width: column.width }}
                  onClick={() => handleSort(column)}
                >
                  <div className="flex items-center gap-1">
                    {column.title}
                    {column.sortable && sortKey === column.key && (
                      sortDirection === 'asc' ? 
                        <ChevronUp className="w-4 h-4" /> : 
                        <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={cn(
            'divide-y',
            theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'
          )}>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center">
                  <div className="flex items-center justify-center">
                    <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                    <span className={cn(
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    )}>
                      Loading...
                    </span>
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center">
                  <div className="text-red-500">
                    <p className="font-medium">Error loading data</p>
                    <p className="text-sm mt-1">{error}</p>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center">
                  <p className={cn(
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  )}>
                    No data found
                  </p>
                </td>
              </tr>
            ) : (
              data.map((row, index) => (
                <motion.tr
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    'transition-colors',
                    theme === 'dark' 
                      ? 'hover:bg-gray-700/50' 
                      : 'hover:bg-gray-50'
                  )}
                >
                  {columns.map((column, colIndex) => (
                    <td
                      key={colIndex}
                      className={cn(
                        'px-6 py-4 whitespace-nowrap text-sm',
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-900',
                        column.className
                      )}
                    >
                      {column.render 
                        ? column.render(getValue(row, column.key as string), row, index)
                        : getValue(row, column.key as string)
                      }
                    </td>
                  ))}
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && (
        <div className={cn(
          'px-6 py-3 border-t flex items-center justify-between',
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
        )}>
          <div className={cn(
            'text-sm',
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          )}>
            Showing {((pagination.page - 1) * pagination.pageSize) + 1} to {' '}
            {Math.min(pagination.page * pagination.pageSize, pagination.totalItems)} of {' '}
            {pagination.totalItems} results
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange?.(pagination.page - 1)}
              disabled={!pagination.hasPrevious}
              className={cn(
                'p-2 rounded-md transition-colors',
                pagination.hasPrevious
                  ? theme === 'dark'
                    ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                    : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                  : 'opacity-50 cursor-not-allowed text-gray-400'
              )}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <span className={cn(
              'px-3 py-1 rounded-md text-sm font-medium',
              theme === 'dark' 
                ? 'bg-gray-700 text-white' 
                : 'bg-gray-100 text-gray-900'
            )}>
              {pagination.page} of {pagination.totalPages}
            </span>
            
            <button
              onClick={() => onPageChange?.(pagination.page + 1)}
              disabled={!pagination.hasNext}
              className={cn(
                'p-2 rounded-md transition-colors',
                pagination.hasNext
                  ? theme === 'dark'
                    ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                    : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                  : 'opacity-50 cursor-not-allowed text-gray-400'
              )}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}