import { Slot } from "expo-router";
import React, { useState } from "react";
import { AuthenticationClientContext } from "../../authentication/authContext.js";
import SupabaseAuthenticationClient from "../../authentication/supabaseAuthenticationClient.js";
import { supabase } from "../../authentication/supabaseClient.js";

export default function RootLayout() {
  const [authenticationClient] = useState(
    () => new SupabaseAuthenticationClient(supabase),
  );
  return (
    <AuthenticationClientContext.Provider value={authenticationClient}>
      <Slot />
    </AuthenticationClientContext.Provider>
  );
}
