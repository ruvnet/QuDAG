/**
 * @description Living Organization Chart - Revolutionary AI workforce visualization
 * @author Claude Code
 * @created 2025-06-24
 * @lastModified 2025-06-24 - Interactive D3.js org chart with business intelligence
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as d3 from 'd3';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Search,
  Users,
  BarChart3,
  RefreshCw
} from 'lucide-react';
import { cn } from '../lib/utils';
import { AgentNode } from './AgentNode';
import type { AgentProfile } from '../services/api';

interface LivingOrgChartProps {
  agents: AgentProfile[];
  theme: 'light' | 'dark';
  onAgentSelect?: (agent: AgentProfile) => void;
  onAgentAction?: (action: string, agent: AgentProfile) => void;
  className?: string;
}

interface OrgNode extends AgentProfile {
  x?: number;
  y?: number;
  children?: OrgNode[];
  parent?: OrgNode;
  depth?: number;
  revenue_per_hour?: number;
  tasks_today?: number;
  efficiency_score?: number;
}

type LayoutType = 'tree' | 'radial' | 'force' | 'cluster';

export function LivingOrgChart({ 
  agents, 
  theme, 
  onAgentSelect, 
  onAgentAction,
  className 
}: LivingOrgChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentProfile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [layoutType, setLayoutType] = useState<LayoutType>('tree');
  const [showPerformance, setShowPerformance] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Transform flat agent list into hierarchical structure
  const transformToHierarchy = useCallback((agentList: AgentProfile[]): OrgNode => {
    // Create CEO node (user)
    const ceoNode: OrgNode = {
      agent_id: 'ceo-user',
      organization_id: agentList[0]?.organization_id || 'demo-org',
      business_role: 'CEO (You)',
      level: 'executive',
      personality_type: 'hunter',
      cost_per_hour: 0,
      status: 'active',
      performance_rating: 5.0,
      hired_at: new Date().toISOString(),
      last_active: new Date().toISOString(),
      personality_traits: { speed: 100, accuracy: 100, creativity: 100, collaboration: 100 },
      custom_settings: {},
      metadata: {},
      children: [],
      revenue_per_hour: 0,
      tasks_today: 0,
      efficiency_score: 1.0
    };

    // Group agents by department and level
    const departments = new Map<string, OrgNode[]>();
    const managers = new Map<string, OrgNode>();
    
    agentList.forEach(agent => {
      const dept = agent.department_id || 'general';
      const enhancedAgent: OrgNode = {
        ...agent,
        children: [],
        revenue_per_hour: Math.floor(Math.random() * 80) + 25,
        tasks_today: Math.floor(Math.random() * 20) + 5,
        efficiency_score: 0.7 + Math.random() * 0.3
      };

      if (agent.level === 'manager' || agent.level === 'executive') {
        managers.set(dept, enhancedAgent);
      }

      if (!departments.has(dept)) {
        departments.set(dept, []);
      }
      departments.get(dept)!.push(enhancedAgent);
    });

    // Build hierarchy: CEO -> Managers -> Specialists/Operators
    departments.forEach((deptAgents, deptId) => {
      const manager = managers.get(deptId);
      
      if (manager) {
        // Add manager to CEO's children
        ceoNode.children!.push(manager);
        
        // Add other agents to manager's children
        deptAgents
          .filter(agent => agent.agent_id !== manager.agent_id)
          .forEach(agent => {
            agent.parent = manager;
            manager.children!.push(agent);
          });
      } else {
        // No manager, add agents directly to CEO
        deptAgents.forEach(agent => {
          agent.parent = ceoNode;
          ceoNode.children!.push(agent);
        });
      }
    });

    return ceoNode;
  }, []);

  // Calculate layout positions using D3
  const calculateLayout = useCallback((rootNode: OrgNode, width: number, height: number) => {
    const nodes: OrgNode[] = [];
    const links: Array<{ source: OrgNode; target: OrgNode }> = [];

    // Traverse hierarchy to collect nodes and links
    function traverse(node: OrgNode, depth = 0) {
      node.depth = depth;
      nodes.push(node);
      
      if (node.children) {
        node.children.forEach(child => {
          child.parent = node;
          links.push({ source: node, target: child });
          traverse(child, depth + 1);
        });
      }
    }
    
    traverse(rootNode);

    // Apply layout algorithm
    switch (layoutType) {
      case 'tree': {
        const treeLayout = d3.tree<OrgNode>()
          .size([width - 100, height - 100])
          .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth!);
        
        const treeRoot = d3.hierarchy(rootNode);
        treeLayout(treeRoot);
        
        treeRoot.descendants().forEach((d, i) => {
          if (nodes[i]) {
            nodes[i].x = d.x + 50;
            nodes[i].y = d.y + 50;
          }
        });
        break;
      }

      case 'radial': {
        const radialLayout = d3.tree<OrgNode>()
          .size([2 * Math.PI, Math.min(width, height) / 2 - 100])
          .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth!);
        
        const radialRoot = d3.hierarchy(rootNode);
        radialLayout(radialRoot);
        
        radialRoot.descendants().forEach((d, i) => {
          if (nodes[i]) {
            const angle = d.x;
            const radius = d.y;
            nodes[i].x = width / 2 + radius * Math.cos(angle - Math.PI / 2);
            nodes[i].y = height / 2 + radius * Math.sin(angle - Math.PI / 2);
          }
        });
        break;
      }

      case 'force': {
        const simulation = d3.forceSimulation(nodes)
          .force('link', d3.forceLink(links).id((d: OrgNode) => d.agent_id).distance(100))
          .force('charge', d3.forceManyBody().strength(-300))
          .force('center', d3.forceCenter(width / 2, height / 2))
          .force('collision', d3.forceCollide().radius(40));

        // Run simulation steps
        for (let i = 0; i < 300; i++) {
          simulation.tick();
        }
        simulation.stop();
        break;
      }

      case 'cluster': {
        const clusterLayout = d3.cluster<OrgNode>()
          .size([width - 100, height - 100]);
        
        const clusterRoot = d3.hierarchy(rootNode);
        clusterLayout(clusterRoot);
        
        clusterRoot.descendants().forEach((d, i) => {
          if (nodes[i]) {
            nodes[i].x = d.x + 50;
            nodes[i].y = d.y + 50;
          }
        });
        break;
      }
    }

    return { nodes, links };
  }, [layoutType]);

  // Render org chart
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || agents.length === 0) return;

    setIsLoading(true);
    
    const container = containerRef.current;
    const svg = d3.select(svgRef.current);
    const rect = container.getBoundingClientRect();
    
    // Clear previous render
    svg.selectAll('*').remove();
    
    // Set up SVG dimensions
    const width = rect.width;
    const height = rect.height;
    
    svg.attr('width', width).attr('height', height);
    
    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        const { transform } = event;
        setZoomLevel(transform.k);
        g.attr('transform', transform);
      });

    svg.call(zoom);
    
    // Main group for all elements
    const g = svg.append('g');
    
    // Transform data and calculate layout
    const rootNode = transformToHierarchy(agents);
    const { nodes, links } = calculateLayout(rootNode, width, height);
    
    // Draw links (connections between agents)
    const linkGroup = g.append('g').attr('class', 'links');
    
    if (layoutType !== 'force') {
      linkGroup.selectAll('.link')
        .data(links)
        .enter()
        .append('path')
        .attr('class', 'link')
        .attr('d', (d: { source: OrgNode; target: OrgNode }) => {
          const source = d.source;
          const target = d.target;
          
          if (layoutType === 'radial') {
            return `M${source.x},${source.y}L${target.x},${target.y}`;
          } else {
            return `M${source.x},${source.y}C${source.x},${(source.y + target.y) / 2} ${target.x},${(source.y + target.y) / 2} ${target.x},${target.y}`;
          }
        })
        .attr('fill', 'none')
        .attr('stroke', theme === 'dark' ? '#4B5563' : '#D1D5DB')
        .attr('stroke-width', 2)
        .attr('opacity', 0.7);
    }
    
    // Performance heat map overlay
    if (showPerformance) {
      const performanceGroup = g.append('g').attr('class', 'performance-overlay');
      
      nodes.forEach(node => {
        if (node.x && node.y) {
          const performance = node.efficiency_score || 0.5;
          const color = d3.interpolateRdYlGn(performance);
          
          performanceGroup.append('circle')
            .attr('cx', node.x)
            .attr('cy', node.y)
            .attr('r', 40)
            .attr('fill', color)
            .attr('opacity', 0.3)
            .attr('stroke', color)
            .attr('stroke-width', 2);
        }
      });
    }
    
    setTimeout(() => setIsLoading(false), 500);
  }, [agents, layoutType, showPerformance, theme, transformToHierarchy, calculateLayout]);

  // Filter agents based on search
  const filteredAgents = agents.filter(agent => 
    agent.business_role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.level.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.personality_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAgentSelect = (agent: AgentProfile) => {
    setSelectedAgent(agent);
    onAgentSelect?.(agent);
  };

  const handleZoomIn = () => {
    const svg = d3.select(svgRef.current);
    svg.transition().call(
      d3.zoom<SVGSVGElement, unknown>().transform,
      d3.zoomIdentity.scale(zoomLevel * 1.2)
    );
  };

  const handleZoomOut = () => {
    const svg = d3.select(svgRef.current);
    svg.transition().call(
      d3.zoom<SVGSVGElement, unknown>().transform,
      d3.zoomIdentity.scale(zoomLevel * 0.8)
    );
  };

  const handleFitToScreen = () => {
    const svg = d3.select(svgRef.current);
    svg.transition().call(
      d3.zoom<SVGSVGElement, unknown>().transform,
      d3.zoomIdentity
    );
  };

  return (
    <div className={cn('h-full flex flex-col', className)}>
      {/* Controls Header */}
      <div className={cn(
        'flex items-center justify-between p-4 border-b',
        theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
      )}>
        <div className="flex items-center gap-4">
          <h2 className={cn(
            'text-lg font-bold',
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Living Organization Chart
          </h2>
          
          {isLoading && (
            <RefreshCw className="w-4 h-4 animate-spin text-purple-600" />
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search agents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={cn(
                'pl-10 pr-4 py-2 rounded-lg border text-sm',
                theme === 'dark' 
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              )}
            />
          </div>

          {/* Layout Selector */}
          <select
            value={layoutType}
            onChange={(e) => setLayoutType(e.target.value as LayoutType)}
            className={cn(
              'px-3 py-2 rounded-lg border text-sm',
              theme === 'dark' 
                ? 'bg-gray-700 border-gray-600 text-white' 
                : 'bg-white border-gray-300 text-gray-900'
            )}
          >
            <option value="tree">Tree Layout</option>
            <option value="radial">Radial Layout</option>
            <option value="force">Force Layout</option>
            <option value="cluster">Cluster Layout</option>
          </select>

          {/* Performance Toggle */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowPerformance(!showPerformance)}
            className={cn(
              'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              showPerformance 
                ? 'bg-purple-600 text-white' 
                : theme === 'dark'
                  ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            <BarChart3 className="w-4 h-4" />
          </motion.button>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleZoomOut}
              className={cn(
                'p-2 rounded-lg transition-colors',
                theme === 'dark' 
                  ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              <ZoomOut className="w-4 h-4" />
            </motion.button>
            
            <span className={cn(
              'px-2 text-sm',
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            )}>
              {Math.round(zoomLevel * 100)}%
            </span>
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleZoomIn}
              className={cn(
                'p-2 rounded-lg transition-colors',
                theme === 'dark' 
                  ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              <ZoomIn className="w-4 h-4" />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleFitToScreen}
              className={cn(
                'p-2 rounded-lg transition-colors',
                theme === 'dark' 
                  ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              <Maximize className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Main Chart Area */}
      <div 
        ref={containerRef}
        className="flex-1 relative overflow-hidden"
      >
        {/* SVG for D3 connections */}
        <svg
          ref={svgRef}
          className="absolute inset-0 w-full h-full"
          style={{ zIndex: 1 }}
        />
        
        {/* Agent Nodes Overlay */}
        <div 
          className="absolute inset-0 w-full h-full"
          style={{ zIndex: 2 }}
        >
          {filteredAgents.map((agent) => (
            <AgentNode
              key={agent.agent_id}
              agent={{
                ...agent,
                x: agent.x || 0,
                y: agent.y || 0,
                revenue_per_hour: Math.floor(Math.random() * 80) + 25,
                tasks_today: Math.floor(Math.random() * 20) + 5,
                efficiency_score: 0.7 + Math.random() * 0.3
              }}
              theme={theme}
              isSelected={selectedAgent?.agent_id === agent.agent_id}
              onSelect={handleAgentSelect}
              onAction={onAgentAction}
              showDetails={selectedAgent?.agent_id === agent.agent_id}
              scale={Math.max(0.5, Math.min(1.5, zoomLevel))}
            />
          ))}
        </div>

        {/* Loading Overlay */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm"
              style={{ zIndex: 3 }}
            >
              <div className={cn(
                'flex items-center gap-3 px-6 py-3 rounded-lg',
                theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
              )}>
                <RefreshCw className="w-5 h-5 animate-spin text-purple-600" />
                <span className="font-medium">Organizing your AI workforce...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {agents.length === 0 && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Users className={cn(
                'w-16 h-16 mx-auto mb-4',
                theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
              )} />
              <h3 className={cn(
                'text-lg font-medium mb-2',
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              )}>
                No agents in your workforce yet
              </h3>
              <p className={cn(
                'text-sm',
                theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
              )}>
                Use the command bar to hire your first AI agents
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}