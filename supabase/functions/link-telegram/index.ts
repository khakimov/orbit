import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const BOT_USERNAME = Deno.env.get("TELEGRAM_BOT_USERNAME");
if (!BOT_USERNAME) {
  console.error("TELEGRAM_BOT_USERNAME env var is not set");
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
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

    // All actions via POST body to avoid CORS preflight issues with DELETE/GET.
    // supabase.functions.invoke() always sends POST.
    const body = await req.json().catch(() => ({}));
    const action = (body as Record<string, unknown>).action ?? "status";

    // status -- return current linking status
    if (action === "status") {
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

    // link -- generate a linking token and return a deep link
    if (action === "link") {
      // Rate limit: one token per 60 seconds
      const { data: existing } = await serviceClient
        .from("user_profiles")
        .select("updated_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing?.updated_at) {
        const elapsed = Date.now() - new Date(existing.updated_at).getTime();
        if (elapsed < 60_000) {
          return jsonResponse({ error: "Please wait before generating a new link" }, 429);
        }
      }

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

      if (!BOT_USERNAME) {
        return jsonResponse({ error: "Bot not configured" }, 500);
      }
      const deepLink = `https://t.me/${BOT_USERNAME}?start=${token}`;
      return jsonResponse({ deep_link: deepLink, expires_at: expiresAt });
    }

    // unlink -- remove Telegram account binding
    if (action === "unlink") {
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

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("link-telegram error:", err);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
