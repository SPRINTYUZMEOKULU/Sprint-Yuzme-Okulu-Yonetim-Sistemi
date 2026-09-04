"use client";

import { useEffect } from "react";

export default function DefaultStudentSort() {
  useEffect(() => {
    const applyDefaultSort = () => {
      const selects = Array.from(document.querySelectorAll("select"));
      const sortSelect = selects.find((select) =>
        Array.from(select.options).some((option) => option.value === "start_new")
      );

      if (!sortSelect || sortSelect.value === "start_new") return true;

      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value"
      )?.set;

      nativeSetter?.call(sortSelect, "start_new");
      sortSelect.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    };

    if (applyDefaultSort()) return;

    // Sayfa istemci tarafında tamamlanırken kısa süreli birkaç güvenli deneme yap.
    // MutationObserver kullanmıyoruz; React'in sahip olduğu DOM düğümlerini taşımıyoruz.
    let attempt = 0;
    const timer = window.setInterval(() => {
      attempt += 1;
      if (applyDefaultSort() || attempt >= 12) {
        window.clearInterval(timer);
      }
    }, 100);

    return () => window.clearInterval(timer);
  }, []);

  return null;
}
