/**
 * Role-Based Access Control (RBAC)
 *
 * Implements fine-grained authorization with role hierarchies,
 * permissions, and conditional access rules.
 */

export type Action = "read" | "write" | "execute" | "delete" | "admin";

export interface Permission {
  resource: string;
  actions: Action[];
  conditions?: PermissionCondition[];
}

export interface PermissionCondition {
  type: "time" | "ip" | "resource_owner" | "custom";
  value: any;
  evaluate?: (context: any) => boolean;
}

export interface Role {
  name: string;
  permissions: Permission[];
  inherits?: string[];
}

export class RBACManager {
  private roles: Map<string, Role> = new Map();
  private defaultRoles: Map<string, Role> = new Map();

  constructor() {
    this.initializeDefaultRoles();
  }

  /**
   * Initialize standard QuDAG roles
   */
  private initializeDefaultRoles(): void {
    // Admin role - full access
    this.defaultRoles.set("admin", {
      name: "Administrator",
      permissions: [
        {
          resource: "*",
          actions: ["read", "write", "execute", "delete", "admin"]
        }
      ]
    });

    // Developer role - read, write, execute
    this.defaultRoles.set("developer", {
      name: "Developer",
      permissions: [
        { resource: "dag", actions: ["read", "write", "execute"] },
        { resource: "quantum", actions: ["read", "write", "execute"] },
        { resource: "crypto", actions: ["read", "execute"] },
        { resource: "vault", actions: ["read", "write"], conditions: [{ type: "resource_owner", value: true }] },
        { resource: "network", actions: ["read"] },
        { resource: "benchmark", actions: ["read", "execute"] }
      ]
    });

    // Operator role - execute and monitor
    this.defaultRoles.set("operator", {
      name: "Operator",
      permissions: [
        { resource: "dag", actions: ["read", "execute"] },
        { resource: "quantum", actions: ["read", "execute"] },
        { resource: "crypto", actions: ["read"] },
        { resource: "vault", actions: ["read"] },
        { resource: "network", actions: ["read"] },
        { resource: "monitoring", actions: ["read"] }
      ]
    });

    // Auditor role - read-only
    this.defaultRoles.set("auditor", {
      name: "Auditor",
      permissions: [
        { resource: "dag", actions: ["read"] },
        { resource: "quantum", actions: ["read"] },
        { resource: "crypto", actions: ["read"] },
        { resource: "vault", actions: ["read"] },
        { resource: "network", actions: ["read"] },
        { resource: "audit", actions: ["read"] },
        { resource: "monitoring", actions: ["read"] }
      ]
    });

    // Guest role - minimal read-only access
    this.defaultRoles.set("readonly", {
      name: "Read-Only User",
      permissions: [
        { resource: "dag", actions: ["read"] },
        { resource: "quantum", actions: ["read"] },
        { resource: "crypto", actions: ["read"] },
        { resource: "network", actions: ["read"] }
      ]
    });

    // Copy default roles to main roles map
    for (const [name, role] of this.defaultRoles.entries()) {
      this.roles.set(name, role);
    }
  }

  /**
   * Register a custom role
   */
  public registerRole(name: string, role: Role): void {
    if (this.defaultRoles.has(name)) {
      throw new Error(`Cannot override default role: ${name}`);
    }
    this.roles.set(name, role);
  }

  /**
   * Get role by name
   */
  public getRole(name: string): Role | undefined {
    return this.roles.get(name);
  }

  /**
   * Get all roles
   */
  public getAllRoles(): Map<string, Role> {
    return new Map(this.roles);
  }

