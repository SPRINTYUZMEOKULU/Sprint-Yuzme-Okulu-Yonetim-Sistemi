"use client";

export default function RenewalMobilePolish() {
  return (
    <style jsx global>{`
      .studentFilePage .renewalQuickButton {
        position: relative;
        z-index: 2;
        min-height: 44px !important;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
        cursor: pointer !important;
        pointer-events: auto !important;
      }

      .renewalOverlay {
        height: 100dvh !important;
        overscroll-behavior: contain;
      }

      .renewalPanel {
        height: 100dvh !important;
        max-height: 100dvh !important;
      }

      .renewalPanel .renewalBody {
        min-height: 0;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior-y: contain;
      }

      .renewalPanel footer {
        position: sticky !important;
        bottom: 0;
        z-index: 8;
        flex: 0 0 auto;
        padding-bottom: max(16px, env(safe-area-inset-bottom)) !important;
        box-shadow: 0 -10px 28px rgba(21, 45, 75, .08);
      }

      .renewalPanel footer button,
      .renewalPanel header button,
      .renewalPanel input,
      .renewalPanel select,
      .renewalPanel textarea,
      .renewalPanel label {
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
      }

      .renewalPanel footer button {
        min-height: 50px !important;
        pointer-events: auto !important;
      }

      @media (max-width: 640px) {
        .renewalPanel {
          width: 100vw !important;
          max-width: 100vw !important;
        }

        .renewalPanel header {
          position: sticky;
          top: 0;
          z-index: 7;
        }

        .renewalPanel .renewalBody {
          padding: 16px !important;
          padding-bottom: 24px !important;
        }

        .renewalPanel footer {
          gap: 10px !important;
          padding-left: 14px !important;
          padding-right: 14px !important;
        }

        .renewalPanel footer .primary {
          min-height: 54px !important;
          font-size: 14px !important;
        }
      }
    `}</style>
  );
}
