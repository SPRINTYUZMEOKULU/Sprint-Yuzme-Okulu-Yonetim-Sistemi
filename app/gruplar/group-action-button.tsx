"use client";

import { useFormStatus } from "react-dom";

type GroupActionButtonProps = {
  idleText: string;
  pendingText: string;
  className?: string;
  confirmText?: string;
};

export default function GroupActionButton({
  idleText,
  pendingText,
  className = "",
  confirmText,
}: GroupActionButtonProps) {
  const { pending } = useFormStatus();

  function handleClick(
    event: React.MouseEvent<HTMLButtonElement>
  ) {
    if (
      confirmText &&
      !window.confirm(confirmText)
    ) {
      event.preventDefault();
    }
  }

  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      aria-busy={pending}
      onClick={handleClick}
    >
      {pending ? (
        <>
          <span
            className="groupButtonSpinner"
            aria-hidden="true"
          />
          {pendingText}
        </>
      ) : (
        idleText
      )}

      <style jsx global>{`
        .groupButtonSpinner {
          display: inline-block;
          width: 15px;
          height: 15px;
          margin-right: 8px;
          border: 2px solid currentColor;
          border-right-color: transparent;
          border-radius: 50%;
          vertical-align: -3px;
          animation: groupButtonSpin 650ms linear infinite;
        }

        button[aria-busy="true"] {
          cursor: wait !important;
          opacity: 0.75;
          pointer-events: none;
        }

        @keyframes groupButtonSpin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </button>
  );
}
