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

  async signInWithEmailAndPassword(): Promise<unknown> {
    return;
  }

  async signOut(): Promise<unknown> {
    return;
  }

  async createUserWithEmailAndPassword(): Promise<unknown> {
    return;
  }

  async userExistsWithEmail(): Promise<boolean> {
    return true;
  }

  async sendPasswordResetEmail(): Promise<void> {
    return;
  }

  async getCurrentIDToken(): Promise<unknown> {
    return "local";
  }

  async getLoginTokenUsingSessionCookie(): Promise<unknown> {
    return "local";
  }

  async getLoginTokenUsingIDToken(): Promise<unknown> {
    return "local";
  }

  async getLoginTokenUsingAccessCode(): Promise<unknown> {
    return "local";
  }

  async signInWithLoginToken(): Promise<unknown> {
    return;
  }

  async refreshSessionCookie(): Promise<unknown> {
    return;
  }

  async supportsCredentialPersistence(): Promise<boolean> {
    return true;
  }
}
