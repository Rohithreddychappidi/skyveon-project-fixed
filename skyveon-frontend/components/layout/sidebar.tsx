"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-context";
import type { AuthUser } from "@/lib/api-types";
import { useState, useEffect } from "react";

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

function SidebarContent({
  items,
  user,
  roleLabel,
  onClose,
}: {
  items: NavItem[];
  user: AuthUser;
  roleLabel: string;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  async function handleSignOut() {
    await logout();
    router.push("/");
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 px-5 h-16 border-b border-slate-200 flex-none">
        <div className="flex items-center gap-2">
          <div className="relative h-8 w-8 flex-none">
            <Image src="/skyveon-icon.png" alt="Skyveon" fill className="object-contain" />
          </div>
          <div className="leading-tight">
            <p className="font-display font-semibold text-sm text-ink">Skyveon</p>
            <p className="text-[10px] text-slate tracking-wide">{roleLabel}</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate hover:text-ink md:hidden">
            <X size={20} />
          </button>
        )}
      </div>

      <nav className="flex-1 flex flex-col gap-0.5 p-3 overflow-y-auto">
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
              onClick={onClose}
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

      <div className="p-3 border-t border-slate-200 flex-none">
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
    </div>
  );
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between h-14 px-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="relative h-7 w-7 flex-none">
            <Image src="/skyveon-icon.png" alt="Skyveon" fill className="object-contain" />
          </div>
          <p className="font-display font-semibold text-sm text-ink">Skyveon</p>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="text-slate hover:text-ink p-1.5 rounded-lg hover:bg-slate-50 transition-colors"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-ink/20"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "md:hidden fixed top-0 left-0 z-50 h-full w-72 bg-white border-r border-slate-200 transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent
          items={items}
          user={user}
          roleLabel={roleLabel}
          onClose={() => setMobileOpen(false)}
        />
      </aside>

      {/* Desktop sidebar — always visible */}
      <aside className="hidden md:flex h-screen w-60 flex-none flex-col border-r border-slate-200 bg-white sticky top-0">
        <SidebarContent items={items} user={user} roleLabel={roleLabel} />
      </aside>
    </>
  );
}
