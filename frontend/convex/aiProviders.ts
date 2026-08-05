"use node";

import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

const GENERATION_TIMEOUT_MS = 20_000;

export type AiProvider = "gemini" | "nvidia";

export function getPreferredProvider(): AiProvider {
  return process.env.AI_PROVIDER?.toLowerCase() === "nvidia"
    ? "nvidia"
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

async function callNvidia(prompt: string, temperature: number): Promise<unknown> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("NVIDIA_API_KEY is not configured.");

  const client = new OpenAI({
    apiKey,
    baseURL: "https://integrate.api.nvidia.com/v1",
  });

  const completion = await withTimeout(
    client.chat.completions.create({
      model: process.env.NVIDIA_MODEL ?? "z-ai/glm-5.2",
      messages: [
        {
          role: "system",
          content:
            "You are a JSON API. Reply with a single valid JSON object only. No markdown, no prose outside JSON.",
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
  if (!text) throw new Error("Empty response from NVIDIA.");
  return parseJsonObject(text);
}

function providerOrder(preferred: AiProvider): AiProvider[] {
  return preferred === "nvidia" ? ["nvidia", "gemini"] : ["gemini", "nvidia"];
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
        return await callGemini(prompt, temperature, responseSchema);
      }
      if (!process.env.NVIDIA_API_KEY) continue;
      return await callNvidia(prompt, temperature);
    } catch (error) {
      errors.push(
        `${provider}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  throw new Error(
    errors.length
      ? `All AI providers failed. ${errors.join(" | ")}`
      : "No AI provider configured (set GEMINI_API_KEY and/or NVIDIA_API_KEY).",
  );
}
