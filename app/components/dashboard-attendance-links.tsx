"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type LiveSession = {
  id: string;
  groupId: string | null;
  groupName: string;
  startTime: string;
};

type LiveResponse = {
  ok?: boolean;
  sessions?: LiveSession[];
};

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase("tr-TR");
}

function sessionHref(session: LiveSession) {
  const params = new URLSearchParams();
  if (session.groupId) params.set("groupId", session.groupId);
  params.set("scheduleId", session.id);
  return `/yoklama?${params.toString()}`;
}

export default function DashboardAttendanceLinks() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;

    let cancelled = false;
    let sessions: LiveSession[] = [];

    function bindLinks() {
      if (cancelled || !sessions.length) return;

      document.querySelectorAll<HTMLAnchorElement>("a.lessonRow").forEach((row) => {
        const groupName = row.querySelector<HTMLElement>(".lessonInfo strong")?.textContent || "";
        const startTime = row.querySelector<HTMLElement>(".lessonTime strong")?.textContent || "";

        const match = sessions.find(
          (session) =>
            normalize(session.groupName) === normalize(groupName) &&
            session.startTime.slice(0, 5) === startTime.trim().slice(0, 5)
        );

        if (match) {
          row.href = sessionHref(match);
          row.dataset.attendanceLinked = "true";
        }
      });
    }

    async function loadSessions() {
      try {
        const response = await fetch("/api/dashboard/live", { cache: "no-store" });
        const data = (await response.json()) as LiveResponse;
        if (!cancelled && response.ok && data.ok && Array.isArray(data.sessions)) {
          sessions = data.sessions;
          bindLinks();
        }
      } catch (error) {
        console.error("SprintOS yoklama bağlantıları:", error);
      }
    }

    const observer = new MutationObserver(bindLinks);
    observer.observe(document.body, { childList: true, subtree: true });
    loadSessions();

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [pathname]);

  return null;
}
