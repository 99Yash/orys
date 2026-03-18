export { AIError, StreamingError } from "./errors";

export {
  WORD_LIMIT_OPTIONS,
  DEFAULT_WORD_LIMIT,
  HARD_WORD_CAP,
  wordLimitToMaxTokens,
} from "./limits";
export type { WordLimitOption } from "./limits";

export {
  MODEL_REGISTRY,
  DEFAULT_CHAT_MODEL_ID,
  VALID_CHAT_MODEL_IDS,
  chatModelIdSchema,
} from "./models";
export type { ChatModelId, ModelDescriptor } from "./models";

export {
  resolveChatModel,
  EMBEDDING_MODEL_NAME,
  EMBEDDING_DIMENSIONS,
  embeddingModel,
} from "./provider";

export { finishReasonSchema, chatMetadataSchema } from "./schemas";

export { createChatStream } from "./stream";
export type { StreamChatParams } from "./stream";

export { generateThreadTitle } from "./title";
export type { GenerateThreadTitleParams } from "./title";

export type { OrysChatMetadata, OrysChatDataParts, OrysMessage } from "./types";
