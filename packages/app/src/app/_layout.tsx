import { Slot } from "expo-router";
import React, { useState } from "react";
import { AuthenticationClientContext } from "../authentication/authContext.js";
import SupabaseAuthenticationClient from "../authentication/supabaseAuthenticationClient.js";
import { supabase } from "../authentication/supabaseClient.js";
import { initializeReporter } from "../errorReporting";
import { initIntentHandlers } from "../util/intents/IntentHandler.js";
import usePageViewTracking from "../util/usePageViewTracking";

initIntentHandlers();

export default function RootLayout() {
  usePageViewTracking();
  React.useEffect(() => {
    initializeReporter();
  }, []);

  const [authenticationClient] = useState(
    () => new SupabaseAuthenticationClient(supabase),
  );

  return (
    <AuthenticationClientContext.Provider value={authenticationClient}>
      <Slot />
    </AuthenticationClientContext.Provider>
  );
}
