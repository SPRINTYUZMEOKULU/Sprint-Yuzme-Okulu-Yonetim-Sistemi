"use client";

import {
  useState,
} from "react";

type PasswordFieldProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  showGenerator?: boolean;
};

function createTemporaryPassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "!@#$%";

  const all =
    upper + lower + numbers + symbols;

  const required = [
    upper[
      Math.floor(
        Math.random() * upper.length
      )
    ],
    lower[
      Math.floor(
        Math.random() * lower.length
      )
    ],
    numbers[
      Math.floor(
        Math.random() * numbers.length
      )
    ],
    symbols[
      Math.floor(
        Math.random() * symbols.length
      )
    ],
  ];

  for (let index = 0; index < 6; index++) {
    required.push(
      all[
        Math.floor(
          Math.random() * all.length
        )
      ]
    );
  }

  return required
    .sort(() => Math.random() - 0.5)
    .join("");
}

export default function PasswordField({
  value,
  onChange,
  disabled = false,
  placeholder = "En az 8 karakter",
  showGenerator = true,
}: PasswordFieldProps) {
  const [visible, setVisible] =
    useState(false);

  const [copied, setCopied] =
    useState(false);

  async function copyPassword() {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        value
      );

      setCopied(true);

      window.setTimeout(
        () => setCopied(false),
        1800
      );
    } catch {
      setCopied(false);
    }
  }

  function generatePassword() {
    const password =
      createTemporaryPassword();

    onChange(password);
    setVisible(true);
    setCopied(false);
  }

  const valid =
    value.length >= 8;

  return (
    <div className="securePasswordField">
      <div className="securePasswordInputRow">
        <input
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setCopied(false);
          }}
          type={
            visible ? "text" : "password"
          }
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="new-password"
          minLength={8}
        />

        <button
          type="button"
          className="passwordIconButton"
          onClick={() =>
            setVisible(
              (current) => !current
            )
          }
          disabled={disabled}
          aria-label={
            visible
              ? "Şifreyi gizle"
              : "Şifreyi göster"
          }
          title={
            visible
              ? "Şifreyi Gizle"
              : "Şifreyi Göster"
          }
        >
          {visible ? (
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                d="M3 3l18 18M10.6 10.7a2 2 0 002.7 2.7M9.9 4.3A10.7 10.7 0 0112 4c5.5 0 9 5 9 5a15.7 15.7 0 01-2.2 2.7M6.6 6.6C4.3 8.1 3 10 3 10s3.5 5 9 5a9.6 9.6 0 003.4-.6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                d="M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              <circle
                cx="12"
                cy="12"
                r="2.6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              />
            </svg>
          )}
        </button>

        <button
          type="button"
          className={
            copied
              ? "passwordCopyButton copied"
              : "passwordCopyButton"
          }
          onClick={copyPassword}
          disabled={
            disabled || !value
          }
        >
          {copied
            ? "Kopyalandı ✓"
            : "Kopyala"}
        </button>
      </div>

      <div className="passwordStatusRow">
        <span
          className={
            value
              ? valid
                ? "passwordValid"
                : "passwordInvalid"
              : ""
          }
        >
          {!value
            ? "En az 8 karakter girin."
            : valid
              ? "✓ Şifre kullanıma hazır"
              : `En az ${
                  8 - value.length
                } karakter daha gerekli.`}
        </span>

        {showGenerator ? (
          <button
            type="button"
            className="generatePasswordButton"
            onClick={generatePassword}
            disabled={disabled}
          >
            Güvenli Şifre Oluştur
          </button>
        ) : null}
      </div>

      <style jsx global>{`
        .securePasswordField {
          width: 100%;
          display: grid;
          gap: 8px;
        }

        .securePasswordInputRow {
          width: 100%;
          min-width: 0;
          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            44px
            auto;
          gap: 7px;
        }

        .securePasswordInputRow input {
          width: 100%;
          min-width: 0;
          min-height: 46px;
          box-sizing: border-box;
          padding: 11px 12px;
          border: 1px solid #d8e2ee;
          border-radius: 11px;
          outline: none;
          background: #ffffff;
          color: #0f172a;
          font-size: 14px;
        }

        .securePasswordInputRow
          input:focus {
          border-color: #3688ef;
          box-shadow: 0 0 0 4px
            rgba(23, 105, 232, 0.1);
        }

        .passwordIconButton,
        .passwordCopyButton,
        .generatePasswordButton {
          border: 1px solid #d8e2ee;
          border-radius: 11px;
          background: #ffffff;
          color: #274261;
          font-weight: 850;
          cursor: pointer;
          transition:
            transform 150ms ease,
            border-color 150ms ease,
            background-color 150ms ease;
        }

        .passwordIconButton {
          width: 44px;
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
        }

        .passwordIconButton svg {
          width: 21px;
          height: 21px;
        }

        .passwordCopyButton {
          min-height: 44px;
          padding: 9px 13px;
          font-size: 11px;
        }

        .passwordCopyButton.copied {
          border-color: #a8e2c7;
          background: #effbf5;
          color: #08764e;
        }

        .passwordIconButton:hover,
        .passwordCopyButton:hover,
        .generatePasswordButton:hover {
          transform: translateY(-1px);
          border-color: #9fc4f7;
          background: #f3f8ff;
        }

        .passwordIconButton:disabled,
        .passwordCopyButton:disabled,
        .generatePasswordButton:disabled {
          cursor: not-allowed;
          opacity: 0.55;
          transform: none;
        }

        .passwordStatusRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          color: #71809a;
          font-size: 11px;
        }

        .passwordValid {
          color: #08764e;
          font-weight: 850;
        }

        .passwordInvalid {
          color: #b4232c;
          font-weight: 850;
        }

        .generatePasswordButton {
          padding: 7px 10px;
          color: #1769e8;
          font-size: 10px;
        }

        @media (max-width: 520px) {
          .securePasswordInputRow {
            grid-template-columns:
              minmax(0, 1fr)
              44px;
          }

          .passwordCopyButton {
            grid-column: 1 / -1;
            width: 100%;
          }

          .passwordStatusRow {
            align-items: flex-start;
            flex-direction: column;
          }

          .generatePasswordButton {
            width: 100%;
            min-height: 40px;
          }
        }
      `}</style>
    </div>
  );
}
