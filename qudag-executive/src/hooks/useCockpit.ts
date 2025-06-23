import { useState, useEffect, useCallback } from "react";
import type {
  Tab,
  TabState,
  Theme,
  CockpitState,
  Notification,
} from "../types";

const STORAGE_KEY = "qudag-cockpit-state";

const defaultTabState: TabState = {
  tabs: [],
  activeTabId: null,
  sidebarCollapsed: false,
};

const defaultCockpitState: CockpitState = {
  theme: "light",
  tabState: defaultTabState,
  notifications: [],
};

// No longer needed since we don't persist tabs with render functions

export function useCockpit() {
  const [state, setState] = useState<CockpitState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...defaultCockpitState,
          ...parsed,
          // Don't restore tabs from localStorage since they contain component references
          tabState: {
            ...defaultTabState,
            sidebarCollapsed: parsed.tabState?.sidebarCollapsed || false,
          },
        };
      }
    } catch (error) {
      console.warn("Failed to load cockpit state from localStorage:", error);
    }
    return defaultCockpitState;
  });

  // Persist state to localStorage (excluding tabs with component references)
  useEffect(() => {
    try {
      const stateToSave = {
        theme: state.theme,
        tabState: {
          sidebarCollapsed: state.tabState.sidebarCollapsed,
          tabs: [], // Don't persist tabs with render functions
          activeTabId: null,
        },
        notifications: [], // Don't persist notifications
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (error) {
      console.warn("Failed to save cockpit state to localStorage:", error);
    }
  }, [state.theme, state.tabState.sidebarCollapsed]); // Only persist theme and sidebar state

  // Theme management
  const toggleTheme = useCallback(() => {
    setState((prev) => ({
      ...prev,
      theme: prev.theme === "light" ? "dark" : "light",
    }));
  }, []);

  const setTheme = useCallback((theme: Theme) => {
    setState((prev) => ({ ...prev, theme }));
  }, []);

  // Tab management
  const addTab = useCallback((tab: Tab) => {
    setState((prev) => {
      const existingTab = prev.tabState.tabs.find((t) => t.id === tab.id);
      if (existingTab) {
        // Tab already exists, just activate it
        return {
          ...prev,
          tabState: {
            ...prev.tabState,
            activeTabId: tab.id,
          },
        };
      }

      // Add new tab
      return {
        ...prev,
        tabState: {
          ...prev.tabState,
          tabs: [...prev.tabState.tabs, tab],
          activeTabId: tab.id,
        },
      };
    });
  }, []);

  const removeTab = useCallback((tabId: string) => {
    setState((prev) => {
      const tabs = prev.tabState.tabs.filter((t) => t.id !== tabId);
      let activeTabId = prev.tabState.activeTabId;

      // If we're removing the active tab, switch to another tab
      if (activeTabId === tabId) {
        if (tabs.length > 0) {
          const currentIndex = prev.tabState.tabs.findIndex(
            (t) => t.id === tabId
          );
          const nextIndex = Math.min(currentIndex, tabs.length - 1);
          activeTabId = tabs[nextIndex]?.id || null;
        } else {
          activeTabId = null;
        }
      }

      return {
        ...prev,
        tabState: {
          ...prev.tabState,
          tabs,
          activeTabId,
        },
      };
    });
  }, []);

  const setActiveTab = useCallback((tabId: string) => {
    setState((prev) => ({
      ...prev,
      tabState: {
        ...prev.tabState,
        activeTabId: tabId,
      },
    }));
  }, []);

  const toggleSidebar = useCallback(() => {
    setState((prev) => ({
      ...prev,
      tabState: {
        ...prev.tabState,
        sidebarCollapsed: !prev.tabState.sidebarCollapsed,
      },
    }));
  }, []);

  // Notification management
  const addNotification = useCallback(
    (notification: Omit<Notification, "id" | "timestamp">) => {
      const newNotification: Notification = {
        ...notification,
        id: Date.now().toString(),
        timestamp: Date.now(),
      };

      setState((prev) => ({
        ...prev,
        notifications: [...prev.notifications, newNotification],
      }));

      // Auto-remove notification if specified
      if (notification.autoClose !== false) {
        setTimeout(() => {
          setState((prev) => ({
            ...prev,
            notifications: prev.notifications.filter(
              (n) => n.id !== newNotification.id
            ),
          }));
        }, 4000);
      }

      return newNotification.id;
    },
    [] // No dependencies needed - using setState with function form
  );

  const removeNotification = useCallback((notificationId: string) => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.filter((n) => n.id !== notificationId),
    }));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setState((prev) => ({
      ...prev,
      notifications: [],
    }));
  }, []);

  return {
    // State
    theme: state.theme,
    tabs: state.tabState.tabs,
    activeTabId: state.tabState.activeTabId,
    sidebarCollapsed: state.tabState.sidebarCollapsed,
    notifications: state.notifications,

    // Actions
    toggleTheme,
    setTheme,
    addTab,
    removeTab,
    setActiveTab,
    toggleSidebar,
    addNotification,
    removeNotification,
    clearAllNotifications,
  };
}
