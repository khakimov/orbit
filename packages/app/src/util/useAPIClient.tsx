import OrbitAPIClient from "@withorbit/api-client";
import React from "react";
import serviceConfig from "../../serviceConfig.js";
import { AuthenticationClient } from "../authentication/index.js";

// Stub: returns an API client that will fail on use. The embed page still
// references this but the old Firebase API is decommissioned.
export function useAPIClient(
  _authenticationClient: AuthenticationClient,
): OrbitAPIClient {
  return React.useMemo(
    () =>
      new OrbitAPIClient(async () => ({ idToken: "" }), {
        baseURL: serviceConfig.httpsAPIBaseURLString,
      }),
    [],
  );
}
