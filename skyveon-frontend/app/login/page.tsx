"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-context";
import { ApiError } from "@/lib/api";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(email, password);
      router.push(user.role === "EMPLOYEE" ? "/employee" : "/admin");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-white overflow-hidden flex items-center justify-center px-4">
      <div
        className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 opacity-[0.05] rotate-12"
        style={{
          background: "linear-gradient(135deg, #E63946 0%, #F5821F 100%)",
          clipPath: "polygon(50% 0%, 100% 30%, 78% 42%, 50% 26%, 22% 42%, 0% 30%)",
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 opacity-[0.05] -rotate-12"
        style={{
          background: "linear-gradient(135deg, #4B4E9E 0%, #2E3192 100%)",
          clipPath: "polygon(0% 30%, 22% 42%, 50% 60%, 78% 42%, 100% 30%, 50% 96%)",
        }}
      />

      <Link
        href="/"
        className="absolute top-6 left-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate hover:text-ink transition-colors"
      >
        <ArrowLeft size={16} strokeWidth={1.8} />
        Back to home
      </Link>

      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="relative h-16 w-16 mb-3">
            <Image src="/skyveon-icon.png" alt="Skyveon" fill className="object-contain" priority />
          </div>
          <h1 className="font-display font-semibold text-xl text-ink tracking-tight">
            Skyveon Learning Hub
          </h1>
          <p className="text-xs text-indigo font-medium tracking-wide mt-1">
            SOLUTIONS IN EVERY HORIZON
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 p-6 sm:p-8">
          <h2 className="font-display font-semibold text-lg text-ink mb-1">Sign in</h2>
          <p className="text-sm text-slate mb-6">
            Internal platform for Skyveon employees only.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">Work email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@skyveon.ai"
                className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink">Password</span>
                <Link href="/reset-password" className="text-xs font-medium text-indigo hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
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

            {error && <p className="text-xs text-crimson -mt-1">{error}</p>}

            <Button type="submit" variant="primary" className="w-full mt-1" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-slate mt-6">
          Trouble signing in? Contact{" "}
          <a href="mailto:hr@skyveon.ai" className="text-indigo hover:underline">
            hr@skyveon.ai
          </a>
        </p>
      </div>
    </div>
  );
}