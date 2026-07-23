"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-context";
import type { AuthUser } from "@/lib/api-types";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const AVATAR_COLORS = ["bg-indigo", "bg-crimson", "bg-orange", "bg-violet", "bg-slate"];

function avatarColorFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function Sidebar({
  items,
  user,
  roleLabel,
}: {
  items: NavItem[];
  user: AuthUser;
  roleLabel: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  async function handleSignOut() {
    await logout();
    router.push("/");
  }

  return (
    <aside className="flex h-screen w-60 flex-none flex-col border-r border-slate-200 bg-white sticky top-0">
      <div className="flex items-center gap-2 px-5 h-16 border-b border-slate-200">
        <div className="relative h-8 w-8 flex-none">
          <Image src="/skyveon-icon.png" alt="Skyveon" fill className="object-contain" />
        </div>
        <div className="leading-tight">
          <p className="font-display font-semibold text-sm text-ink">Skyveon</p>
          <p className="text-[10px] text-slate tracking-wide">{roleLabel}</p>
        </div>
      </div>

      <nav className="flex-1 flex flex-col gap-0.5 p-3">
        {items.map((item) => {
          const active =
            item.href === "/admin" || item.href === "/employee"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-indigo/[0.06] text-indigo"
                  : "text-slate hover:bg-slate-50 hover:text-ink"
              )}
            >
              <Icon
                size={18}
                strokeWidth={active ? 2.2 : 1.8}
                className={active ? "text-indigo" : "text-slate"}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-200">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
          <div
            className={cn(
              "h-8 w-8 flex-none rounded-full flex items-center justify-center text-white text-xs font-semibold",
              avatarColorFor(user.id)
            )}
          >
            {initials(user.name)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink truncate">{user.name}</p>
            <p className="text-xs text-slate truncate">{user.email}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 mt-1 text-sm text-slate hover:bg-slate-50 hover:text-crimson transition-colors"
        >
          <LogOut size={16} strokeWidth={1.8} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
