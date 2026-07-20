"use client";

import { createClient } from "@/lib/supabase/client";
import Image from "next/image";

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
    <main className="min-h-screen bg-[#0B0B0C] flex items-center justify-center px-6">
      <div className="w-full max-w-[400px] rounded-[28px] border border-white/5 bg-[#161616] p-10 shadow-[0_30px_80px_rgba(0,0,0,.55)]">

        {/* Logo */}

        <div className="mb-8 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
            <Image
  src="/anchor-logo.svg"
  alt="Anchor"
  width={100}
  height={100}
/>
          </div>
        </div>

        {/* Heading */}

        <div className="mb-10 text-center">
          <h1 className="text-4xl font-semibold tracking-[-0.04em] text-white">
            Welcome to Anchor
          </h1>

          <p className="mt-3 text-base text-white/50">
            Return to what matters.
          </p>
        </div>

        {/* Google */}

        <button
  onClick={signInWithGoogle}
  className="flex h-12 w-full items-center justify-center rounded-2xl bg-white text-[15px] font-medium text-black transition hover:opacity-95 active:scale-[0.99]"
>
  <Image
  src="/google.png"
  alt="Google"
  width={20}
  height={20}
  className="mr-3"
/>

  Continue with Google
</button>

        {/* Footer */}

        <p className="mt-8 text-center text-xs uppercase tracking-[0.22em] text-white/25">
          By invitation only
        </p>
      </div>
    </main>
  );
}