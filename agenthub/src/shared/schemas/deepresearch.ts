import { z } from "zod";
import { ModelIdSchema } from "./playgroundResponse";

export const DeepResearchRequestSchema = z.object({
  model: ModelIdSchema,
  prompt: z.string().min(1).max(50000),
});

export type DeepResearchRequest = z.infer<typeof DeepResearchRequestSchema>;
