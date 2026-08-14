import Ajv from 'ajv';
import type { ToolCallAST, ToolDefinition } from './ast.js';

const ajv = new Ajv({ allErrors: true, strict: false });

export interface ValidationResult {
  valid: boolean;
  errors: any[] | null;
  missingFields: string[];
}

export function validateToolCall(ast: ToolCallAST, toolDef: ToolDefinition): ValidationResult {
  const validate = ajv.compile(toolDef.schema);
  const valid = validate(ast.arguments);

  const missingFields: string[] = [];
  if (toolDef.schema && typeof toolDef.schema === 'object' && 'required' in toolDef.schema) {
    const required = (toolDef.schema as any).required;
    if (Array.isArray(required)) {
      for (const field of required) {
        if (!(ast.arguments && typeof ast.arguments === 'object' && field in (ast.arguments as Record<string, unknown>))) {
          missingFields.push(field);
        }
      }
    }
  }

  return {
    valid,
    errors: validate.errors ?? null,
    missingFields,
  };
}
