"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Navbar({
  brandName,
  theme,
  onToggleTheme,
}: {
  brandName: string;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  const [open, setOpen] = useState(false);

  const links = [
    { label: "Courses", href: "#courses" },
    { label: "About", href: "#about" },
  ];

  return (
    <header className="sticky top-0 z-40 w-full px-3 sm:px-4 lg:px-6 pt-4">
      <div className="glass rounded-[24px] h-16 flex items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="relative h-8 w-8 flex-none">
            <Image src="/skyveon-icon.png" alt={brandName} fill className="object-contain" />
          </div>
          <span className="font-display font-semibold text-sm sm:text-base text-ink dark:text-white tracking-tight">
            {brandName}
          </span>
        </Link>

        {/* Nav links grouped together with the right-side controls (instead
            of being their own flex child) so they sit next to Login/theme
            toggle on the right, rather than landing in the middle of the bar
            the way justify-between spaces out three separate children. */}
        <div className="flex items-center gap-7">
          <nav className="hidden md:flex items-center gap-7">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-slate dark:text-white/70 hover:text-ink dark:hover:text-white transition-colors"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleTheme}
              aria-label="Toggle dark mode"
              className="clay-sm h-9 w-9 flex-none rounded-xl flex items-center justify-center text-slate dark:text-white/70 hover:text-ink dark:hover:text-white transition-colors"
            >
              {theme === "dark" ? (
                <Sun size={16} strokeWidth={1.8} />
              ) : (
                <Moon size={16} strokeWidth={1.8} />
              )}
            </button>

            <Link href="/login" className="hidden sm:block">
              <Button variant="primary" size="sm">
                Login
              </Button>
            </Link>

            <button
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle menu"
              className="md:hidden clay-sm h-9 w-9 flex-none rounded-xl flex items-center justify-center text-ink dark:text-white"
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="glass md:hidden mt-2 rounded-[20px] px-4 py-3 flex flex-col gap-3">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="text-sm font-medium text-slate dark:text-white/70"
            >
              {l.label}
            </a>
          ))}
          <Link href="/login" onClick={() => setOpen(false)}>
            <Button variant="primary" size="sm" className="w-full">
              Login
            </Button>
          </Link>
        </div>
      )}
    </header>
  );
}