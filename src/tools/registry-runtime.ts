import type { ToolDefinition } from './ast.js';

export class RequestToolRegistry {
  private registry: Map<string, ToolDefinition>;

  constructor(requestTools: unknown[] = []) {
    this.registry = new Map();
    for (const tool of requestTools) {
      if (tool && typeof tool === 'object') {
        const t = tool as any;
        if (t.type === 'function' && t.function && typeof t.function === 'object') {
          const fn = t.function;
          this.registry.set(fn.name, {
            name: fn.name,
            description: fn.description,
            schema: fn.parameters || {},
          });
        }
      }
    }
  }

  has(name: string): boolean {
    return this.registry.has(name);
  }

  get(name: string): ToolDefinition | undefined {
    return this.registry.get(name);
  }

  list(): ToolDefinition[] {
    return Array.from(this.registry.values());
  }
}
