"use client";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const signInWithGoogle = async () => {
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      console.error("Google sign-in error:", error.message);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-black text-white">
      <button
        onClick={signInWithGoogle}
        className="rounded-xl border border-white/15 bg-white px-6 py-3 text-sm font-medium text-black"
      >
        Continue with Google
      </button>
    </main>
  );
}