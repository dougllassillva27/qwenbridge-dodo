import type { ToolCallAST, ToolDefinition } from './ast.js';
import { detectToolCalls } from './detector.js';
import { repairToolCall } from './repair.js';
import { RequestToolRegistry } from './registry-runtime.js';
import { coerceArguments } from './coercion.js';
import { validateToolCall, type ValidationResult } from './validator.js';
import { calculateConfidence } from './confidence.js';
import { v4 as uuidv4 } from 'uuid';

export interface PipelineResult {
  textContent: string;
  toolCalls: ToolCallAST[];
  errors: Array<{
    toolName?: string;
    code: string;
    message: string;
    details?: any;
  }>;
}

const CONFIDENCE_THRESHOLD = 0.7;

export function processToolCalls(
  text: string,
  requestTools: unknown[]
): PipelineResult {
  const registry = new RequestToolRegistry(requestTools);
  const detected = detectToolCalls(text);
  
  const toolCalls: ToolCallAST[] = [];
  const errors: PipelineResult['errors'] = [];
  let textContent = text;

  for (const det of detected) {
    while (textContent.includes(det.raw)) {
      textContent = textContent.replace(det.raw, '').trim();
    }
  }

  for (const det of detected) {
    const repaired = repairToolCall(det.extracted);
    if (!repaired) {
      errors.push({
        code: 'MALFORMED_TOOL_CALL',
        message: 'Could not repair or identify tool call structure',
        details: det.extracted,
      });
      continue;
    }

    if (!registry.has(repaired.name)) {
      errors.push({
        toolName: repaired.name,
        code: 'UNKNOWN_TOOL',
        message: `Tool '${repaired.name}' is not registered or provided in the request`,
      });
      continue;
    }

    const toolDef = registry.get(repaired.name)!;
    const coercedArgs = coerceArguments(repaired.arguments, toolDef.schema);

    const ast: ToolCallAST = {
      id: `call_${uuidv4()}`,
      name: repaired.name,
      arguments: coercedArgs,
      raw: det.raw,
      confidence: 0.0,
    };

    const validation: ValidationResult = validateToolCall(ast, toolDef);
    const confidenceResult = calculateConfidence(ast, toolDef);
    ast.confidence = confidenceResult.score;

    if (!validation.valid) {
      if (validation.missingFields.length > 0) {
        errors.push({
          toolName: ast.name,
          code: 'MISSING_REQUIRED_FIELD',
          message: `Missing required fields: ${validation.missingFields.join(', ')}`,
          details: validation.errors,
        });
      } else {
        errors.push({
          toolName: ast.name,
          code: 'SCHEMA_VALIDATION_FAILED',
          message: 'Arguments do not match the tool schema',
          details: validation.errors,
        });
      }
      continue;
    }

    if (ast.confidence >= CONFIDENCE_THRESHOLD) {
      toolCalls.push(ast);
    } else {
      errors.push({
        toolName: ast.name,
        code: 'LOW_CONFIDENCE',
        message: `Tool call confidence ${ast.confidence} is below threshold ${CONFIDENCE_THRESHOLD}`,
        details: confidenceResult.reasons,
      });
    }
  }

  return {
    textContent,
    toolCalls,
    errors,
  };
}

export function formatOpenAIToolCalls(toolCalls: ToolCallAST[]): any[] {
  return toolCalls.map(tc => ({
    id: tc.id,
    type: 'function',
    function: {
      name: tc.name,
      arguments: JSON.stringify(tc.arguments),
    },
  }));
}
