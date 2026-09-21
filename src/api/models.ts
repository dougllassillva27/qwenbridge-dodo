import { createHash } from "crypto";
import { Hono } from "hono";
import { fetchQwenModels, getAnyCachedQwenModels } from "../services/qwen.js";
import { DEFAULT_FALLBACK_MODELS } from "../core/model-alias.ts";
import { loadAccounts } from "../core/accounts.ts";
import { getAccountCooldownInfo } from "../core/account-manager.ts";
import { getAccountsByPriority } from "../core/account-priority.ts";
import { NotFoundError } from "../core/errors.js";
import { sendOpenAIError } from "./error-helpers.js";
import {
  getModelCapabilities,
  getModelContextWindow,
  syncModelMetadata,
} from "../core/model-registry.ts";
import { listMediaGenerationModels } from "../services/media-generation.ts";
import { isPlaywrightInitialized } from "../services/playwright.ts";
import { config } from "../core/config.ts";

const app = new Hono();

/**
 * Stable creation timestamp for synthetic media models.
 * Uses a fixed value so the ETag remains stable across requests.
 * 2025-01-01T00:00:00Z
 */
const MEDIA_MODELS_CREATED_AT = 1735689600;

function getPreferredModelsAccountId(): string | undefined {
  try {
    const accounts = loadAccounts();
    if (accounts.length === 0) return undefined;

    // Prefer an account whose browser is already open so the models fetch
    // reuses the running session instead of launching a new browser for a
    // standby account. Among usable accounts, follow the same priority
    // order as request routing.
    const usable = getAccountsByPriority(accounts).filter(
      (account) => !getAccountCooldownInfo(account.id),
    );
    const initialized = usable.find((account) =>
      isPlaywrightInitialized(account.id),
    );
    return (initialized || usable[0] || accounts[0]).id;
  } catch {
    return undefined;
  }
}

export type PublicModel = {
  id: string;
  name?: string;
  object?: string;
  created?: number;
  owned_by?: string;
  context_window?: number;
  is_active?: boolean;
  capabilities?: Record<string, unknown>;
  [key: string]: unknown;
};

function baseModelId(modelId: string): string {
  // Strip any reasoning suffix (-low, -medium, -high, -fast, -thinking) so the
  // public /v1/models catalog returns strictly canonical unique base models without duplicates.
  return modelId.replace(/-(?:low|medium|high|fast|no-thinking|thinking)$/, "");
}
/**
 * Verifica se o modelo pertence à geração 3.7 ou superior (ex: qwen3.7, qwen3.8, qwen4, etc.).
 * Modelos anteriores (3.6, 2.5, 2, 1.5, legacy não-versionados como qwen-plus/max/turbo, wan2.x) são filtrados.
 */
export function isModel37OrAbove(modelId: string): boolean {
  if (!modelId || typeof modelId !== "string") return false;

  const normalized = modelId
    .replace(/\[[^\]]+\]$/g, "")
    .replace(/-(?:fast|no-thinking|thinking)$/, "")
    .trim()
    .toLowerCase();

  // Procura padrão de versão numérica como:
  // qwen3.7, qwen-3.7, qwen3.8, qwen4, qwen-4.5, wan3.7, claude-3.7, claude-3-7, etc.
  const match = normalized.match(/(?:^|[a-z_-])(\d{1,2}(?:[\.-]\d+)?)(?:[a-z_-]|$)/);
  if (!match || !match[1]) {
    return false;
  }

  const versionStr = match[1].replace("-", ".");
  const versionNum = parseFloat(versionStr);

  if (isNaN(versionNum)) return false;

  return versionNum >= 3.7 && versionNum < 100;
}

/**
 * Expand the public reasoning variants from the selected account's live
 * catalog. Suffixes (-fast/-thinking) and 1M variants are synthesized
 * for high-context models.
 */
export function isMax1mFilterActive(): boolean {
  if (process.env.TEST_MOCK_QWEN_AUTH === "true") {
    return process.env.MODELS_FILTER === "max-1m";
  }
  return (process.env.MODELS_FILTER ?? config.modelsFilter) !== "all-3.7";
}

