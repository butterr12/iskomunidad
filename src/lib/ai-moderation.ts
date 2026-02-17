import OpenAI from "openai";
import {
  type ModerationPreset,
  getModerationPreset,
  getCustomModerationRules,
} from "@/actions/_helpers";

type ContentType = "post" | "comment" | "gig" | "event";

interface ModerationInput {
  type: ContentType;
  title?: string;
  body?: string;
  [key: string]: unknown;
}

interface ModerationResult {
  approved: boolean;
  reason?: string;
}

const PRESET_PROMPTS: Record<ModerationPreset, string> = {
  strict: `Reject content that contains:
- Spam or promotional content
- Hate speech or discrimination
- Explicit or sexual content
- Scams or fraudulent offers
- Harassment or bullying
- Dangerous or illegal content
- Gibberish or nonsensical text`,

  moderate: `Reject content that contains:
- NSFW or sexually explicit content
- Spam or promotional content
- Scams or fraudulent offers
- Personal attacks or targeted harassment directed at specific individuals
- Dangerous or illegal content
- Gibberish or nonsensical text

Allow content that:
- Expresses frustration, anger, or strong emotions as long as it is not directed at specific individuals
- Contains strong opinions or criticism of policies, systems, or institutions`,

  relaxed: `Reject content that contains:
- NSFW or sexually explicit content
- Targeted harassment directed at specific individuals
- Scams, fraud, or illegal activity

Allow most other content including strong opinions, frustration, and emotional expression.`,
};

async function getModerationGuidelines(): Promise<string> {
  const preset = await getModerationPreset();
  const customRules = await getCustomModerationRules();

  let guidelines = PRESET_PROMPTS[preset];
  if (customRules) {
    guidelines += `\n\nAdditional rules:\n${customRules}`;
  }
  return guidelines;
}

export async function moderateContent(
  input: ModerationInput,
): Promise<ModerationResult> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return { approved: true };

    const openai = new OpenAI({ apiKey });

    const contentParts: string[] = [];
    if (input.title) contentParts.push(`Title: ${input.title}`);
    if (input.body) contentParts.push(`Body: ${input.body}`);
    if (contentParts.length === 0) return { approved: true };

    const guidelines = await getModerationGuidelines();

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 200,
      messages: [
        {
          role: "system",
          content: `You are a content moderator for a Philippine university campus community platform. Review the following ${input.type} content and determine if it should be approved or rejected.

${guidelines}

Respond with JSON only: { "approved": true } or { "approved": false, "reason": "brief explanation" }`,
        },
        {
          role: "user",
          content: contentParts.join("\n"),
        },
      ],
      response_format: { type: "json_object" },
    });

    const text = response.choices[0]?.message?.content;
    if (!text) return { approved: true };

    const parsed = JSON.parse(text) as ModerationResult;
    return {
      approved: parsed.approved,
      reason: parsed.reason,
    };
  } catch {
    // On any error, default to approved so users aren't blocked by AI downtime
    return { approved: true };
  }
}
