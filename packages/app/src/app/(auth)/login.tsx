import { styles } from "@withorbit/ui";
import React from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { AuthenticationClient } from "../../authentication/index.js";
import { useAuthenticationClient } from "../../authentication/authContext.js";
import SignInForm from "../../signIn/SignInForm.js";

type SignInSubroute =
  | { path: "form" }
  | { path: "continue"; emailAddress: string }
  | null;

function useSignInSubroute(
  authenticationClient: AuthenticationClient,
): SignInSubroute {
  const [state, setState] = React.useState<SignInSubroute>(null);

  React.useEffect(() => {
    const unsubscribe = authenticationClient.subscribeToUserAuthState(
      (record) => {
        if (record) {
          // Already signed in — redirect to home.
          if (Platform.OS === "web") {
            location.pathname = "/";
          }
        } else {
          setState({ path: "form" });
        }
        unsubscribe();
      },
    );
    return unsubscribe;
  }, [authenticationClient]);

  return state;
}

function onSignInComplete() {
  if (Platform.OS === "web") {
    const continueURL = new URL(location.href).searchParams.get("continue");
    if (continueURL && new URL(continueURL).origin === location.origin) {
      location.href = continueURL;
    } else {
      location.pathname = "/";
    }
  }
}

export default function Login() {
  const colorPalette: styles.colors.ColorPalette = styles.colors.palettes.red;

  const authenticationClient = useAuthenticationClient();
  const signInSubroute = useSignInSubroute(authenticationClient);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colorPalette.backgroundColor,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {signInSubroute?.path === "form" ? (
        <SignInForm
          colorPalette={colorPalette}
          onComplete={onSignInComplete}
        />
      ) : (
        <ActivityIndicator size="large" color={colorPalette.accentColor} />
      )}
    </View>
  );
}
