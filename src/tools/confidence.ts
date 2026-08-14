import type { ToolCallAST, ToolDefinition } from './ast.js';

export interface ConfidenceResult {
  score: number;
  reasons: string[];
}

export function calculateConfidence(ast: ToolCallAST, toolDef: ToolDefinition): ConfidenceResult {
  let score = 0.0;
  const reasons: string[] = [];

  if (ast.name && toolDef.name === ast.name) {
    score += 0.4;
    reasons.push('Tool name matches registry');
  }

  if (ast.arguments && typeof ast.arguments === 'object' && !Array.isArray(ast.arguments)) {
    score += 0.3;
    reasons.push('Arguments are a valid object');
  } else if (typeof ast.arguments === 'string') {
    try {
      JSON.parse(ast.arguments as string);
      score += 0.15;
      reasons.push('Arguments are a valid JSON string');
    } catch {
      reasons.push('Arguments are an invalid JSON string');
    }
  } else {
    reasons.push('Arguments are missing or invalid type');
  }

  const schema = toolDef.schema as any;
  if (schema && schema.required && Array.isArray(schema.required)) {
    const args = (ast.arguments as Record<string, unknown>) || {};
    const hasAllRequired = schema.required.every((field: string) => field in args);
    if (hasAllRequired) {
      score += 0.3;
      reasons.push('All required fields are present');
    } else {
      reasons.push('Missing required fields');
    }
  } else {
    score += 0.3;
    reasons.push('No required fields to validate');
  }

  return { score: Math.min(score, 1.0), reasons };
}
