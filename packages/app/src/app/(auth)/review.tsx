import React from "react";
import {
  useAuthenticationClient,
  useCurrentUserRecord,
} from "../../authentication/authContext.js";
import { LoadingScreen } from "../../reviewSession/LoadingScreen.js";
import ReviewSession from "../../reviewSession/ReviewSession.js";
import Login from "./login.js";

export default function ReviewSessionPage() {
  const authenticationClient = useAuthenticationClient();
  const userRecord = useCurrentUserRecord(authenticationClient);

  if (userRecord) {
    return <ReviewSession userId={userRecord.userID} />;
  } else if (userRecord === null) {
    return <Login />;
  } else {
    return <LoadingScreen />;
  }
}
