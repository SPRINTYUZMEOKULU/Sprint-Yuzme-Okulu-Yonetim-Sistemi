"use client";

import { useState, useTransition } from "react";

type Item = { id: string; name: string; pool_name: string | null };

export default function BranchOrder({ items, saveOrder }: { items: Item[]; saveOrder: (ids: string[]) => Promise<void> }) {
  const [list, setList] = useState(items);
  const [dragged, setDragged] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function drop(targetId: string) {
    if (!dragged || dragged === targetId) return;
    const next = [...list];
    const from = next.findIndex(x => x.id === dragged);
    const to = next.findIndex(x => x.id === targetId);
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setList(next);
    setDragged(null);
    startTransition(() => saveOrder(next.map(x => x.id)));
  }

  return <div className="orderBox">
    <div className="orderHead"><div><strong>Görüntüleme Sırası</strong><span>Şubeleri tutup sürükleyerek sıralayın. Bu sıra ön kayıt ve şube seçimlerinde kullanılır.</span></div><b>{pending ? "Kaydediliyor…" : "Otomatik kaydedilir"}</b></div>
    <div className="orderList">
      {list.map((item, index) => <div key={item.id} className={`orderItem ${dragged === item.id ? "dragging" : ""}`}
        draggable onDragStart={() => setDragged(item.id)} onDragOver={e => e.preventDefault()} onDrop={() => drop(item.id)} onDragEnd={() => setDragged(null)}>
        <span className="dragHandle" aria-hidden>☰</span><em>{index + 1}</em><div><strong>{item.name}</strong><small>{item.pool_name || "Havuz adı eklenmedi"}</small></div><span className="dragText">Sürükle</span>
      </div>)}
    </div>
  </div>;
}
