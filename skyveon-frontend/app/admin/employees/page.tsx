"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import type { Employee, Department } from "@/lib/api-types";
import { Plus, X, UserMinus, UserCheck, Mail } from "lucide-react";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", departmentId: "" });

  async function load() {
    setLoading(true);
    const [empBody, deptBody] = await Promise.all([
      api.get("/api/users"),
      api.get("/api/departments"),
    ]);
    setEmployees(empBody.employees);
    setDepartments(deptBody.departments);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleStatus(emp: Employee) {
    const nextStatus = emp.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setEmployees((prev) => prev.map((e) => (e.id === emp.id ? { ...e, status: nextStatus } : e)));
    try {
      await api.patch(`/api/users/${emp.id}/status`, { status: nextStatus });
    } catch {
      // revert on failure
      setEmployees((prev) => prev.map((e) => (e.id === emp.id ? emp : e)));
    }
  }

  async function addEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/api/users", {
        name: form.name,
        email: form.email,
        departmentId: form.departmentId || undefined,
      });
      setForm({ name: "", email: "", departmentId: "" });
      setPanelOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add employee — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function resendSetup(id: string) {
    try {
      await api.post(`/api/users/${id}/resend-setup`);
    } catch {
      // best-effort — no need to block the UI on this
    }
  }

  const activeCount = employees.filter((e) => e.status === "ACTIVE").length;

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle={loading ? "Loading…" : `${employees.length} total · ${activeCount} active`}
        action={
          <Button onClick={() => setPanelOpen(true)}>
            <Plus size={16} /> Add employee
          </Button>
        }
      />

      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate uppercase tracking-wide border-b border-slate-200">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Department</th>
              <th className="px-5 py-3 font-medium">Account</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.map((emp) => (
              <tr key={emp.id}>
                <td className="px-5 py-3.5">
                  <p className="font-medium text-ink">{emp.name}</p>
                  <p className="text-xs text-slate">{emp.email}</p>
                </td>
                <td className="px-5 py-3.5 text-slate">{emp.department?.name ?? "—"}</td>
                <td className="px-5 py-3.5">
                  {!emp.hasSetPassword ? (
                    <button
                      onClick={() => resendSetup(emp.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo hover:underline"
                    >
                      <Mail size={12} /> Resend setup link
                    </button>
                  ) : (
                    <span className="text-xs text-slate">Active</span>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <Badge tone={emp.status === "ACTIVE" ? "success" : "neutral"}>
                    {emp.status === "ACTIVE" ? "active" : "inactive"}
                  </Badge>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button
                    onClick={() => toggleStatus(emp)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate hover:text-indigo"
                  >
                    {emp.status === "ACTIVE" ? (
                      <>
                        <UserMinus size={14} /> Deactivate
                      </>
                    ) : (
                      <>
                        <UserCheck size={14} /> Reactivate
                      </>
                    )}
                  </button>
                </td>
              </tr>
            ))}
            {!loading && employees.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate">
                  No employees yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {panelOpen && (
        <div className="fixed inset-0 z-20 flex justify-end bg-ink/20">
          <div className="w-full max-w-md h-full bg-white border-l border-slate-200 p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display font-semibold text-lg text-ink">Add employee</h3>
              <button onClick={() => setPanelOpen(false)}>
                <X size={20} className="text-slate" />
              </button>
            </div>
            <form onSubmit={addEmployee} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">Full name</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Aditi Sharma"
                  className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">Work email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="aditi.sharma@skyveon.ai"
                  className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">Department</span>
                <select
                  value={form.departmentId}
                  onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                  className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15"
                >
                  <option value="">No department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              {error && <p className="text-xs text-crimson">{error}</p>}
              <p className="text-xs text-slate -mt-1">
                A setup link will be emailed so they can create their own password.
              </p>
              <Button type="submit" className="w-full mt-2" disabled={submitting}>
                {submitting ? "Adding…" : "Add employee"}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
