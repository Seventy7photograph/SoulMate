import { z } from "zod";

export const emotionSchema = z.enum([
  "IDLE",
  "HAPPY",
  "SHY",
  "SAD",
  "SLEEPY",
  "ANGRY",
]);

export const actionSchema = z.enum([
  "IDLE",
  "JUMP",
  "DANCE",
  "WAVE",
  "PUNCH",
  "SIT",
]);

export const aiAnalysisSchema = z.object({
  emotion: emotionSchema,
  action: actionSchema,
  reply: z.string().trim().min(1).max(160),
  confidence: z.number().min(0).max(1),
  provider: z.string().min(1).max(40).default("local"),
});

export type AiAnalysisResponse = z.infer<typeof aiAnalysisSchema>;

