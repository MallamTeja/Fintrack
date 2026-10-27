// One hand-drawn icon set: 24px grid, 1.5px stroke, square-ish terminals. Decorative by default.
const PATHS = {
  dashboard: (
    <>
      <path d="M4 5h16M4 12h10M4 19h16" />
      <path d="M18 9v6" />
    </>
  ),
  ledger: (
    <>
      <rect x="4.5" y="3.5" width="15" height="17" rx="1.5" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  budget: (
    <>
      <path d="M4 18h16" />
      <path d="M6 18V9M10 18V6M14 18v-5M18 18v-8" />
    </>
  ),
  savings: (
    <>
      <path d="M6 9.5h12l-1 10.5H7z" />
      <path d="M8.5 9.5V7a3.5 3.5 0 0 1 7 0v2.5" />
      <path d="M12 13v4" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M15.5 6a3 3 0 0 1 0 5.5M17 14a5.5 5.5 0 0 1 3.5 5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  edit: (
    <>
      <path d="M14.5 5.5l4 4L9 19H5v-4z" />
      <path d="M12.5 7.5l4 4" />
    </>
  ),
  trash: (
    <>
      <path d="M5 7h14M10 7V5h4v2" />
      <path d="M7 7l1 12h8l1-12" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
    </>
  ),
  moon: <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z" />,
  logout: (
    <>
      <path d="M14 4h4.5v16H14" />
      <path d="M10 8l-4 4 4 4M6 12h9" />
    </>
  ),
  left: <path d="M14.5 6l-6 6 6 6" />,
  right: <path d="M9.5 6l6 6-6 6" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  dot: <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />,
  import: (
    <>
      <path d="M12 4v10M8 10l4 4 4-4" />
      <path d="M5 15v4.5h14V15" />
    </>
  ),
  export: (
    <>
      <path d="M12 14V4M8 8l4-4 4 4" />
      <path d="M5 15v4.5h14V15" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5" />
    </>
  ),
  file: (
    <>
      <path d="M6.5 3.5h7l4 4v13h-11z" />
      <path d="M13.5 3.5v4h4M9 12.5h6M9 16h6" />
    </>
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 8.5v7M9.5 12h5" />
    </>
  ),
};

export default function Icon({ name, size = 20, label, className }) {
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true, focusable: 'false' };
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...a11y}
    >
      {PATHS[name]}
    </svg>
  );
}
