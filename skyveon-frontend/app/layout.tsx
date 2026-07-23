import type { Metadata } from "next";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import "./globals.css";
import { CmsProvider } from "@/components/cms/cms-context";
import { AuthProvider } from "@/components/auth/auth-context";

export const metadata: Metadata = {
  title: "Skyveon Learning Hub",
  description: "Internal training platform for Skyveon",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-body antialiased bg-white text-ink">
        <AuthProvider>
          <CmsProvider>{children}</CmsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
