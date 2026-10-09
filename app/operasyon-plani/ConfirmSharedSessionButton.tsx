"use client";

type Props = {
  label: string;
  warning: string;
  className?: string;
  style?: React.CSSProperties;
};

export default function ConfirmSharedSessionButton({ label, warning, className, style }: Props) {
  return (
    <button
      type="submit"
      className={className}
      style={style}
      onClick={(event) => {
        if (!window.confirm(warning + "\n\nOnay verirseniz bu seans birlikte çalıştırılır. Öğrenci kayıt günleri, ders hakları ve ödemeler değiştirilmez.\n\nDevam edilsin mi?")) {
          event.preventDefault();
        }
      }}
    >
      {label}
    </button>
  );
}
