"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { accountsEnabled, supabase } from "@/lib/account";
import AuthForm from "./auth-form";
import AuthShell from "./auth-shell";

/** The sign-in page (/login) and the sign-up page (/signup). Once signed in, it sends the student to the planner. */
export default function AuthScreen({ creating }) {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    if (!accountsEnabled) return;
    const { data } = supabase().auth.onAuthStateChange((_event, session) => {
      if (!session) return;
      setSignedIn(true);
      router.replace("/");
    });
    return () => data.subscription.unsubscribe();
  }, [router]);

  return (
    <AuthShell>
      {!accountsEnabled ? (
        <div className="form">
          <h2>Sign-in is not set up yet</h2>
          <p className="hint form-intro">
            This server has no account service, so the planner cannot be opened. If you run this site, add the Supabase
            values listed in .env.example and restart it.
          </p>
        </div>
      ) : signedIn ? (
        <p className="hint">Opening your planner.</p>
      ) : (
        <AuthForm creating={creating} />
      )}
    </AuthShell>
  );
}
