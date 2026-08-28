/**
 * Modo de raciocínio para modelos Qwen:
 * - "auto": Qwen decide se usa thinking (padrão)
 * - "thinking": força thinking ON
 * - "fast": força thinking OFF
 */
export type ReasoningMode = "auto" | "thinking" | "fast";

/**
 * Resolução de variantes de raciocínio dos modelos Qwen públicos.
 *
 * O contrato público é deliberadamente pequeno: o modelo base significa Auto
 * (o Qwen decide), `-fast` significa Fast (sem thinking) e `-thinking`
 * significa Thinking (forçado). Os sufixos antigos são aceitos apenas como
 * shim de compatibilidade interna para clientes existentes não enviarem
 * esses IDs ao upstream; nunca são publicados por `/v1/models`.
 */
export function stripThinkingSuffix(model: string): {
  baseModel: string;
  enableThinking: boolean;
  reasoningMode: ReasoningMode;
} {
  let normalizedModel = model.trim();

  // Remove sufixos de tamanho de contexto como [1M], [128k], etc.
  normalizedModel = normalizedModel.replace(/\[[^\]]+\]$/, "").trim();

  if (normalizedModel.endsWith("-fast")) {
    return {
      baseModel: normalizedModel.slice(0, -"-fast".length),
      enableThinking: false,
      reasoningMode: "fast",
    };
  }

  // Legacy client compatibility. These IDs are not public model variants.
  if (normalizedModel.endsWith("-no-thinking")) {
    return {
      baseModel: normalizedModel.slice(0, -"-no-thinking".length),
      enableThinking: false,
      reasoningMode: "fast",
    };
  }
  if (normalizedModel.endsWith("-thinking")) {
    return {
      baseModel: normalizedModel.slice(0, -"-thinking".length),
      enableThinking: true,
      reasoningMode: "thinking",
    };
  }

  // Default: auto thinking (Qwen decides)
  return { baseModel: normalizedModel, enableThinking: true, reasoningMode: "auto" };
}

/**
 * Mapeia o id de modelo para o Qwen upstream.
 * Ids `qwen*` passam direto (após remover o sufixo de raciocínio);
 * Mapeia aliases hipotéticos/futuros (ex: qwen3.8) para o flagship upstream atual (qwen3.7-plus).
 */
export function mapClientModelToQwen(model: string): string {
  if (!model) return model;
  return stripThinkingSuffix(model.trim()).baseModel;
}
