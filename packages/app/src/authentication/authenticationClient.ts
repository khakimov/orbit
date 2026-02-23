export interface UserRecord {
  userID: string; // an opaque unique identifier
  emailAddress: string | null;
}

export interface AuthenticationClient {
  subscribeToUserAuthState(
    callback: (userRecord: UserRecord | null) => void,
  ): () => void;
  getUserAuthState(): Promise<UserRecord | null>;

  signInWithEmailAndPassword(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;

  createUserWithEmailAndPassword(
    email: string,
    password: string,
  ): Promise<void>;

  userExistsWithEmail(email: string): Promise<boolean>;
  sendPasswordResetEmail(email: string): Promise<void>;

  supportsCredentialPersistence(): Promise<boolean>;
}
