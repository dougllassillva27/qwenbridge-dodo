import type { JsonSchema } from './types.js';

export interface ToolCallAST {
  id: string;
  name: string;
  arguments: unknown;
  raw: string;
  confidence: number;
}

export interface ToolDefinition {
  name: string;
  description?: string;
  schema: JsonSchema;
}
