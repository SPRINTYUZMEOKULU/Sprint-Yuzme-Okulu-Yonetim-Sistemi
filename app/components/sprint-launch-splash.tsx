"use client";

import { useEffect, useState } from "react";

/**
 * A brief visual continuation of Android's native PWA splash.
 * All animation runs on-device (CSS); no timers, API calls or server work.
 * It never blocks navigation and displays only on initial standalone launch.
 */
export default function SprintLaunchSplash() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (!standalone) return;

    // Show only on the first load of this document, not on every route transition.
    const frame = window.requestAnimationFrame(() => setVisible(true));
    const hide = window.setTimeout(() => setVisible(false), 1050);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(hide);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="sprintLaunchSplash" aria-hidden="true">
      <div className="sprintLaunchFrame">
        <div className="sprintLaunchInner">
          {/* Existing original brand file, reused locally from the PWA assets. */}
          <img src="/sprint-logo.png?v=6" alt="" width={220} height={220} />
        </div>
      </div>
      <style jsx>{`
        .sprintLaunchSplash {
          position: fixed;
          inset: 0;
          z-index: 2147483000;
          display: grid;
          place-items: center;
          pointer-events: none;
          background: radial-gradient(circle at 50% 44%, #0a3484 0%, #061d53 52%, #03132f 100%);
          animation: sprintLaunchOut 1.05s ease-out both;
        }
        .sprintLaunchFrame {
          width: min(58vw, 244px);
          aspect-ratio: 1;
          padding: 5px;
          border-radius: 29px;
          background: linear-gradient(130deg, #ffdc8c, #7bd6ff 42%, #1f86f4 70%, #ffd48a);
          box-shadow: 0 0 12px #38aaff55, 0 0 26px #258cfa38;
          animation: sprintLaunchGlow 1.05s ease-in-out both;
        }
        .sprintLaunchInner {
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          overflow: hidden;
          border-radius: 24px;
          background: linear-gradient(145deg,#fff,#e9f4ff);
        }
        .sprintLaunchInner img {
          width: 94%;
          height: 94%;
          object-fit: contain;
        }
        @keyframes sprintLaunchGlow {
          0%,100% { box-shadow: 0 0 9px #38aaff44; }
          48% { box-shadow: 0 0 22px #41baffbb, 0 0 44px #248afa77; }
        }
        @keyframes sprintLaunchOut {
          0%,70% { opacity: 1; }
          100% { opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .sprintLaunchSplash,.sprintLaunchFrame { animation: none; }
          .sprintLaunchSplash { opacity: .96; }
        }
      `}</style>
    </div>
  );
}
