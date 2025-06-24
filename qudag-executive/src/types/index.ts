export interface Tab {
  id: string;
  title: string;
  icon: string;
  render: (context: TabRenderContext) => React.ReactElement;
  closable?: boolean;
  data?: Record<string, unknown>;
}

export interface TabRenderContext {
  theme: "light" | "dark";
  onNotification: (
    message: string,
    type: "info" | "success" | "warning" | "error"
  ) => void;
}

export interface TabState {
  tabs: Tab[];
  activeTabId: string | null;
  sidebarCollapsed: boolean;
}

export type Theme = "light" | "dark";

export interface CockpitState {
  theme: Theme;
  tabState: TabState;
  notifications: Notification[];
}

export interface Notification {
  id: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  timestamp: number;
  autoClose?: boolean;
}

export interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  badge?: string | number;
  disabled?: boolean;
}

// CEO Command System Types
export interface CEOCommand {
  id: string;
  input: string;
  intent: CommandIntent;
  entities: Record<string, any>;
  confidence: number;
  timestamp: number;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  result?: CommandResult;
}

export interface CommandIntent {
  action: 'hire' | 'analyze' | 'optimize' | 'scale' | 'show' | 'generate' | 'deploy' | 'help';
  target: 'agent' | 'department' | 'metrics' | 'report' | 'project' | 'system' | 'general';
  modifier?: 'quick' | 'detailed' | 'urgent' | 'scheduled';
}

export interface CommandResult {
  success: boolean;
  message: string;
  data?: any;
  actions?: QuickAction[];
}

export interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
  primary?: boolean;
}

export interface VoiceState {
  isListening: boolean;
  isProcessing: boolean;
  transcript: string;
  confidence: number;
  error?: string;
}

export interface CommandSuggestion {
  text: string;
  description: string;
  category: 'hiring' | 'analytics' | 'operations' | 'optimization';
  examples: string[];
}
