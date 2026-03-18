import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import type { EmbeddingModel, LanguageModel } from "ai";

import { DEFAULT_CHAT_MODEL_ID, type ChatModelId } from "./models";

type ProviderId = "openai" | "google";

function splitModelId(modelId: ChatModelId): {
  provider: ProviderId;
  model: string;
} {
  const separatorIndex = modelId.indexOf(":");
  const provider = modelId.slice(0, separatorIndex) as ProviderId;
  const model = modelId.slice(separatorIndex + 1);

  return { provider, model };
}

export function resolveChatModel(
  modelId: ChatModelId = DEFAULT_CHAT_MODEL_ID,
): LanguageModel {
  const { provider, model } = splitModelId(modelId);

  switch (provider) {
    case "openai":
      return openai(model);
    case "google":
      return google(model);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

export const EMBEDDING_MODEL_NAME = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

export const embeddingModel: EmbeddingModel =
  openai.embeddingModel(EMBEDDING_MODEL_NAME);
