"use client";

/** Departments: cards, detail, assignments and leaders. Re-exported by repo.ts. */
import { randomUuid } from "@/mock/prng";
import { addRows, currentDb, patchRow, removeRows, type Db } from "./core";
import { listDepartments, memberById, memberStatuses, sundaySeries } from "./repo";
import type { Department, Member } from "./types";

export interface DepartmentSummary {
  department: Department;
  members: number;
  leader: Member | undefined;
  active: number;
  inactive: number;
  newCount: number;
  lastSundayPresent: number;
  /** Members present per Sunday, last 6 Sundays, oldest first. */
  recent: number[];
}

export function departmentSummaries(db: Db, churchId: string, onlyId?: string): DepartmentSummary[] {
  const statuses = memberStatuses(db, churchId);
  return listDepartments(db, churchId)
    .filter((d) => !onlyId || d.id === onlyId)
    .map((department) => {
      const ids = db.member_departments.filter((md) => md.department_id === department.id).map((md) => md.member_id);
      const series = sundaySeries(db, churchId, 6, { kind: "department", department });
      let active = 0;
      let inactive = 0;
      let newCount = 0;
      for (const id of ids) {
        const s = statuses.get(id)?.status;
        if (s === "active") active++;
        else if (s === "inactive") inactive++;
        else if (s === "new") newCount++;
      }
      return {
        department,
        members: ids.length,
        leader: memberById(db, department.leader_member_id),
        active,
        inactive,
        newCount,
        lastSundayPresent: series.at(-1)?.members ?? 0,
        recent: series.map((p) => p.members),
      };
    })
    .sort((a, b) => b.members - a.members);
}

export function departmentMembers(db: Db, departmentId: string): Member[] {
  return db.member_departments
    .filter((md) => md.department_id === departmentId)
    .map((md) => memberById(db, md.member_id))
    .filter((m): m is Member => !!m)
    .sort((a, b) => a.first_name.localeCompare(b.first_name) || a.last_name.localeCompare(b.last_name));
}

export function assignToDepartment(department: Department, memberIds: string[]) {
  const db = currentDb();
  const have = new Set(db.member_departments.filter((md) => md.department_id === department.id).map((md) => md.member_id));
  const now = new Date().toISOString();
  addRows(
    "member_departments",
    memberIds
      .filter((id) => !have.has(id))
      .map((member_id) => ({ id: randomUuid(), church_id: department.church_id, member_id, department_id: department.id, created_at: now })),
  );
}

export function removeFromDepartment(department: Department, memberId: string) {
  const db = currentDb();
  removeRows(
    "member_departments",
    db.member_departments.filter((md) => md.department_id === department.id && md.member_id === memberId).map((md) => md.id),
  );
  if (department.leader_member_id === memberId) patchRow("departments", department.id, { leader_member_id: null });
}

export function setDepartmentLeader(department: Department, memberId: string | null) {
  patchRow("departments", department.id, { leader_member_id: memberId });
}
