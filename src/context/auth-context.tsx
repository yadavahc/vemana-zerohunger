"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import {
  signInWithPhoneNumber,
  RecaptchaVerifier,
  ConfirmationResult,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  User,
} from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { getUser, createUser } from "@/lib/firebase/db";
import type { AppUser, UserRole } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
  sendOtp: (phone: string) => Promise<ConfirmationResult>;
  // Returns whether the user already has a profile
  confirmOtp: (result: ConfirmationResult, otp: string) => Promise<{ hasProfile: boolean }>;
  // Called after confirmOtp when no profile exists yet
  createProfile: (role: UserRole, name: string, orgName?: string, email?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const profile = await getUser(firebaseUser.uid);
        setAppUser(profile);
      } else {
        setAppUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  async function sendOtp(phone: string): Promise<ConfirmationResult> {
    // Clear any existing verifier before creating a new one
    if (recaptchaRef.current) {
      recaptchaRef.current.clear();
      recaptchaRef.current = null;
    }
    const verifier = new RecaptchaVerifier(auth, "recaptcha-container", {
      size: "invisible",
    });
    recaptchaRef.current = verifier;
    return signInWithPhoneNumber(auth, phone, verifier);
  }

  async function confirmOtp(
    result: ConfirmationResult,
    otp: string
  ): Promise<{ hasProfile: boolean }> {
    // result.confirm() must only ever be called ONCE — do not call it again after this
    const credential = await result.confirm(otp);
    const firebaseUser = credential.user;
    setUser(firebaseUser);

    const profile = await getUser(firebaseUser.uid);
    setAppUser(profile);
    return { hasProfile: !!profile };
  }

  async function createProfile(role: UserRole, name: string, orgName?: string, email?: string) {
    // User is already authenticated at this point — just write the Firestore doc
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Not authenticated");

    await createUser(currentUser.uid, {
      phone: currentUser.phoneNumber ?? "",
      role,
      name,
      ...(orgName ? { orgName } : {}),
      ...(email ? { email } : {}),
      verified: false,
    });

    const profile = await getUser(currentUser.uid);
    setAppUser(profile);
  }

  async function signOut() {
    await firebaseSignOut(auth);
    setUser(null);
    setAppUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, appUser, loading, sendOtp, confirmOtp, createProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
