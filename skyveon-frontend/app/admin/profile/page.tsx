"use client";

import { ProfileView } from "@/components/account/profile-view";

// Admins previously had no way to change their password except "Forgot password".
export default function AdminProfilePage() {
  return <ProfileView />;
}
