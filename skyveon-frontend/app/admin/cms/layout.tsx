import { CmsProvider } from "@/components/cms/cms-context";

// The CMS editor is the only remaining client-side consumer of the home
// content (the public page now loads it on the server), so the provider —
// and its /api/cms/home request — lives here instead of on every page.
export default function CmsLayout({ children }: { children: React.ReactNode }) {
  return <CmsProvider>{children}</CmsProvider>;
}
