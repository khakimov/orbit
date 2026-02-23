import * as Authentication from "../authentication/index.js";
import React from "react";

export type EmbeddedAuthenticationState =
  | {
      status: "pending" | "signedOut";
      userRecord: null;
    }
  | {
      status: "storageRestricted";
      userRecord: null;
      onRequestStorageAccess: () => unknown;
    }
  | { status: "signedIn"; userRecord: Authentication.UserRecord };
export type EmbeddedAuthenticationStatus =
  EmbeddedAuthenticationState["status"];

export function useEmbeddedAuthenticationState(
  authenticationClient: Authentication.AuthenticationClient,
): EmbeddedAuthenticationState {
  const [authenticationState, setAuthenticationState] =
    React.useState<EmbeddedAuthenticationState>({
      status: "pending",
      userRecord: null,
    });

  React.useEffect(() => {
    return authenticationClient.subscribeToUserAuthState((userRecord) => {
      if (userRecord) {
        setAuthenticationState({ status: "signedIn", userRecord });
      } else {
        setAuthenticationState({ status: "signedOut", userRecord: null });
      }
    });
  }, [authenticationClient]);

  return authenticationState;
}
