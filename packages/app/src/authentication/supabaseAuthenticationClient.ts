import { SupabaseClient } from "@supabase/supabase-js";
import { AuthenticationClient, UserRecord } from "./authenticationClient.js";

function toUserRecord(
  user: { id: string; email?: string } | null,
): UserRecord | null {
  if (!user) return null;
  return {
    userID: user.id,
    emailAddress: user.email ?? null,
  };
}

export default class SupabaseAuthenticationClient
  implements AuthenticationClient
{
  private _supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this._supabase = supabase;
  }

  subscribeToUserAuthState(
    callback: (userRecord: UserRecord | null) => void,
  ): () => void {
    // Emit the current state immediately.
    this._supabase.auth.getUser().then(({ data }) => {
      callback(toUserRecord(data.user));
    });

    const {
      data: { subscription },
    } = this._supabase.auth.onAuthStateChange((_event, session) => {
      callback(toUserRecord(session?.user ?? null));
    });

    return () => subscription.unsubscribe();
  }

  async getUserAuthState(): Promise<UserRecord | null> {
    const {
      data: { user },
    } = await this._supabase.auth.getUser();
    return toUserRecord(user);
  }

  async signInWithEmailAndPassword(
    email: string,
    password: string,
  ): Promise<void> {
    const { error } = await this._supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  }

  async signOut(): Promise<void> {
    const { error } = await this._supabase.auth.signOut();
    if (error) throw error;
  }

  async createUserWithEmailAndPassword(
    email: string,
    password: string,
  ): Promise<void> {
    const { error } = await this._supabase.auth.signUp({ email, password });
    if (error) throw error;
  }

  async userExistsWithEmail(_email: string): Promise<boolean> {
    // Supabase doesn't expose a public "check if user exists" API.
    // Return false so the UI defaults to "create account". If the user
    // already exists, signUp will fail with a clear error message and
    // the user can switch to sign-in. This avoids fragile error-message
    // parsing and potential rate-limiting from probe requests.
    return false;
  }

  async sendPasswordResetEmail(email: string): Promise<void> {
    const { error } = await this._supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  }

  async supportsCredentialPersistence(): Promise<boolean> {
    // Supabase persists sessions in localStorage by default.
    return true;
  }
}
