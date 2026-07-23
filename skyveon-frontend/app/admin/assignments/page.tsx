"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import type { Assignment, Course, Department, Employee, AssignmentTargetType } from "@/lib/api-types";
import { Plus, X, User, Building2, Trash2 } from "lucide-react";

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{
    courseId: string;
    targetType: AssignmentTargetType;
    employeeId: string;
    departmentId: string;
  }>({ courseId: "", targetType: "INDIVIDUAL", employeeId: "", departmentId: "" });

  async function load() {
    setLoading(true);
    const [a, c, e, d] = await Promise.all([
      api.get("/api/assignments"),
      api.get("/api/courses"),
      api.get("/api/users"),
      api.get("/api/departments"),
    ]);
    setAssignments(a.assignments);
    setCourses(c.courses);
    setEmployees(e.employees);
    setDepartments(d.departments);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (!form.courseId) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/api/assignments", {
        courseId: form.courseId,
        targetType: form.targetType,
        employeeId: form.targetType === "INDIVIDUAL" ? form.employeeId : undefined,
        departmentId: form.targetType === "DEPARTMENT" ? form.departmentId : undefined,
      });
      setForm({ courseId: "", targetType: "INDIVIDUAL", employeeId: "", departmentId: "" });
      setPanelOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create assignment.");
    } finally {
      setSubmitting(false);
    }
  }

  async function unassign(id: string) {
    if (!window.confirm("Unassign this course?")) return;
    await api.delete(`/api/assignments/${id}`);
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Assignments"
        subtitle={loading ? "Loading…" : `${assignments.length} active assignment${assignments.length === 1 ? "" : "s"}`}
        action={
          <Button onClick={() => setPanelOpen(true)}>
            <Plus size={16} /> New assignment
          </Button>
        }
      />

      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate uppercase tracking-wide border-b border-slate-200">
              <th className="px-5 py-3 font-medium">Course</th>
              <th className="px-5 py-3 font-medium">Assigned to</th>
              <th className="px-5 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {assignments.map((a) => (
              <tr key={a.id}>
                <td className="px-5 py-3.5 font-medium text-ink">{a.course?.title ?? a.courseId}</td>
                <td className="px-5 py-3.5">
                  <Badge tone="cool">
                    <span className="flex items-center gap-1">
                      {a.targetType === "INDIVIDUAL" ? <User size={11} /> : <Building2 size={11} />}
                      {a.targetType === "INDIVIDUAL" ? a.employee?.name ?? "—" : a.department?.name ?? "—"}
                    </span>
                  </Badge>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button
                    onClick={() => unassign(a.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate hover:text-crimson"
                  >
                    <Trash2 size={13} /> Unassign
                  </button>
                </td>
              </tr>
            ))}
            {!loading && assignments.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-8 text-center text-sm text-slate">
                  No assignments yet.
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
              <h3 className="font-display font-semibold text-lg text-ink">New assignment</h3>
              <button onClick={() => setPanelOpen(false)}>
                <X size={20} className="text-slate" />
              </button>
            </div>
            <form onSubmit={createAssignment} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">Course</span>
                <select
                  value={form.courseId}
                  onChange={(e) => setForm({ ...form, courseId: e.target.value })}
                  className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15"
                >
                  <option value="">Select a course</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex gap-2">
                {(["INDIVIDUAL", "DEPARTMENT"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, targetType: t })}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      form.targetType === t
                        ? "border-indigo bg-indigo/10 text-indigo"
                        : "border-slate-200 text-slate hover:text-ink"
                    }`}
                  >
                    {t === "INDIVIDUAL" ? "Individual" : "Whole department"}
                  </button>
                ))}
              </div>

              {form.targetType === "INDIVIDUAL" ? (
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-ink">Employee</span>
                  <select
                    value={form.employeeId}
                    onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                    className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15"
                  >
                    <option value="">Select an employee</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-ink">Department</span>
                  <select
                    value={form.departmentId}
                    onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                    className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15"
                  >
                    <option value="">Select a department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {error && <p className="text-xs text-crimson">{error}</p>}
              <Button type="submit" className="w-full mt-2" disabled={submitting}>
                {submitting ? "Assigning…" : "Assign course"}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