export function expandModelVariants(
  models: PublicModel[],
  accountId?: string,
): PublicModel[] {
  syncModelMetadata(
    models as unknown as Array<Record<string, unknown> & { id: string }>,
    accountId,
  );
  const baseModels = new Map<string, PublicModel>();

  for (const model of models) {
    if (!model?.id) continue;
    const baseId = baseModelId(model.id);
    if (!isModel37OrAbove(baseId)) continue;
    if (!baseModels.has(baseId)) {
      baseModels.set(baseId, {
        ...model,
        id: baseId,
        object: "model",
      });
    }
  }

  const isMax1mOnly = isMax1mFilterActive();

  if (isMax1mOnly) {
    let maxModel = baseModels.get("qwen3.8-max");
    if (!maxModel) {
      for (const [id, m] of baseModels.entries()) {
        if (id.includes("3.8-max")) {
          maxModel = m;
          break;
        }
      }
    }
    if (!maxModel) {
      maxModel = {
        id: "qwen3.8-max",
        object: "model",
        created: 1735689600,
        owned_by: "qwen",
        name: "Qwen 3.8 Max",
      };
    }

    const baseModel = { ...maxModel, id: "qwen3.8-max" };
    const variants = new Map<string, PublicModel>();
    variants.set(baseModel.id, baseModel);

    const addVariant = (suffix: string, nameSuffix: string) => {
      const id = `${baseModel.id}${suffix}`;
      if (variants.has(id)) return;
      variants.set(id, {
        ...baseModel,
        id,
        name:
          typeof baseModel.name === "string"
            ? `${baseModel.name}${nameSuffix}`
            : `${baseModel.id}${nameSuffix}`,
        object: "model",
      });
    };

    addVariant("[1M]", " [1M]");
    addVariant("-fast[1M]", " (Fast) [1M]");
    addVariant("-thinking[1M]", " (Thinking) [1M]");

    return [...variants.values()];
  }

  const variants = new Map<string, PublicModel>();
  for (const model of baseModels.values()) {
    const addVariant = (suffix: string, nameSuffix: string) => {
      const id = `${model.id}${suffix}`;
      if (variants.has(id)) return;
      variants.set(id, {
        ...model,
        id,
        name:
          typeof model.name === "string"
            ? `${model.name}${nameSuffix}`
            : `${model.id}${nameSuffix}`,
        object: "model",
      });
    };

    if (!variants.has(model.id)) variants.set(model.id, model);
    addVariant("-fast", " (Fast)");
    addVariant("-thinking", " (Thinking)");
    addVariant("[1M]", " [1M]");
    addVariant("-fast[1M]", " (Fast) [1M]");
    addVariant("-thinking[1M]", " (Thinking) [1M]");
  }

  return [...variants.values()];
}

function toAnthropicModel(model: PublicModel, accountId?: string) {
  const capabilities = getModelCapabilities(model.id, accountId);
  const isFastVariant = model.id.endsWith("-fast");
  const contextWindow =
    model.context_window ?? getModelContextWindow(model.id, accountId);

  return {
    id: model.id,
    display_name:
      typeof model.name === "string" && model.name ? model.name : model.id,
    created_at: new Date(
      typeof model.created === "number" ? model.created * 1000 : Date.now(),
    ).toISOString(),
    max_input_tokens: contextWindow,
    max_tokens: capabilities.maxOutputTokens,
    type: "model" as const,
    capabilities: {
      batch: { supported: false },
      citations: { supported: capabilities.supportsCitations },
      code_execution: { supported: capabilities.supportsCodeExecution },
      image_input: { supported: capabilities.supportsVision },
      pdf_input: { supported: capabilities.supportsDocument },
      structured_outputs: {
        supported: capabilities.supportsStructuredOutputs,
      },
      thinking: {
        supported: capabilities.supportsThinking,
        types: {
          enabled: { supported: capabilities.supportsThinking },
          disabled: {
            supported: isFastVariant || capabilities.canSkipThinking,
          },
        },
      },
      audio_input: { supported: capabilities.supportsAudio },
      video_input: { supported: capabilities.supportsVideo },
    },
  };
}

function wantsAnthropicModelsFormat(
  anthropicVersion: string | undefined | null,
): boolean {
  return !!anthropicVersion;
}

