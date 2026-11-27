import { formatDisplayDate } from "@/lib/dates/display";

export type RegistrationPeriodNote = {
  id: string;
  note: string;
  startDate: string | null;
  plannedEndDate: string | null;
};

export default function RegistrationPeriodNotes({ notes }: { notes?: RegistrationPeriodNote[] }) {
  if (!notes?.length) return null;

  return (
    <section aria-label="Kayıt dönemi notları">
      <h3>Kayıt dönemi notları</h3>
      <div className="list">
        {notes.map((note) => (
          <article key={note.id}>
            <div>
              <strong>
                {formatDisplayDate(note.startDate)} – {formatDisplayDate(note.plannedEndDate)}
              </strong>
              <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{note.note}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
