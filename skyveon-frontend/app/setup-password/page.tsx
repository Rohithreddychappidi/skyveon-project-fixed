"use client";

import { useState } from "react";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { api, ApiError } from "@/lib/api";

function SetupPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError("This link is missing its token — copy the full link from your email.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/api/auth/setup-password", { token, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="relative h-14 w-14 mb-3">
            <Image src="/skyveon-icon.png" alt="Skyveon" fill className="object-contain" />
          </div>
          <h1 className="font-display font-semibold text-lg text-ink">
            Welcome to Skyveon Learning Hub
          </h1>
        </div>

        <div className="rounded-2xl border border-slate-200 p-6 sm:p-8">
          {done ? (
            <>
              <h2 className="font-display font-semibold text-lg text-ink mb-1">You're all set</h2>
              <p className="text-sm text-slate mb-6">
                Your password has been created. You can sign in now.
              </p>
              <Link href="/login">
                <Button className="w-full">Go to sign in</Button>
              </Link>
            </>
          ) : (
            <>
              <h2 className="font-display font-semibold text-lg text-ink mb-1">Set your password</h2>
              <p className="text-sm text-slate mb-6">
                Choose a password to activate your account.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-ink">New password</span>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 pr-10 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate hover:text-ink transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} strokeWidth={1.8} /> : <Eye size={16} strokeWidth={1.8} />}
                    </button>
                  </div>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-ink">Confirm password</span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Re-enter password"
                    className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15"
                  />
                </label>
                {error && <p className="text-xs text-crimson -mt-1">{error}</p>}
                <Button type="submit" variant="primary" className="w-full mt-2" disabled={submitting}>
                  {submitting ? "Activating…" : "Activate account"}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SetupPasswordPage() {
  return (
    <Suspense>
      <SetupPasswordForm />
    </Suspense>
  );
}