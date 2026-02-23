import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CF_GATEWAY_URL =
  "https://gateway.ai.cloudflare.com/v1/b846a37c6228b2869896493f338f17d5/orbit/openai/chat/completions";

const SYSTEM_PROMPT = `You are a flashcard quality reviewer for spaced repetition prompts.

You MUST follow the "retrieval practice prompt" principles:
- Focused: test one idea/detail at a time.
- Precise: clear what to recall; avoid vague prompts.
- Consistent: should elicit the same target answer each review.
- Tractable: should usually be answerable (may include light cues).
- Effortful: should require recall, not be trivially inferable.
- Do NOT demand extra context/explanations unless the card's stated goal is explanation.

Allowed prompt styles (do not penalize merely for using them):
- Cloze / fill-in-the-blank with "???".
- Keyword/outlines for procedures.
- Mnemonic-device cards whose goal is remembering an association (not culinary accuracy).
- Salience/behavioral prompts ("What should I ask myself when...").
- Creative prompts that request a novel answer each time (note: these are NOT retrieval practice; judge them by usefulness + clarity).

Given Question/Answer/(optional Context), return ONLY valid JSON:
{
  "verdict": "good" | "needs_work" | "poor",
  "summary": string,
  "issues": [
    {"category":"clarity"|"ambiguity"|"completeness"|"accuracy"|"formatting","description":string,"suggestion":string}
  ],
  "rewrite"?: {"question"?: string, "answer"?: string}
}

Rubric:
- good: aligned with intended prompt style; focused; clear; checkable.
- needs_work: mostly fine but could be tighter (scope, wording, checkability).
- poor: wrong target, too broad, inconsistent, uncheckable, or misleading.

Rules:
- Be concise. No filler.
- Only flag "completeness" if something essential to answer/check the card is missing.
- Only flag "accuracy" if the card makes a factual claim that's likely wrong (not just missing extra facts).
- "rewrite" only if you would actually change wording.`;

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    // Validate auth -- the Authorization header carries the user's Supabase JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders(), "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("Auth failed:", authError?.message, "header:", authHeader.substring(0, 30) + "...");
      return new Response(
        JSON.stringify({ error: "Invalid token", detail: authError?.message }),
        { status: 401, headers: { ...corsHeaders(), "Content-Type": "application/json" } },
      );
    }

    // Parse request body
    const { question, answer, context } = await req.json();
    if (!question || !answer) {
      return new Response(
        JSON.stringify({ error: "question and answer are required" }),
        { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } },
      );
    }

    const userMessage = [
      `Question: ${question}`,
      `Answer: ${answer}`,
      context ? `Context: ${context}` : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    // Call CF AI Gateway (BYOK -- OpenAI key injected by CF)
    const cfAigToken = Deno.env.get("CF_AIG_TOKEN");
    if (!cfAigToken) {
      return new Response(
        JSON.stringify({ error: "AI gateway not configured" }),
        { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } },
      );
    }

    const aiResponse = await fetch(CF_GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "cf-aig-authorization": `Bearer ${cfAigToken}`,
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("CF AI Gateway error:", aiResponse.status, errText);
      return new Response(
        JSON.stringify({ error: "AI review failed", detail: errText }),
        { status: 502, headers: { ...corsHeaders(), "Content-Type": "application/json" } },
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(
        JSON.stringify({ error: "Empty AI response" }),
        { status: 502, headers: { ...corsHeaders(), "Content-Type": "application/json" } },
      );
    }

    const review = JSON.parse(content);

    return new Response(JSON.stringify(review), {
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("review-card error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } },
    );
  }
});
