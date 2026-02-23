import { Slot } from "expo-router";
import React, { useState } from "react";
import { AuthenticationClientContext } from "../../authentication/authContext.js";
import LocalAuthenticationClient from "../../authentication/localAuthenticationClient.js";

export default function RootLayout() {
  const [authenticationClient] = useState(
    () => new LocalAuthenticationClient(),
  );
  return (
    <AuthenticationClientContext.Provider value={authenticationClient}>
      <Slot />
    </AuthenticationClientContext.Provider>
  );
}
