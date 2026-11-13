import { DISCLAIMER } from "@fp/shared";
import { z } from "zod";
import type { Metrics, PlanBody, ProfileInput } from "./types";
import { buildRulesPlan } from "./rules";

const actionSchema = z.object({
  title: z.string().trim().min(1).max(160),
  detail: z.string().trim().min(1).max(1000),
  priority: z.enum(["high", "medium", "low"]),
});

const aiSchema = z.object({
  summary: z.string().trim().min(1).max(2000),
  actions: z.array(actionSchema).min(1).max(8),
  assumptions: z.array(z.string().trim().min(1).max(400)).min(1).max(8),
});

export function parseAiPlan(text: string): PlanBody {
  const fenced = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed = aiSchema.parse(JSON.parse(fenced));
  return {
    summary: parsed.summary,
    actions: parsed.actions,
    assumptions: parsed.assumptions,
    disclaimer: DISCLAIMER,
  };
}

export async function requestAiPlan(metrics: Metrics, profile: ProfileInput): Promise<PlanBody> {
  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You write an educational household planning note from supplied figures. Use only those figures. Do not invent accounts, returns, or product recommendations. Respond with JSON: {\"summary\": string, \"actions\": [{\"title\": string, \"detail\": string, \"priority\": \"high\"|\"medium\"|\"low\"}], \"assumptions\": string[]}.",
        },
        {
          role: "user",
          content: JSON.stringify({ profile, metrics }),
        },
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`AI provider returned ${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = payload.choices?.[0]?.message?.content;
  if (!text) throw new Error("AI provider returned an empty plan");
  return parseAiPlan(text);
}

export async function createPlanBody(
  metrics: Metrics,
  profile: ProfileInput,
): Promise<{ body: PlanBody; source: "ai" | "rules" }> {
  if (!process.env.OPENAI_API_KEY) {
    return { body: buildRulesPlan(metrics, profile), source: "rules" };
  }
  try {
    return { body: await requestAiPlan(metrics, profile), source: "ai" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI provider failed";
    console.warn(`Falling back to the rules planner: ${message}`);
    return { body: buildRulesPlan(metrics, profile), source: "rules" };
  }
}
