import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CF_GATEWAY_URL =
  "https://gateway.ai.cloudflare.com/v1/b846a37c6228b2869896493f338f17d5/orbit/openai/chat/completions";

const SYSTEM_PROMPT = `You review spaced repetition flashcards using Andy Matuschak's prompt-writing principles.

## Five required properties
1. Focused -- one idea per card. If the answer covers multiple facts, the card should be split.
2. Precise -- unambiguous what to recall. Only one correct answer should be possible.
3. Consistent -- same answer every review. If you'd recall different subsets each time, it's too broad.
4. Tractable -- answerable ~90% of the time. Light cues are fine if they don't solve the puzzle.
5. Effortful -- genuine recall, not trivial inference or pattern-matching on question shape.

## Prompt types (recognise and don't penalise valid use)
- Factual: one discrete fact. Best paired with an explanation card.
- Explanation: "Why/how does X?" -- connects facts to reasoning. Answers reveal mechanisms, not just restate facts.
- Cloze: fill-in-the-blank with "???". One deletion per card. Cues should hint, not solve.
- Procedural: keywords from a process (verbs, conditions, timing). One step/decision per card. Skip trivially inferable steps.
- Conceptual: approach one idea from multiple lenses (attributes, similarities, causes, parts, significance).
- Salience/behavioral: "What should I ask myself when..." -- fires at real-world decision points.
- Creative: novel answer each time. Not standard retrieval; judge by usefulness + clarity.
- Mnemonic: goal is the association itself, not domain accuracy.
- Open-list: "Name two examples of..." -- don't require exhaustive enumeration.

## Anti-patterns to flag
- Too broad / kitchen-sink: question or answer covers multiple ideas. Suggest splitting with 2-3 example card titles.
- Binary/yes-no: shallow retrieval. Rephrase as open-ended.
- Vague question: multiple valid answers possible. Narrow the scope.
- Cue gives it away: "(rhymes with parrots)" solves the puzzle. Use category hints instead: "(root vegetable)".
- Pattern-matching: long distinctive question memorised by shape. Keep questions short.
- Fact without understanding: isolated fact with no explanation pair. Suggest adding a "why" card.
- Trivially inferable: don't make cards for obvious steps. Focus on non-obvious knowledge.
- Answer too long: should be 1-3 sentences max. If longer, split.

## Do / Don't examples

Broad -> split:
- DONT: Q "How do you make chicken stock?" A "Combine 2 lbs bones with water, add onion, carrots..."
- DO: Q "At what speed should you heat chicken stock?" A "Slowly." (one card per keyword)

Binary -> open:
- DONT: Q "Does stock make vegetables taste like chicken?" A "No."
- DO: Q "How does chicken stock affect vegetable flavour?" A "Makes them taste more complete."

Fact -> fact + explanation:
- DONT (alone): Q "What parts are used in stock?" A "Bones."
- DO (pair): same card PLUS Q "How do bones produce stock's rich texture?" A "They're full of gelatin."

Rote -> salience:
- DONT (only): Q "What can replace water in cooking?" A "Stock."
- DO (add): Q "What should I ask myself when reaching for water in savoury cooking?" A "Should I use stock instead?"

## Output format
Return ONLY valid JSON:
{
  "verdict": "good" | "needs_work" | "poor",
  "summary": string,
  "issues": [{"category":"clarity"|"ambiguity"|"completeness"|"accuracy"|"formatting","description":string,"suggestion":string}],
  "rewrite"?: {"question"?: string, "answer"?: string}
}

## Verdict
- good: satisfies all five properties for its prompt type. Ready to study.
- needs_work: mostly fine but could be tighter (scope, wording, precision).
- poor: fails multiple properties -- too broad, uncheckable, trivially inferable, or misleading.

## Rules
- Be concise and specific. No filler.
- Only flag "completeness" if the card is genuinely uncheckable without the missing info.
- Only flag "accuracy" if the card states something likely factually wrong.
- Rewrites MUST be focused on ONE idea. Never broader or longer than the original.
- If a card needs splitting, say so in issues with 2-3 example card titles. Do NOT rewrite into one giant card.
- Rewrites: question ~1 sentence, answer ~1-3 sentences max.
- When a factual card lacks a "why" companion, mention it as a suggestion, not an issue.`;

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
