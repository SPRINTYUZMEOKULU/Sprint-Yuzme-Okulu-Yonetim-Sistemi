import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const Icons = {
  dashboard: (props: IconProps) => (
    <IconBase {...props}>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </IconBase>
  ),
  child: (props: IconProps) => (
    <IconBase {...props}>
      <circle cx="12" cy="7" r="3" />
      <path d="M5.5 21v-2.5a6.5 6.5 0 0 1 13 0V21" />
      <path d="M9 13.2 12 16l3-2.8" />
    </IconBase>
  ),
  users: (props: IconProps) => (
    <IconBase {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </IconBase>
  ),
  branch: (props: IconProps) => (
    <IconBase {...props}>
      <circle cx="6" cy="5" r="2" />
      <circle cx="18" cy="6" r="2" />
      <circle cx="18" cy="18" r="2" />
      <path d="M8 5h3a4 4 0 0 1 4 4v5M8 5v13h8" />
    </IconBase>
  ),
  calendar: (props: IconProps) => (
    <IconBase {...props}>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M16 3v4M8 3v4M3 10h18" />
      <path d="m9 15 2 2 4-4" />
    </IconBase>
  ),
  check: (props: IconProps) => (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.7 2.7L16.5 9" />
    </IconBase>
  ),
  approval: (props: IconProps) => (
    <IconBase {...props}>
      <path d="M9 3h6a2 2 0 0 1 2 2v2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2V5a2 2 0 0 1 2-2Z" />
      <path d="M8 7h8M8 14l2.5 2.5L16 11" />
    </IconBase>
  ),
  wallet: (props: IconProps) => (
    <IconBase {...props}>
      <path d="M4 6.5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3v-12a3 3 0 0 1 3-3h12" />
      <path d="M16 12h5v5h-5a2.5 2.5 0 0 1 0-5Z" />
      <circle cx="16.5" cy="14.5" r=".5" fill="currentColor" stroke="none" />
    </IconBase>
  ),
  message: (props: IconProps) => (
    <IconBase {...props}>
      <path d="M21 12a8 8 0 0 1-8 8H6l-4 2 1.5-4.5A9 9 0 1 1 21 12Z" />
      <path d="M8 12h.01M12 12h.01M16 12h.01" />
    </IconBase>
  ),
  bell: (props: IconProps) => (
    <IconBase {...props}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </IconBase>
  ),
  note: (props: IconProps) => (
    <IconBase {...props}>
      <path d="M6 3h9l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M14 3v5h5M8 13h7M8 17h5" />
    </IconBase>
  ),
  chart: (props: IconProps) => (
    <IconBase {...props}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </IconBase>
  ),
  settings: (props: IconProps) => (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.09A1.7 1.7 0 0 0 9 19.35a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15 1.7 1.7 0 0 0 3.07 14H3v-4h.09A1.7 1.7 0 0 0 4.65 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63h.02A1.7 1.7 0 0 0 10 3.07V3h4v.09A1.7 1.7 0 0 0 15 4.65a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9v.02A1.7 1.7 0 0 0 20.93 10H21v4h-.09A1.7 1.7 0 0 0 19.4 15Z" />
    </IconBase>
  ),
  clock: (props: IconProps) => (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </IconBase>
  ),
  cake: (props: IconProps) => (
    <IconBase {...props}>
      <path d="M4 13h16v7H4zM4 16c2 0 2-1.5 4-1.5S10 16 12 16s2-1.5 4-1.5S18 16 20 16" />
      <path d="M7 13V9h10v4M9 9V6M12 9V5M15 9V6" />
      <path d="M9 4c.7-.7.7-1.3 0-2M12 3c.7-.7.7-1.3 0-2M15 4c.7-.7.7-1.3 0-2" />
    </IconBase>
  ),
  arrow: (props: IconProps) => (
    <IconBase {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </IconBase>
  ),
  logout: (props: IconProps) => (
    <IconBase {...props}>
      <path d="M10 17l5-5-5-5M15 12H3" />
      <path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" />
    </IconBase>
  ),
};
