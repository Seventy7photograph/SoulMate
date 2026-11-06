import type { EmotionResult } from "../domain/companionEngine";
import {
  aiAnalysisSchema,
  type AiAnalysisResponse,
} from "./schemas";

const apiBase = import.meta.env.VITE_API_BASE ?? "";

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timer);
  }
}

export async function analyzeMessage(
  text: string,
  context?: {
    systemInstruction?: string;
    displayName?: string;
    bio?: string;
  },
): Promise<AiAnalysisResponse & { durationMs: number }> {
  const startedAt = performance.now();
  const response = await fetchWithTimeout(
    `${apiBase}/api/analyze`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        systemInstruction: context?.systemInstruction ?? "",
        displayName: context?.displayName ?? "",
        bio: context?.bio ?? "",
      }),
    },
    4000,
  );

  if (!response.ok) {
    throw new Error(`AI request failed with ${response.status}`);
  }

  const payload: unknown = await response.json();
  const parsed = aiAnalysisSchema.parse(payload);
  return {
    ...parsed,
    durationMs: Math.round(performance.now() - startedAt),
  };
}

export interface ServerPreferences {
  displayName: string;
  accentColor: string;
  bio: string;
  sceneId: string;
  characterId: string;
}

export async function savePreferences(
  preferences: ServerPreferences,
): Promise<void> {
  const response = await fetchWithTimeout(
    `${apiBase}/api/preferences`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(preferences),
    },
    2500,
  );

  if (!response.ok) {
    throw new Error(`Preference sync failed with ${response.status}`);
  }
}

export async function loadPreferences(): Promise<ServerPreferences | null> {
  const response = await fetchWithTimeout(
    `${apiBase}/api/preferences`,
    {
      method: "GET",
    },
    2500,
  );

  if (!response.ok) {
    throw new Error(`Preference load failed with ${response.status}`);
  }

  const payload: unknown = await response.json();
  if (payload === null) {
    return null;
  }
  return payload as ServerPreferences;
}

export async function persistEvent(payload: {
  source: string;
  type: string;
  label: string;
  detail: string;
  emotion: string;
  action: string;
  sceneId: string;
  characterId: string;
  status: string;
}): Promise<void> {
  const response = await fetchWithTimeout(
    `${apiBase}/api/events`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    2500,
  );

  if (!response.ok) {
    throw new Error(`Event sync failed with ${response.status}`);
  }
}

export function toEmotionResult(
  response: AiAnalysisResponse,
): EmotionResult {
  return {
    emotion: response.emotion,
    action: response.action,
    reply: response.reply,
    confidence: response.confidence,
  };
}

