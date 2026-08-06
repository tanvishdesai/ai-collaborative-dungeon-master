"use node";

import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

const GENERATION_TIMEOUT_MS = 45_000;

export type AiProvider = "gemini" | "groq" | "nvidia";

const DEFAULT_PROVIDER_ORDER: AiProvider[] = ["gemini", "groq", "nvidia"];

export function getPreferredProvider(): AiProvider {
  const requested = process.env.AI_PROVIDER?.toLowerCase();
  return DEFAULT_PROVIDER_ORDER.includes(requested as AiProvider)
    ? (requested as AiProvider)
    : "gemini";
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("AI request timed out")), ms),
    ),
  ]);
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Model did not return valid JSON.");
  }
}

async function callGemini(
  prompt: string,
  temperature: number,
  responseSchema: Record<string, unknown>,
): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

  const client = new GoogleGenAI({ apiKey });
  const response = await withTimeout(
    client.models.generateContent({
      model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema,
        temperature,
      },
    }),
    GENERATION_TIMEOUT_MS,
  );

  if (!response.text) throw new Error("Empty response from Gemini.");
  return parseJsonObject(response.text);
}

/** Shared caller for OpenAI-compatible providers (NVIDIA, Groq) that don't support a native response_schema. */
async function callOpenAiCompatible(
  providerName: string,
  baseURL: string,
  apiKey: string,
  model: string,
  prompt: string,
  temperature: number,
  responseSchema: Record<string, unknown>,
): Promise<unknown> {
  const client = new OpenAI({ apiKey, baseURL });

  const completion = await withTimeout(
    client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            `You are a JSON API. Reply with a single valid JSON object only, matching this JSON schema exactly: ${JSON.stringify(responseSchema)}. No markdown, no prose outside JSON.`,
        },
        { role: "user", content: prompt },
      ],
      temperature,
      top_p: 1,
      max_tokens: 4096,
      stream: false,
    }),
    GENERATION_TIMEOUT_MS,
  );

  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error(`Empty response from ${providerName}.`);
  return parseJsonObject(text);
}

function callNvidia(
  prompt: string,
  temperature: number,
  responseSchema: Record<string, unknown>,
): Promise<unknown> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("NVIDIA_API_KEY is not configured.");
  return callOpenAiCompatible(
    "NVIDIA",
    "https://integrate.api.nvidia.com/v1",
    apiKey,
    process.env.NVIDIA_MODEL ?? "z-ai/glm-5.2",
    prompt,
    temperature,
    responseSchema,
  );
}

function callGroq(
  prompt: string,
  temperature: number,
  responseSchema: Record<string, unknown>,
): Promise<unknown> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured.");
  return callOpenAiCompatible(
    "Groq",
    "https://api.groq.com/openai/v1",
    apiKey,
    process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
    prompt,
    temperature,
    responseSchema,
  );
}

function providerOrder(preferred: AiProvider): AiProvider[] {
  return [preferred, ...DEFAULT_PROVIDER_ORDER.filter((p) => p !== preferred)];
}

const GEMINI_RETRY_BACKOFFS_MS = [500, 1500];

/** Retries Gemini on transient failures (429/5xx/timeout) before the caller falls through to the other provider. */
async function callGeminiWithRetry(
  prompt: string,
  temperature: number,
  responseSchema: Record<string, unknown>,
): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= GEMINI_RETRY_BACKOFFS_MS.length; attempt++) {
    try {
      return await callGemini(prompt, temperature, responseSchema);
    } catch (error) {
      lastError = error;
      const backoff = GEMINI_RETRY_BACKOFFS_MS[attempt];
      if (backoff === undefined) break;
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }
  throw lastError;
}

/** Call preferred provider; on failure try the other if its key is set. */
export async function generateJson(
  prompt: string,
  temperature: number,
  responseSchema: Record<string, unknown>,
): Promise<unknown> {
  const errors: string[] = [];

  for (const provider of providerOrder(getPreferredProvider())) {
    try {
      if (provider === "gemini") {
        if (!process.env.GEMINI_API_KEY) continue;
        return await callGeminiWithRetry(prompt, temperature, responseSchema);
      }
      if (provider === "groq") {
        if (!process.env.GROQ_API_KEY) continue;
        return await callGroq(prompt, temperature, responseSchema);
      }
      if (!process.env.NVIDIA_API_KEY) continue;
      return await callNvidia(prompt, temperature, responseSchema);
    } catch (error) {
      errors.push(
        `${provider}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  throw new Error(
    errors.length
      ? `All AI providers failed. ${errors.join(" | ")}`
      : "No AI provider configured (set GEMINI_API_KEY, GROQ_API_KEY, and/or NVIDIA_API_KEY).",
  );
}
