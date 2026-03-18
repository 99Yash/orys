import { convertToModelMessages, streamText, type UIMessage } from "ai";

import { chatModelIdSchema } from "./models";
import { resolveChatModel } from "./provider";

export interface StreamChatParams {
  messages: UIMessage[];
  system?: string;
  modelId?: string;
  headers?: Record<string, string>;
  maxOutputTokens?: number;
}

export async function createChatStream(params: StreamChatParams): Promise<Response> {
  const parsedModelId = params.modelId
    ? chatModelIdSchema.parse(params.modelId)
    : undefined;
  const model = resolveChatModel(parsedModelId);
  const startTime = Date.now();
  const modelMessages = await convertToModelMessages(params.messages);

  const result = streamText({
    model,
    system: params.system,
    messages: modelMessages,
    maxOutputTokens: params.maxOutputTokens,
    timeout: { totalMs: 120_000 },
  });

  return result.toUIMessageStreamResponse({
    headers: params.headers,
    originalMessages: params.messages,
    messageMetadata: ({ part }) => {
      if (part.type !== "finish") return undefined;

      return {
        durationMs: Date.now() - startTime,
        finishReason: part.finishReason,
        modelId: parsedModelId,
      };
    },
    onError: (error) => {
      if (error instanceof Error && error.name === "AbortError") {
        return "Response timed out. Please try again.";
      }

      return error instanceof Error
        ? error.message
        : "An unexpected error occurred.";
    },
  });
}
