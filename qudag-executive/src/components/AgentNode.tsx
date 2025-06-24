/**
 * @description Agent Node Component for Living Organization Chart
 * @author Claude Code
 * @created 2025-06-24
 * @lastModified 2025-06-24 - Interactive agent visualization with real-time status
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Trophy,
  DollarSign,
  Activity,
  Brain,
  Target,
  TrendingUp
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { AgentProfile } from '../services/api';

interface AgentNodeProps {
  agent: AgentProfile & {
    x?: number;
    y?: number;
    revenue_per_hour?: number;
    tasks_today?: number;
    efficiency_score?: number;
  };
  theme: 'light' | 'dark';
  isSelected?: boolean;
  onSelect?: (agent: AgentProfile) => void;
  onAction?: (action: string, agent: AgentProfile) => void;
  showDetails?: boolean;
  scale?: number;
}

// Personality type to emoji mapping for visual identification
const PERSONALITY_AVATARS: Record<string, string> = {
  hunter: '🎯',
  farmer: '🌱', 
  analyst: '📊',
  creative: '🎨',
  executor: '⚡'
};

// Status color mapping
const STATUS_COLORS = {
  active: 'bg-green-500',
  idle: 'bg-yellow-500',
  error: 'bg-red-500',
  maintenance: 'bg-blue-500',
  retired: 'bg-gray-500'
};

// Level icons
const LEVEL_ICONS = {
  executive: Trophy,
  manager: Target,
  specialist: Brain,
  operator: User
};

export function AgentNode({ 
  agent, 
  theme, 
  isSelected = false, 
  onSelect, 
  onAction,
  showDetails = false,
  scale = 1 
}: AgentNodeProps) {
  const [isHovered, setIsHovered] = useState(false);

  const LevelIcon = LEVEL_ICONS[agent.level] || User;
  const avatar = PERSONALITY_AVATARS[agent.personality_type] || '🤖';
  const statusColor = STATUS_COLORS[agent.status] || 'bg-gray-500';

  const handleClick = () => {
    onSelect?.(agent);
  };

  const handleDoubleClick = () => {
    onAction?.('view_details', agent);
  };

  const nodeSize = 60 * scale;
  const isCompact = scale < 0.8;

  return (
    <motion.div
      className="absolute cursor-pointer"
      style={{
        left: agent.x ? agent.x - nodeSize/2 : 0,
        top: agent.y ? agent.y - nodeSize/2 : 0,
        transform: `scale(${scale})`,
        transformOrigin: 'center'
      }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0 }}
      whileHover={{ scale: scale * 1.1 }}
      whileTap={{ scale: scale * 0.95 }}
      onMouseEnter={() => {
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {/* Main Agent Node */}
      <div
        className={cn(
          'relative rounded-full border-2 transition-all duration-200 flex items-center justify-center',
          theme === 'dark' ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300',
          isSelected && 'ring-4 ring-purple-500/50',
          isHovered && 'shadow-xl',
          agent.status === 'active' && 'border-green-400',
          agent.status === 'error' && 'border-red-400 animate-pulse'
        )}
        style={{ 
          width: nodeSize, 
          height: nodeSize 
        }}
      >
        {/* Personality Avatar */}
        <div className="text-2xl" style={{ fontSize: nodeSize * 0.4 }}>
          {avatar}
        </div>

        {/* Status Indicator */}
        <div 
          className={cn(
            'absolute -top-1 -right-1 w-4 h-4 rounded-full border-2',
            statusColor,
            theme === 'dark' ? 'border-gray-800' : 'border-white',
            agent.status === 'active' && 'animate-pulse'
          )}
        />

        {/* Level Badge */}
        <div 
          className={cn(
            'absolute -bottom-1 -left-1 w-6 h-6 rounded-full flex items-center justify-center',
            theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
          )}
        >
          <LevelIcon className="w-3 h-3" />
        </div>

        {/* Performance Ring */}
        <div 
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(from 0deg, 
              ${agent.performance_rating >= 4 ? '#10b981' : 
                agent.performance_rating >= 3 ? '#f59e0b' : '#ef4444'} 
              ${(agent.performance_rating / 5) * 360}deg, 
              transparent 0deg)`
          }}
        />
      </div>

      {/* Agent Name Label */}
      {!isCompact && (
        <div 
          className={cn(
            'absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 rounded text-xs font-medium whitespace-nowrap',
            theme === 'dark' ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-800',
            'shadow-sm border',
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          )}
        >
          {agent.business_role || 'Agent'}
        </div>
      )}

      {/* Quick Metrics */}
      {!isCompact && isHovered && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className={cn(
            'absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 p-2 rounded-lg shadow-lg border',
            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
            'min-w-32'
          )}
        >
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-green-500" />
              <span className={cn('font-medium', theme === 'dark' ? 'text-gray-200' : 'text-gray-800')}>
                ${agent.revenue_per_hour || 45}/hr
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Activity className="w-3 h-3 text-blue-500" />
              <span className={cn('font-medium', theme === 'dark' ? 'text-gray-200' : 'text-gray-800')}>
                {agent.tasks_today || 12} tasks today
              </span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-purple-500" />
              <span className={cn('font-medium', theme === 'dark' ? 'text-gray-200' : 'text-gray-800')}>
                {((agent.efficiency_score || 0.85) * 100).toFixed(0)}% efficiency
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Detailed Card */}
      <AnimatePresence>
        {showDetails && isSelected && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={cn(
              'absolute top-full left-1/2 transform -translate-x-1/2 mt-4 p-4 rounded-xl shadow-2xl border z-50',
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
              'w-72'
            )}
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
              <div className="text-2xl">{avatar}</div>
              <div>
                <h3 className={cn(
                  'font-bold text-sm',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  {agent.business_role}
                </h3>
                <p className={cn(
                  'text-xs',
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                )}>
                  {agent.level} • {agent.personality_type}
                </p>
              </div>
              <div className={cn(
                'ml-auto px-2 py-1 rounded-full text-xs font-medium',
                agent.status === 'active' && 'bg-green-100 text-green-800',
                agent.status === 'idle' && 'bg-yellow-100 text-yellow-800',
                agent.status === 'error' && 'bg-red-100 text-red-800'
              )}>
                {agent.status}
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className={cn(
                'p-2 rounded-lg',
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
              )}>
                <div className="flex items-center gap-1 mb-1">
                  <Trophy className="w-3 h-3 text-yellow-500" />
                  <span className="text-xs font-medium">Rating</span>
                </div>
                <div className={cn(
                  'text-lg font-bold',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  {agent.performance_rating?.toFixed(1) || '4.2'}/5.0
                </div>
              </div>

              <div className={cn(
                'p-2 rounded-lg',
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
              )}>
                <div className="flex items-center gap-1 mb-1">
                  <DollarSign className="w-3 h-3 text-green-500" />
                  <span className="text-xs font-medium">Revenue</span>
                </div>
                <div className={cn(
                  'text-lg font-bold',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  ${agent.cost_per_hour || 35}/hr
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onAction?.('optimize', agent)}
                className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 transition-colors"
              >
                Optimize
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onAction?.('assign_task', agent)}
                className={cn(
                  'flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                  theme === 'dark' 
                    ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                Assign Task
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Activity Pulse */}
      {agent.status === 'active' && (
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-green-400"
          initial={{ scale: 1, opacity: 0.5 }}
          animate={{ scale: 1.2, opacity: 0 }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
}