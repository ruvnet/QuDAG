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
