import { Link, Spacer, styles } from "@withorbit/ui";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  Text,
  View,
} from "react-native";
import {
  useAuthenticationClient,
  useCurrentUserRecord,
} from "../../authentication/authContext.js";
import { supabase } from "../../authentication/supabaseClient.js";

interface TelegramStatus {
  linked: boolean;
  telegram_username: string | null;
  telegram_linked_at: string | null;
}

const palette = styles.colors.palettes.lime;

function TelegramLinking({ userId }: { userId: string }) {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "link-telegram",
        { body: { action: "status" } },
      );
      if (fnError) throw fnError;
      setStatus(data as TelegramStatus);
    } catch (e) {
      console.error("Failed to fetch Telegram status:", e);
      setError("Could not load Telegram status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleLink = useCallback(async () => {
    setActionLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "link-telegram",
        { body: { action: "link" } },
      );
      if (fnError) {
        const msg = (data as any)?.error;
        throw new Error(msg ?? fnError.message);
      }
      const deepLink = (data as { deep_link: string }).deep_link;
      await Linking.openURL(deepLink);
      // Poll for completion after a short delay
      setTimeout(() => fetchStatus(), 5000);
    } catch (e) {
      console.error("Failed to generate linking token:", e);
      const msg = e instanceof Error ? e.message : "Failed to start linking.";
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  }, [fetchStatus]);

  const handleUnlink = useCallback(async () => {
    setActionLoading(true);
    setError(null);
    try {
      const { error: fnError } = await supabase.functions.invoke(
        "link-telegram",
        { body: { action: "unlink" } },
      );
      if (fnError) throw fnError;
      setStatus({ linked: false, telegram_username: null, telegram_linked_at: null });
    } catch (e) {
      console.error("Failed to unlink Telegram:", e);
      setError("Failed to unlink. Please try again.");
    } finally {
      setActionLoading(false);
    }
  }, []);

  if (loading) {
    return <ActivityIndicator />;
  }

  return (
    <View>
      <Text style={[styles.type.label.layoutStyle, { marginBottom: 8 }]}>
        Telegram
      </Text>
      {status?.linked ? (
        <View>
          <Text style={styles.type.runningText.layoutStyle}>
            Linked to @{status.telegram_username ?? "unknown"}
          </Text>
          <Spacer units={2} />
          <Pressable
            onPress={handleUnlink}
            disabled={actionLoading}
            style={({ pressed }) => [
              buttonStyle,
              pressed && { opacity: 0.7 },
              actionLoading && { opacity: 0.5 },
            ]}
          >
            <Text style={buttonTextStyle}>
              {actionLoading ? "Unlinking..." : "Unlink Telegram"}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View>
          <Text style={styles.type.runningText.layoutStyle}>
            Link your Telegram account to review cards via the Orbit bot.
          </Text>
          <Spacer units={2} />
          <Pressable
            onPress={handleLink}
            disabled={actionLoading}
            style={({ pressed }) => [
              buttonStyle,
              pressed && { opacity: 0.7 },
              actionLoading && { opacity: 0.5 },
            ]}
          >
            <Text style={buttonTextStyle}>
              {actionLoading ? "Opening Telegram..." : "Link Telegram"}
            </Text>
          </Pressable>
        </View>
      )}
      {error && (
        <>
          <Spacer units={2} />
          <Text style={[styles.type.runningText.layoutStyle, { color: "#c00" }]}>
            {error}
          </Text>
        </>
      )}
    </View>
  );
}

// Legacy action handler (email unsubscribe/snooze)
function LegacyAction() {
  const { message, headline } = React.useMemo(() => {
    const url = new URL(location.href);
    const params = url.searchParams;
    const action = params.get("completedAction");
    switch (action) {
      case "unsubscribe":
        return {
          message: (
            <>
              You&rsquo;ve been unsubscribed from review session notifications.{" "}
              <Link href="mailto:contact@withorbit.com">Email us</Link> to
              resubscribe.
            </>
          ),
          headline: "Got it.",
        };
      case "snooze1Week":
        return {
          message: <>We won&rsquo;t send notifications for a week.</>,
          headline: "Got it.",
        };
      default:
        return null as never;
    }
  }, []);

  return (
    <>
      <Text style={styles.type.headline.layoutStyle}>{headline}</Text>
      <Spacer units={4} />
      <Text style={styles.type.runningText.layoutStyle}>{message}</Text>
    </>
  );
}

export default function SettingsPage() {
  const authenticationClient = useAuthenticationClient();
  const userRecord = useCurrentUserRecord(authenticationClient);

  // Check if this is a legacy action URL
  const isLegacyAction =
    typeof location !== "undefined" &&
    new URL(location.href).searchParams.has("completedAction");

  return (
    <View
      style={{
        backgroundColor: palette.backgroundColor,
        flex: 1,
        padding: styles.layout.edgeMargin,
      }}
    >
      <View style={{ width: "100%", maxWidth: 500, margin: "auto" }}>
        {isLegacyAction ? (
          <LegacyAction />
        ) : (
          <>
            <Text style={styles.type.headline.layoutStyle}>Settings</Text>
            <Spacer units={6} />
            {userRecord ? (
              <>
                <Text style={styles.type.runningText.layoutStyle}>
                  {userRecord.emailAddress}
                </Text>
                <Spacer units={6} />
                <TelegramLinking userId={userRecord.userID} />
              </>
            ) : (
              <Text style={styles.type.runningText.layoutStyle}>
                Sign in to manage settings.
              </Text>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const buttonStyle = {
  backgroundColor: "#1a1a1a",
  paddingHorizontal: 16,
  paddingVertical: 10,
  borderRadius: 6,
  alignSelf: "flex-start" as const,
};

const buttonTextStyle = {
  color: "#fff",
  fontSize: 14,
  fontWeight: "600" as const,
};
