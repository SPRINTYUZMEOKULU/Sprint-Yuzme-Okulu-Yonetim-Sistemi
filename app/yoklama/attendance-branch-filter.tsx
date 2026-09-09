"use client";

import { useRouter, useSearchParams } from "next/navigation";
import styles from "./attendance-branch-filter.module.css";

export type AttendanceBranchOption = {
  id: string;
  name?: string | null;
  short_name?: string | null;
};

export default function AttendanceBranchFilter({
  branches,
  selectedBranchId,
}: {
  branches: AttendanceBranchOption[];
  selectedBranchId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function changeBranch(branchId: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (branchId) params.set("branchId", branchId);
    else params.delete("branchId");

    params.delete("groupId");
    params.delete("scheduleId");

    const query = params.toString();
    router.push(query ? `/yoklama?${query}` : "/yoklama");
  }

  return (
    <section className={styles.filter} aria-label="Yoklama şube seçimi">
      <div className={styles.head}>
        <div className={styles.headText}>
          <strong>Şube Seçimi</strong>
          <small>Yakın dersler önce gelir. İstersen tek şubeye geçebilirsin.</small>
        </div>
        <span className={styles.badge}>
          {selectedBranchId ? "1 şube" : `${branches.length} şube`}
        </span>
      </div>

      <div className={styles.buttons}>
        <button
          type="button"
          className={`${styles.button} ${!selectedBranchId ? styles.active : ""}`}
          onClick={() => changeBranch("")}
        >
          Tüm Şubeler
        </button>

        {branches.map((branch) => (
          <button
            key={branch.id}
            type="button"
            className={`${styles.button} ${selectedBranchId === branch.id ? styles.active : ""}`}
            onClick={() => changeBranch(branch.id)}
          >
            {branch.short_name || branch.name || "Şube"}
          </button>
        ))}
      </div>
    </section>
  );
}
