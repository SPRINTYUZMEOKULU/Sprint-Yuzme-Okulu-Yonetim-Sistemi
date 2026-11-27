"use client";

import { useActionState } from "react";

type Result = { error?: string; saved?: boolean };

export default function SessionAssignmentForm({ action, scheduleId, coaches, selectedCoachId }: {
  action: (previous: Result, formData: FormData) => Promise<Result>;
  scheduleId: string;
  coaches: { id: string; name: string }[];
  selectedCoachId: string;
}) {
  const [result, submit, pending] = useActionState(action, {});
  return (
    <form action={submit} className="opAssignmentEditor">
      <input type="hidden" name="schedule_id" value={scheduleId} />
      <p>Bu atama haftalık seans için kaydedilir ve sonraki haftalara da uygulanır.</p>
      <fieldset className="opAssignmentFields" disabled={pending || !coaches.length}>
        <label>Eğitmen
          <select name="coach_id" required defaultValue={coaches.some((coach) => coach.id === selectedCoachId) ? selectedCoachId : ""}>
            <option value="">Eğitmen seçin</option>
            {coaches.map((coach) => <option key={coach.id} value={coach.id}>{coach.name}</option>)}
          </select>
        </label>
        <label>Görev
          <select name="assignment_role" defaultValue="coach">
            <option value="coach">Ana eğitmen</option>
            <option value="backup">Yedek eğitmen</option>
          </select>
        </label>
        <button type="submit">{pending ? "Kaydediliyor…" : "Atamayı kaydet"}</button>
      </fieldset>
      {result.error ? <p className="opAssignmentError" role="alert">{result.error}</p> : null}
      {result.saved ? <p role="status">Eğitmen ataması kaydedildi.</p> : null}
    </form>
  );
}
