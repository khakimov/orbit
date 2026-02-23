import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const BOT_USERNAME = Deno.env.get("TELEGRAM_BOT_USERNAME") ?? "OrbitReviewBot";

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

function generateToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  // Base64url-encode (no padding) -- yields a 24-char alphanumeric token
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    // Authenticate the calling user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "Invalid token" }, 401);
    }

    // Service-role client for upsert (RLS applies to user client, but we need
    // to upsert even when the row doesn't exist yet)
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const method = req.method;

    // GET -- return current linking status
    if (method === "GET") {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("telegram_chat_id, telegram_username, telegram_linked_at")
        .eq("user_id", user.id)
        .maybeSingle();

      return jsonResponse({
        linked: !!profile?.telegram_chat_id,
        telegram_username: profile?.telegram_username ?? null,
        telegram_linked_at: profile?.telegram_linked_at ?? null,
      });
    }

    // POST -- generate a linking token and return a deep link
    if (method === "POST") {
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

      const { error: upsertError } = await serviceClient
        .from("user_profiles")
        .upsert(
          {
            user_id: user.id,
            linking_token: token,
            linking_token_expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );

      if (upsertError) {
        console.error("Upsert error:", upsertError);
        return jsonResponse({ error: "Failed to generate token" }, 500);
      }

      const deepLink = `https://t.me/${BOT_USERNAME}?start=${token}`;
      return jsonResponse({ deep_link: deepLink, expires_at: expiresAt });
    }

    // DELETE -- unlink Telegram account
    if (method === "DELETE") {
      const { error: updateError } = await serviceClient
        .from("user_profiles")
        .update({
          telegram_chat_id: null,
          telegram_username: null,
          telegram_linked_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (updateError) {
        console.error("Unlink error:", updateError);
        return jsonResponse({ error: "Failed to unlink" }, 500);
      }

      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (err) {
    console.error("link-telegram error:", err);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
