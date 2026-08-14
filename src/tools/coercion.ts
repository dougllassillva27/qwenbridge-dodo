import type { JsonSchema } from './types.js';

export function coerceArguments(args: unknown, schema: JsonSchema): unknown {
  if (typeof args !== 'object' || args === null || Array.isArray(args)) {
    return args;
  }

  const coerced: Record<string, unknown> = {};
  const properties = schema.properties || {};

  for (const [key, value] of Object.entries(args as Record<string, unknown>)) {
    const propSchema = properties[key];
    if (propSchema && typeof propSchema === 'object') {
      coerced[key] = coerceValue(value, propSchema);
    } else {
      coerced[key] = value;
    }
  }

  return coerced;
}

function coerceValue(value: unknown, schema: JsonSchema): unknown {
  if (typeof value !== 'string') {
    if (Array.isArray(value) && schema.type === 'array' && schema.items) {
      return value.map(item => coerceValue(item, schema.items!));
    }
    if (typeof value === 'object' && value !== null && schema.type === 'object' && schema.properties) {
      return coerceArguments(value, { type: 'object', properties: schema.properties!, required: schema.required });
    }
    return value;
  }

  const trimmed = value.trim();

  if (schema.type === 'boolean') {
    if (trimmed.toLowerCase() === 'true') return true;
    if (trimmed.toLowerCase() === 'false') return false;
  }

  if (schema.type === 'integer' || schema.type === 'number') {
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const num = Number(trimmed);
      if (!Number.isNaN(num)) {
        return schema.type === 'integer' ? Math.trunc(num) : num;
      }
    }
  }

  if (schema.type === 'array' && trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // fall through
    }
  }

  if (schema.type === 'object' && trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // fall through
    }
  }

  return value;
}
