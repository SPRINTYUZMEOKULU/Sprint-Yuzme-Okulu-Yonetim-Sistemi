"use client";

import { useRouter, useSearchParams } from "next/navigation";

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

    // Şube değiştiğinde eski grubu/seansı taşımıyoruz.
    params.delete("groupId");
    params.delete("scheduleId");

    const query = params.toString();
    router.push(query ? `/yoklama?${query}` : "/yoklama");
  }

  return (
    <section className="attendanceBranchFilter" aria-label="Yoklama şube seçimi">
      <div className="attendanceBranchFilterHead">
        <div>
          <strong>Şube Seçimi</strong>
          <small>İstersen tüm şubeleri gör, istersen tek şubeye geç.</small>
        </div>
        <span>{selectedBranchId ? "1 şube" : `${branches.length} şube`}</span>
      </div>

      <div className="attendanceBranchButtons">
        <button
          type="button"
          className={!selectedBranchId ? "active" : ""}
          onClick={() => changeBranch("")}
        >
          Tüm Şubeler
        </button>

        {branches.map((branch) => (
          <button
            key={branch.id}
            type="button"
            className={selectedBranchId === branch.id ? "active" : ""}
            onClick={() => changeBranch(branch.id)}
          >
            {branch.short_name || branch.name || "Şube"}
          </button>
        ))}
      </div>
    </section>
  );
}
