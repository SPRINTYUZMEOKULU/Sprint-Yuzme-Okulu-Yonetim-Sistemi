"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Branch = { id: string; name: string; short_name?: string | null };
type Group = { id: string; branch_id?: string | null; name?: string | null; course_type?: string | null };
type Schedule = { id: string; branch_id?: string | null; group_id?: string | null; weekday?: number | null; start_time?: string | null; end_time?: string | null; is_active?: boolean | null };

type Props = {
  branches: Branch[];
  groups: Group[];
  schedules: Schedule[];
  selectedBranchId?: string;
  selectedGroupId?: string;
  selectedScheduleId?: string;
};

const DAY_NAMES: Record<number, string> = { 1: "Pazartesi", 2: "Salı", 3: "Çarşamba", 4: "Perşembe", 5: "Cuma", 6: "Cumartesi", 7: "Pazar" };

function todayWeekdayTR() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Istanbul", weekday: "short" }).format(new Date());
  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return map[parts] || 1;
}

function nowMinutesTR() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const hour = Number(parts.find((x) => x.type === "hour")?.value || 0);
  const minute = Number(parts.find((x) => x.type === "minute")?.value || 0);
  return hour * 60 + minute;
}

function toMinutes(value?: string | null) {
  if (!value) return 9999;
  const [h, m] = value.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function t(value?: string | null) {
  return value ? value.slice(0, 5) : "—";
}

export default function AttendanceSessionPicker({ branches, groups, schedules, selectedBranchId = "", selectedGroupId = "", selectedScheduleId = "" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const weekday = todayWeekdayTR();
  const now = nowMinutesTR();

  const todaySchedules = useMemo(() => schedules.filter((s) => s.is_active !== false && Number(s.weekday) === weekday), [schedules, weekday]);

  const visibleGroups = useMemo(() => {
    const todayGroupIds = new Set(todaySchedules.map((s) => s.group_id).filter(Boolean));
    const filtered = groups.filter((g) => (!selectedBranchId || g.branch_id === selectedBranchId) && todayGroupIds.has(g.id));
    return filtered.sort((a, b) => {
      const aTimes = todaySchedules.filter((s) => s.group_id === a.id).map((s) => toMinutes(s.start_time));
      const bTimes = todaySchedules.filter((s) => s.group_id === b.id).map((s) => toMinutes(s.start_time));
      const aNext = Math.min(...aTimes.filter((m) => m >= now), ...aTimes.map((m) => m + 1440));
      const bNext = Math.min(...bTimes.filter((m) => m >= now), ...bTimes.map((m) => m + 1440));
      return aNext - bNext;
    });
  }, [groups, todaySchedules, selectedBranchId, now]);

  const visibleSchedules = useMemo(() => todaySchedules.filter((s) => (!selectedBranchId || s.branch_id === selectedBranchId) && (!selectedGroupId || s.group_id === selectedGroupId)).sort((a, b) => {
    const am = toMinutes(a.start_time);
    const bm = toMinutes(b.start_time);
    const aPast = am < now;
    const bPast = bm < now;
    if (aPast !== bPast) return aPast ? 1 : -1;
    return am - bm;
  }), [todaySchedules, selectedBranchId, selectedGroupId, now]);

  function go(next: { branchId?: string; groupId?: string; scheduleId?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.branchId !== undefined) {
      next.branchId ? params.set("branchId", next.branchId) : params.delete("branchId");
      params.delete("groupId");
      params.delete("scheduleId");
    }
    if (next.groupId !== undefined) {
      next.groupId ? params.set("groupId", next.groupId) : params.delete("groupId");
      params.delete("scheduleId");
    }
    if (next.scheduleId !== undefined) {
      next.scheduleId ? params.set("scheduleId", next.scheduleId) : params.delete("scheduleId");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <section className="attendanceSessionPicker">
      <div className="attendancePickerHead">
        <div>
          <small>BUGÜNÜN YOKLAMASI</small>
          <strong>{DAY_NAMES[weekday]} · Yaklaşan dersler önce</strong>
        </div>
        <span>{visibleSchedules.length} seans</span>
      </div>
      <div className="attendancePickerGrid">
        <label><span>Şube</span><select value={selectedBranchId} onChange={(e) => go({ branchId: e.target.value })}><option value="">Tüm şubeler</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.short_name || b.name}</option>)}</select></label>
        <label><span>Grup</span><select value={selectedGroupId} onChange={(e) => go({ groupId: e.target.value })}><option value="">Bugünkü grubu seçin</option>{visibleGroups.map((g) => <option key={g.id} value={g.id}>{g.name || "İsimsiz Grup"}{g.course_type ? ` · ${g.course_type}` : ""}</option>)}</select></label>
        <label><span>Ders / Seans</span><select value={selectedScheduleId} onChange={(e) => go({ scheduleId: e.target.value })}><option value="">Yaklaşan seansı seçin</option>{visibleSchedules.map((s) => {
          const group = groups.find((g) => g.id === s.group_id);
          const past = toMinutes(s.start_time) < now;
          return <option key={s.id} value={s.id}>{past ? "Geçti · " : "Yaklaşan · "}{t(s.start_time)}–{t(s.end_time)} · {group?.name || "Grup"}</option>;
        })}</select></label>
      </div>
      <style jsx>{`
        .attendanceSessionPicker{margin:14px 0 16px;padding:16px;border:1px solid #d9e4f1;border-radius:18px;background:#fff;box-shadow:0 8px 24px rgba(15,35,70,.045)}
        .attendancePickerHead{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px}.attendancePickerHead small{display:block;color:#1769e8;font-size:10px;font-weight:900;letter-spacing:.12em}.attendancePickerHead strong{display:block;margin-top:4px;color:#102442;font-size:14px}.attendancePickerHead>span{padding:7px 10px;border-radius:999px;background:#edf4ff;color:#1769e8;font-size:11px;font-weight:900;white-space:nowrap}
        .attendancePickerGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.attendancePickerGrid label>span{display:block;margin:0 0 6px;color:#64748b;font-size:10px;font-weight:900;text-transform:uppercase}.attendancePickerGrid select{width:100%;min-height:45px;border:1px solid #cfdbea;border-radius:12px;background:#f8fbff;color:#173152;padding:0 12px;font:800 12px system-ui;outline:none}.attendancePickerGrid select:focus{border-color:#60a5fa;box-shadow:0 0 0 3px #dbeafe}
        @media(max-width:720px){.attendanceSessionPicker{padding:13px;border-radius:16px}.attendancePickerHead{align-items:flex-start}.attendancePickerHead strong{font-size:12px}.attendancePickerGrid{grid-template-columns:1fr}.attendancePickerGrid select{min-height:48px;font-size:13px}.attendancePickerHead>span{font-size:10px}}
      `}</style>
    </section>
  );
}
