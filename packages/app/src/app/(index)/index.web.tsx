import React, { useState } from "react";
import { AuthenticationClientContext } from "../../authentication/authContext.js";
import SupabaseAuthenticationClient from "../../authentication/supabaseAuthenticationClient.js";
import { supabase } from "../../authentication/supabaseClient.js";
import ReviewSessionPage from "../(auth)/review.js";

// The (index) route group renders outside the (auth) layout on web,
// so we provide the auth context here directly.
export default function IndexWeb() {
  const [authenticationClient] = useState(
    () => new SupabaseAuthenticationClient(supabase),
  );
  return (
    <AuthenticationClientContext.Provider value={authenticationClient}>
      <ReviewSessionPage />
    </AuthenticationClientContext.Provider>
  );
}
