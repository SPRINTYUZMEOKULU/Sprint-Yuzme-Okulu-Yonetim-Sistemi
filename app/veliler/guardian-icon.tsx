type IconName = "file" | "users" | "shield" | "message" | "key" | "filter" | "unlink" | "trash" | "arrow";
const paths: Record<IconName, string> = {
  file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z M14 2v6h6 M8 13h8 M8 17h6",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  shield: "M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z M9 12l2 2 4-4",
  message: "M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z",
  key: "M21 2l-2 2 M19 4l3 3-4 4-3-3 M15 8l-5 5 M11 16a5 5 0 1 1-10 0 5 5 0 0 1 10 0",
  filter: "M4 6h16 M7 12h10 M10 18h4",
  unlink: "M3 3l18 18 M10 13a5 5 0 0 1-7-7l3-3 M14 11a5 5 0 0 1 7 7l-3 3 M15 3h6v6 M3 15v6h6",
  trash: "M3 6h18 M9 6V4h6v2 M5 6l1 14h12l1-14 M10 10v6 M14 10v6",
  arrow: "M5 12h14 M13 6l6 6-6 6",
};
export default function GuardianIcon({ name }: { name: IconName }) {
  return <svg className="guardianIcon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={paths[name]} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
