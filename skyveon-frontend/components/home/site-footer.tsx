"use client";

import Image from "next/image";
import Link from "next/link";
import type { HomeCmsContent } from "@/lib/cms-types";
import { Mail, Phone, MapPin } from "lucide-react";

export function SiteFooter({
  brand,
  footer,
}: {
  brand: HomeCmsContent["brand"];
  footer: HomeCmsContent["footer"];
}) {
  return (
    <footer className="pb-8 pt-2">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="rounded-[32px] px-6 sm:px-10 py-10 sm:py-12 bg-ink dark:bg-black text-white/70 shadow-[0_20px_50px_rgba(20,21,43,0.35)]">
          <div className="flex flex-col sm:flex-row justify-between gap-8">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="relative h-7 w-7 flex-none">
                  <Image src="/skyveon-icon.png" alt={brand.name} fill className="object-contain" />
                </div>
                <span className="font-display font-semibold text-white text-sm">
                  {brand.name}
                </span>
              </div>
              <p className="text-xs text-white/50 tracking-wide mt-2">
                {footer.tagline}
              </p>
            </div>

            <div className="flex flex-col gap-2 text-sm">
              <a href={`mailto:${footer.email}`} className="flex items-center gap-2 hover:text-white transition-colors">
                <Mail size={14} /> {footer.email}
              </a>
              <a href={`tel:${footer.phone}`} className="flex items-center gap-2 hover:text-white transition-colors">
                <Phone size={14} /> {footer.phone}
              </a>
              <span className="flex items-center gap-2">
                <MapPin size={14} /> {footer.address}
              </span>
            </div>

            <div className="flex flex-col gap-2 text-sm">
              <Link href="/login" className="hover:text-white transition-colors">
                Sign in
              </Link>
              <a href="#courses" className="hover:text-white transition-colors">
                Courses
              </a>
              <a href="#about" className="hover:text-white transition-colors">
                About
              </a>
            </div>
          </div>
          <p className="text-center text-xs text-white/30 mt-10">
            © {new Date().getFullYear()} {brand.name}. Internal use only.
          </p>
        </div>
      </div>
    </footer>
  );
}
