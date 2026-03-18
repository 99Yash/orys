import { generateText } from "ai";

import { chatModelIdSchema } from "./models";
import { resolveChatModel } from "./provider";

export interface GenerateThreadTitleParams {
  prompt: string;
  modelId?: string;
}

export async function generateThreadTitle(
  params: GenerateThreadTitleParams,
): Promise<string> {
  const parsedModelId = params.modelId
    ? chatModelIdSchema.parse(params.modelId)
    : undefined;
  const model = resolveChatModel(parsedModelId);

  const result = await generateText({
    model,
    prompt: `Generate a concise title (max 8 words) for this conversation request:\n\n${params.prompt}`,
    maxOutputTokens: 24,
    timeout: { totalMs: 30_000 },
  });

  const cleaned = result.text.trim().replace(/^['"]+|['"]+$/g, "");
  return cleaned.length > 0 ? cleaned : "Untitled thread";
}
