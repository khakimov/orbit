import { AuthenticationClient, UserRecord } from "./authenticationClient.js";

const localUser: UserRecord = {
  userID: "local",
  emailAddress: null,
};

export default class LocalAuthenticationClient implements AuthenticationClient {
  subscribeToUserAuthState(
    callback: (userRecord: UserRecord | null) => void,
  ): () => void {
    // Immediately report signed in.
    queueMicrotask(() => callback(localUser));
    return () => {};
  }

  async getUserAuthState(): Promise<UserRecord | null> {
    return localUser;
  }

  async signInWithEmailAndPassword(): Promise<void> {}

  async signOut(): Promise<void> {}

  async createUserWithEmailAndPassword(): Promise<void> {}

  async userExistsWithEmail(): Promise<boolean> {
    return true;
  }

  async sendPasswordResetEmail(): Promise<void> {
    return;
  }

  async supportsCredentialPersistence(): Promise<boolean> {
    return true;
  }
}
