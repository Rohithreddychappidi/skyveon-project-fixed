"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-context";
import { api, ApiError } from "@/lib/api";
import type { Admin, AdminPermission } from "@/lib/api-types";
import { Plus, X, UserMinus, UserCheck, Mail } from "lucide-react";

const ALL_PERMISSIONS: { value: AdminPermission; label: string }[] = [
  { value: "MANAGE_EMPLOYEES", label: "Manage employees" },
  { value: "MANAGE_COURSES", label: "Manage courses" },
  { value: "MANAGE_ASSIGNMENTS", label: "Manage assignments" },
  { value: "VIEW_PROGRESS", label: "View progress" },
  { value: "MANAGE_CMS", label: "Manage home page CMS" },
];

export default function AdminsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ name: string; email: string; permissions: AdminPermission[] }>({
    name: "",
    email: "",
    permissions: [],
  });

  useEffect(() => {
    if (user && user.role !== "MASTER_ADMIN") router.replace("/admin");
  }, [user, router]);

  async function load() {
    setLoading(true);
    const body = await api.get("/api/admins");
    setAdmins(body.admins);
    setLoading(false);
  }

  useEffect(() => {
    if (user?.role === "MASTER_ADMIN") load();
  }, [user]);

  function togglePermission(p: AdminPermission) {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(p) ? f.permissions.filter((x) => x !== p) : [...f.permissions, p],
    }));
  }

  async function createAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/api/admins", form);
      setForm({ name: "", email: "", permissions: [] });
      setPanelOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add admin — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function updatePermissions(admin: Admin, permission: AdminPermission) {
    const next = admin.adminPermissions.includes(permission)
      ? admin.adminPermissions.filter((p) => p !== permission)
      : [...admin.adminPermissions, permission];
    setAdmins((prev) => prev.map((a) => (a.id === admin.id ? { ...a, adminPermissions: next } : a)));
    try {
      await api.patch(`/api/admins/${admin.id}/permissions`, { permissions: next });
    } catch {
      await load(); // revert to server truth on failure
    }
  }

  async function toggleStatus(admin: Admin) {
    if (admin.role === "MASTER_ADMIN") return;
    const nextStatus = admin.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setAdmins((prev) => prev.map((a) => (a.id === admin.id ? { ...a, status: nextStatus } : a)));
    try {
      await api.patch(`/api/admins/${admin.id}/status`, { status: nextStatus });
    } catch {
      await load();
    }
  }

  if (!user || user.role !== "MASTER_ADMIN") return null;

  return (
    <div>
      <PageHeader
        title="Admins"
        subtitle={loading ? "Loading…" : `${admins.length} admin account${admins.length === 1 ? "" : "s"}`}
        action={
          <Button onClick={() => setPanelOpen(true)}>
            <Plus size={16} /> Add admin
          </Button>
        }
      />

      <div className="flex flex-col gap-4">
        {admins.map((admin) => (
          <Card key={admin.id} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-medium text-ink flex items-center gap-2">
                  {admin.name}
                  {admin.role === "MASTER_ADMIN" && <Badge tone="warm">Master admin</Badge>}
                </p>
                <p className="text-xs text-slate">{admin.email}</p>
              </div>
              <div className="flex items-center gap-3">
                {!admin.hasSetPassword && (
                  <span className="inline-flex items-center gap-1 text-xs text-indigo">
                    <Mail size={12} /> Setup link sent
                  </span>
                )}
                <Badge tone={admin.status === "ACTIVE" ? "success" : "neutral"}>
                  {admin.status === "ACTIVE" ? "active" : "inactive"}
                </Badge>
                {admin.role !== "MASTER_ADMIN" && (
                  <button
                    onClick={() => toggleStatus(admin)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate hover:text-indigo"
                  >
                    {admin.status === "ACTIVE" ? (
                      <>
                        <UserMinus size={13} /> Deactivate
                      </>
                    ) : (
                      <>
                        <UserCheck size={13} /> Reactivate
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {admin.role === "MASTER_ADMIN" ? (
              <p className="text-xs text-slate">Has every permission — can't be restricted.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {ALL_PERMISSIONS.map((p) => {
                  const active = admin.adminPermissions.includes(p.value);
                  return (
                    <button
                      key={p.value}
                      onClick={() => updatePermissions(admin, p.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        active
                          ? "border-indigo bg-indigo/10 text-indigo"
                          : "border-slate-200 text-slate hover:text-ink"
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        ))}
        {!loading && admins.length === 0 && (
          <p className="text-sm text-slate py-8 text-center">No admins yet.</p>
        )}
      </div>

      {panelOpen && (
        <div className="fixed inset-0 z-20 flex justify-end bg-ink/20">
          <div className="w-full max-w-md h-full bg-white border-l border-slate-200 p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display font-semibold text-lg text-ink">Add admin</h3>
              <button onClick={() => setPanelOpen(false)}>
                <X size={20} className="text-slate" />
              </button>
            </div>
            <form onSubmit={createAdmin} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">Full name</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">Work email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15"
                />
              </label>
              <div>
                <span className="text-sm font-medium text-ink block mb-1.5">Permissions</span>
                <div className="flex flex-wrap gap-2">
                  {ALL_PERMISSIONS.map((p) => {
                    const active = form.permissions.includes(p.value);
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => togglePermission(p.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          active
                            ? "border-indigo bg-indigo/10 text-indigo"
                            : "border-slate-200 text-slate hover:text-ink"
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {error && <p className="text-xs text-crimson">{error}</p>}
              <p className="text-xs text-slate -mt-1">A setup link will be emailed to them.</p>
              <Button type="submit" className="w-full mt-2" disabled={submitting}>
                {submitting ? "Adding…" : "Add admin"}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
