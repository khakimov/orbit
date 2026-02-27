import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CF_GATEWAY_URL =
  "https://gateway.ai.cloudflare.com/v1/b846a37c6228b2869896493f338f17d5/orbit/openai/chat/completions";

const SYSTEM_PROMPT = `You generate spaced repetition flashcards from source material following Andy Matuschak's prompt-writing principles.

## Approach
1. Start with foundational details: raw facts, key terms, definitions
2. Pair factual prompts with explanation prompts -- explanations make facts meaningful
3. Each card tests ONE idea that feels like a single detail
4. Only capture non-obvious knowledge worth recalling -- skip what's trivially inferable
5. Cards MUST stand alone without ANY reference to the source. FORBIDDEN phrases: "in this context", "the passage", "the author", "this text", "here", "described as", "according to", "in the book", "the argument". Write questions as universal knowledge -- as if the reader has never seen the source and never will.

## Prompt types (use a mix)
- Factual: one discrete fact or term. Best paired with an explanation card.
  Example: Q: What are bones full of that matters for stock? A: Gelatin.
- Explanation: "Why/How does X?" -- connects facts to reasoning.
  Example: Q: How do bones produce stock's rich texture? A: They're full of gelatin.
- Procedural: one step or decision from a process. Skip obvious steps.
- Conceptual: approach an idea from a specific angle (cause, significance, contrast).
- Salience: "What should I consider when..." -- fires at real-world decision points.

## Constraints
- Answer: 1-3 sentences max
- Question: 1 sentence, unambiguous, only one correct answer possible
- Generate 3-8 cards depending on content density
- Prefer fewer, sharper cards over broad coverage
- No yes/no questions -- rephrase as open-ended
- No questions solvable by pattern-matching the question shape

If source title is provided, use it as domain context
but don't repeat it verbatim in questions.

Output ONLY valid JSON:
{ "cards": [{ "question": "...", "answer": "..." }] }`;

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
    // Validate auth
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
    const { context, sourceTitle, sourceUrl } = await req.json();
    if (!context || !context.trim()) {
      return new Response(
        JSON.stringify({ error: "context is required" }),
        { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } },
      );
    }

    const userMessage = [
      `Context: ${context.trim()}`,
      sourceTitle ? `Source: ${sourceTitle}` : null,
      sourceUrl ? `URL: ${sourceUrl}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    // Call CF AI Gateway
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
        model: "gpt-5-nano",
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
        JSON.stringify({ error: "AI generation failed", detail: errText }),
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

    let result;
    try {
      result = JSON.parse(content);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON from AI" }),
        { status: 502, headers: { ...corsHeaders(), "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-cards error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } },
    );
  }
});