export async function loadModelsWithVariants(): Promise<{
  models: PublicModel[];
  accountId?: string;
}> {
  const accountId = getPreferredModelsAccountId();
  let models: PublicModel[] = [];
  try {
    models = (await fetchQwenModels(accountId)) as unknown as PublicModel[];
  } catch {
    const cached = getAnyCachedQwenModels();
    if (cached && cached.length > 0) {
      models = cached as unknown as PublicModel[];
    } else {
      models = DEFAULT_FALLBACK_MODELS.map((id) => ({
        id,
        object: "model",
        created: MEDIA_MODELS_CREATED_AT,
        owned_by: "qwen",
      }));
    }
  }
  const expanded = expandModelVariants(models, accountId);

  if (isMax1mFilterActive()) {
    return {
      models: expanded,
      accountId,
    };
  }

  // Advertise media generation models so clients can discover them via
  // /v1/models, including their supported generation modalities. Annotate a
  // live model in place when Qwen already returned the same ID.
  const mediaDefinitions = listMediaGenerationModels().filter((definition) =>
    isModel37OrAbove(definition.id),
  );
  const mediaById = new Map(mediaDefinitions.map((definition) => [definition.id, definition]));
  const expandedWithMedia = expanded.map((model) => {
    const definition = mediaById.get(model.id);
    if (!definition) return model;
    return {
      ...model,
      media_generation: definition.kind,
      media_modes: definition.modes,
      media_reference_required: definition.modes.every(
        (mode) => mode === "i2i" || mode === "i2v",
      ),
    };
  });
  const existing = new Set(expanded.map((model) => model.id));
  const mediaModels: PublicModel[] = mediaDefinitions
    .filter(({ id }) => !existing.has(id))
    .map(({ id, kind, modes }) => ({
      id,
      object: "model",
      created: MEDIA_MODELS_CREATED_AT,
      owned_by: "qwen",
      media_generation: kind,
      media_modes: modes,
      media_reference_required: modes.every(
        (mode) => mode === "i2i" || mode === "i2v",
      ),
    }));

  const allFilteredModels = [...expandedWithMedia, ...mediaModels].filter((model) =>
    isModel37OrAbove(model.id),
  );

  return {
    models: allFilteredModels,
    accountId,
  };
}

function findModel(
  models: PublicModel[],
  modelId: string,
): PublicModel | undefined {
  // Variants are materialized by expandModelVariants only when the live
  // catalog says they are supported. Do not synthesize an invalid variant for
  // a direct lookup.
  return models.find((entry) => entry.id === modelId);
}

const handleGetModels = async (c: any) => {
  try {
    const { models: allModels, accountId } = await loadModelsWithVariants();
    const anthropic = wantsAnthropicModelsFormat(c.req.header("anthropic-version"));

    if (anthropic) {
      return c.json({
        data: allModels.map((model) => toAnthropicModel(model, accountId)),
        has_more: false,
      });
    }

    const etag = `"${createHash("md5").update(JSON.stringify(allModels)).digest("hex")}"`;

    if (c.req.header("if-none-match") === etag) {
      return c.body(null, 304);
    }

    c.header("Cache-Control", "public, max-age=3600");
    c.header("ETag", etag);

    return c.json({
      object: "list",
      data: allModels,
    });
  } catch (error) {
    console.error("❌ [Models] Error fetching models:", error);
    return sendOpenAIError(c, error);
  }
};

app.get("/v1/models", handleGetModels);
app.get("/api/v1/models", handleGetModels);
app.get("/api/models", handleGetModels);

app.get("/api/tags", async (c) => {
  try {
    const { models: allModels } = await loadModelsWithVariants();
    return c.json({
      models: allModels.map((m) => ({
        name: m.id,
        model: m.id,
        modified_at: new Date(1735689600000).toISOString(),
        size: 0,
        digest: "sha256:qwenbridge",
        details: {
          parent_model: "",
          format: "gguf",
          family: "qwen",
          families: ["qwen"],
          parameter_size: "32B",
          quantization_level: "Q4_K_M"
        }
      }))
    });
  } catch (error) {
    return c.json({ models: [] });
  }
});

const handleGetSingleModel = async (c: any) => {
  try {
    const modelId = c.req.param("model");
    const { models: allModels, accountId } = await loadModelsWithVariants();
    const model = findModel(allModels, modelId);
    const anthropic = wantsAnthropicModelsFormat(c.req.header("anthropic-version"));

    if (!model) {
      if (anthropic) {
        return c.json(
          {
            type: "error",
            error: {
              type: "not_found_error",
              message: `Model '${modelId}' not found`,
            },
          },
          404,
        );
      }
      return sendOpenAIError(c, new NotFoundError("Model not found"));
    }

    if (anthropic) {
      return c.json(toAnthropicModel(model, accountId));
    }

    return c.json(model);
  } catch (error) {
    console.error("❌ [Models] Error fetching model:", error);
    return sendOpenAIError(c, error);
  }
};

app.get("/v1/models/:model", handleGetSingleModel);
app.get("/api/v1/models/:model", handleGetSingleModel);
app.get("/api/models/:model", handleGetSingleModel);


export { app };