  /**
   * Check if user has permission for a resource/action
   */
  public hasPermission(
    userRoles: string[],
    resource: string,
    action: Action,
    context?: any
  ): boolean {
    for (const roleName of userRoles) {
      const role = this.getRole(roleName);
      if (!role) continue;

      // Check direct permissions
      for (const permission of role.permissions) {
        if (this.matchesResource(permission.resource, resource)) {
          if (permission.actions.includes(action) || permission.actions.includes("admin")) {
            // Evaluate conditions
            if (!permission.conditions || this.evaluateConditions(permission.conditions, context)) {
              return true;
            }
          }
        }
      }

      // Check inherited roles
      if (role.inherits) {
        if (this.hasPermission(role.inherits, resource, action, context)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if user has any of the required scopes
   */
  public hasSomePermission(
    userRoles: string[],
    permissions: Array<{ resource: string; action: Action }>,
    context?: any
  ): boolean {
    return permissions.some(perm =>
      this.hasPermission(userRoles, perm.resource, perm.action, context)
    );
  }

  /**
   * Check if user has all required permissions
   */
  public hasAllPermissions(
    userRoles: string[],
    permissions: Array<{ resource: string; action: Action }>,
    context?: any
  ): boolean {
    return permissions.every(perm =>
      this.hasPermission(userRoles, perm.resource, perm.action, context)
    );
  }

  /**
   * Get all permissions for user
   */
  public getUserPermissions(userRoles: string[]): Permission[] {
    const permissions: Permission[] = [];
    const seen = new Set<string>();

    const processRole = (roleName: string): void => {
      if (seen.has(roleName)) return;
      seen.add(roleName);

      const role = this.getRole(roleName);
      if (!role) return;

      for (const permission of role.permissions) {
        permissions.push(permission);
      }

      if (role.inherits) {
        for (const inheritedRole of role.inherits) {
          processRole(inheritedRole);
        }
      }
    };

    for (const roleName of userRoles) {
      processRole(roleName);
    }

    return permissions;
  }

  /**
   * Match resource pattern (supports wildcards)
   */
  private matchesResource(pattern: string, resource: string): boolean {
    if (pattern === "*") return true;
    if (pattern === resource) return true;

    // Support wildcard patterns like "dag/*" or "quantum:*"
    if (pattern.endsWith("*")) {
      const prefix = pattern.slice(0, -1);
      return resource.startsWith(prefix);
    }

    return false;
  }

  /**
   * Evaluate permission conditions
   */
  private evaluateConditions(conditions: PermissionCondition[], context?: any): boolean {
    if (!conditions || conditions.length === 0) return true;

    for (const condition of conditions) {
      if (!this.evaluateCondition(condition, context)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: PermissionCondition, context?: any): boolean {
    if (!context) return true;

    switch (condition.type) {
      case "time":
        return this.checkTimeCondition(condition.value);

      case "ip":
        return this.checkIpCondition(condition.value, context.ip);

      case "resource_owner":
        return condition.value === true ? context.is_owner === true : true;

      case "custom":
        return condition.evaluate ? condition.evaluate(context) : true;

      default:
        return true;
    }
  }

  /**
   * Check time-based condition
   */
  private checkTimeCondition(timeRange: { start: string; end: string }): boolean {
    const now = new Date();
    const [startHour, startMin] = timeRange.start.split(":").map(Number);
    const [endHour, endMin] = timeRange.end.split(":").map(Number);

    const currentTime = now.getHours() * 60 + now.getMinutes();
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    return currentTime >= startTime && currentTime <= endTime;
  }

  /**
   * Check IP-based condition
   */
  private checkIpCondition(allowedIps: string[], userIp?: string): boolean {
    if (!userIp) return true;
    return allowedIps.includes(userIp);
  }

  /**
   * Get role hierarchy as a tree
   */
  public getRoleHierarchy(): Record<string, any> {
    const tree: Record<string, any> = {};

    for (const [name, role] of this.roles.entries()) {
      tree[name] = {
        name: role.name,
        permissions: role.permissions.length,
        inherits: role.inherits || []
      };
    }

    return tree;
  }
}

export const createRBACManager = (): RBACManager => {
  return new RBACManager();
};
