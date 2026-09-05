"use client";

import { useEffect } from "react";

function setSelectValue(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function OperationSelectionHydrator({
  branchId,
  groupId,
}: {
  branchId: string;
  groupId: string;
}) {
  useEffect(() => {
    if (!branchId || !groupId) return;

    const timer = window.setTimeout(() => {
      const selects = Array.from(document.querySelectorAll<HTMLSelectElement>(".lessonOpsCard select"));
      const branchSelect = selects[0];
      const groupSelect = selects[1];

      if (!branchSelect || !groupSelect) return;

      if (branchSelect.value !== branchId) {
        setSelectValue(branchSelect, branchId);
      }

      window.setTimeout(() => {
        const refreshed = Array.from(document.querySelectorAll<HTMLSelectElement>(".lessonOpsCard select"));
        const refreshedGroup = refreshed[1];
        if (refreshedGroup && refreshedGroup.value !== groupId) {
          setSelectValue(refreshedGroup, groupId);
        }
      }, 0);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [branchId, groupId]);

  return null;
}
