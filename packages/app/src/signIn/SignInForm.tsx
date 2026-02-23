import {
  Button,
  IconName,
  Logo,
  Spacer,
  styles,
  textFieldHorizontalPadding,
  TextInput,
} from "@withorbit/ui";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuthenticationClient } from "../authentication/authContext.js";

function showSimpleAlert(text: string) {
  if (Platform.OS === "web") {
    alert(text);
  } else {
    Alert.alert(text);
  }
}

export interface SignInFormProps {
  colorPalette: styles.colors.ColorPalette;
  overrideEmailAddress?: string | null;
  onComplete: () => void;
}

export default function SignInForm({
  overrideEmailAddress,
  colorPalette,
  onComplete,
}: SignInFormProps) {
  const authenticationClient = useAuthenticationClient();

  const [email, setEmail] = useState(overrideEmailAddress ?? "");
  const [password, setPassword] = useState("");
  const [isPendingServerResponse, setPendingServerResponse] = useState(false);

  async function handleSignIn() {
    setPendingServerResponse(true);
    try {
      await authenticationClient.signInWithEmailAndPassword(email, password);
      onComplete();
    } catch (error) {
      console.error("Couldn't sign in", error);
      showSimpleAlert(error instanceof Error ? error.message : String(error));
    }
    setPendingServerResponse(false);
  }

  async function handleCreateAccount() {
    setPendingServerResponse(true);
    try {
      await authenticationClient.createUserWithEmailAndPassword(
        email,
        password,
      );
      onComplete();
    } catch (error) {
      console.error("Couldn't create account", error);
      showSimpleAlert(error instanceof Error ? error.message : String(error));
    }
    setPendingServerResponse(false);
  }

  function onResetPassword() {
    if (!email.trim()) {
      showSimpleAlert("Enter your email address first.");
      return;
    }
    authenticationClient.sendPasswordResetEmail(email);
    showSimpleAlert(
      "We've sent you an email with instructions on how to reset your password.",
    );
  }

  return (
    <View style={formStyles.container}>
      <View style={{ flex: 1 }} />
      <Logo units={3} tintColor={colorPalette.secondaryTextColor} />
      <Spacer units={8} />
      <Text style={styles.type.headline.layoutStyle}>Sign in</Text>
      <Spacer units={4} />
      <Text style={formStyles.label}>Email address</Text>
      <Spacer units={1} />
      <TextInput
        style={formStyles.textInput}
        colorPalette={colorPalette}
        onChangeText={setEmail}
        value={email}
        placeholder="Enter your email address."
        autoCorrect={false}
        importantForAutofill="yes"
        autoComplete="email"
        textContentType="emailAddress"
        keyboardType="email-address"
        returnKeyType="next"
      />
      {Platform.OS === "web" && (
        <input
          style={{ display: "none" }}
          type="text"
          name="email"
          id="email"
          autoComplete="username"
          value={email}
          readOnly
        />
      )}
      <Spacer units={4} />
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-end",
        }}
      >
        <Text style={formStyles.label}>Password</Text>
        <Button
          size="tiny"
          onPress={onResetPassword}
          title="Forgot your password?"
          color={colorPalette.accentColor}
          hitSlop={40}
        />
      </View>
      <Spacer units={1} />
      <TextInput
        style={formStyles.textInput}
        colorPalette={colorPalette}
        onChangeText={setPassword}
        value={password}
        placeholder="Password"
        autoCorrect={false}
        importantForAutofill="yes"
        autoComplete="password"
        textContentType="password"
        secureTextEntry={true}
        onSubmitEditing={handleSignIn}
        returnKeyType="done"
      />
      <Spacer units={6} />
      <View style={{ position: "relative" }}>
        <View style={{ flexDirection: "row", gap: styles.layout.gridUnit }}>
          <View style={{ flex: 1 }}>
            <Button
              color={styles.colors.white}
              accentColor={colorPalette.accentColor}
              iconName={IconName.ArrowRight}
              title="Sign in"
              onPress={handleSignIn}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              color={styles.colors.white}
              accentColor={colorPalette.accentColor}
              title="Create account"
              onPress={handleCreateAccount}
            />
          </View>
        </View>
        <View style={formStyles.indicatorContainer}>
          <ActivityIndicator
            animating={isPendingServerResponse}
            color={colorPalette.accentColor}
          />
        </View>
      </View>
      <View style={{ flex: 1 }} />
    </View>
  );
}

const formStyles = StyleSheet.create({
  container: {
    padding: styles.layout.edgeMargin,
    width: "100%",
    maxWidth: 375,
    flex: 1,
  },

  textInput: {
    marginLeft: -textFieldHorizontalPadding,
    marginRight: -textFieldHorizontalPadding,
  },

  label: {
    ...styles.type.labelSmall.layoutStyle,
    color: styles.colors.white,
  },

  indicatorContainer: {
    position: "absolute",
    right: 0,
    bottom: styles.layout.gridUnit * 2,
  },
});
