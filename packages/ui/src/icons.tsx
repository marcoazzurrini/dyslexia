import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

const styles = stylex.create({
  icon: {
    flexShrink: 0,
    height: "1.25em",
    width: "1.25em",
  },
});

/**
 * Icons drawn on a 24-unit grid in the style of SF Symbols. They are
 * decorative: the control that holds one must carry the accessible name.
 * They size to the surrounding text and take its color.
 */
const icon = (paths: ReactNode, filled = false) => {
  const Icon = () => (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...stylex.props(styles.icon)}
    >
      {paths}
    </svg>
  );
  return Icon;
};

export const PlusIcon = icon(<path d="M12 5v14M5 12h14" />);
export const ChevronLeftIcon = icon(<path d="m15 5-7 7 7 7" />);
export const ChevronRightIcon = icon(<path d="m9 5 7 7-7 7" />);
export const ChevronDownIcon = icon(<path d="m5 9 7 7 7-7" />);
export const CloseIcon = icon(<path d="M6 6l12 12M18 6 6 18" />);
export const CheckIcon = icon(<path d="m5 12.5 4.5 4.5L19 7.5" />);
export const PlayIcon = icon(
  <path d="M7.5 4.6v14.8a1 1 0 0 0 1.5.86l12.3-7.4a1 1 0 0 0 0-1.72L9 3.74a1 1 0 0 0-1.5.86Z" />,
  true
);
export const PauseIcon = icon(
  <>
    <rect x="5.5" y="4" width="4.5" height="16" rx="1.2" />
    <rect x="14" y="4" width="4.5" height="16" rx="1.2" />
  </>,
  true
);
export const BackIcon = icon(
  <>
    <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
    <path d="M4.5 4v3.2h3.2" />
    <text
      x="12.3"
      y="15.2"
      fontSize="7.5"
      fontWeight="700"
      textAnchor="middle"
      fill="currentColor"
      stroke="none"
    >
      15
    </text>
  </>
);
export const ForwardIcon = icon(
  <>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
    <path d="M19.5 4v3.2h-3.2" />
    <text
      x="11.7"
      y="15.2"
      fontSize="7.5"
      fontWeight="700"
      textAnchor="middle"
      fill="currentColor"
      stroke="none"
    >
      15
    </text>
  </>
);
export const WarningIcon = icon(
  <>
    <path d="M10.3 4.2 2.6 17.6A2 2 0 0 0 4.3 20.6h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9.5v4M12 17h.01" />
  </>
);
export const InfoIcon = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5M12 7.5h.01" />
  </>
);
export const LinkIcon = icon(
  <>
    <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
    <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
  </>
);
export const ExternalIcon = icon(
  <>
    <path d="M14 4h6v6M20 4l-9 9" />
    <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
  </>
);
export const WaveformIcon = icon(
  <path d="M3 12h1M7 8v8M11 4v16M15 7v10M19 10v4M21 12h0" />
);
export const PersonIcon = icon(
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20.5a8 8 0 0 1 16 0" />
  </>
);
export const SpeedIcon = icon(
  <>
    <path d="M4.2 16.5a8.5 8.5 0 1 1 15.6 0" />
    <path d="m12 13 4-4.5" />
  </>
);
export const EllipsisIcon = icon(
  <>
    <circle cx="5" cy="12" r="1.75" />
    <circle cx="12" cy="12" r="1.75" />
    <circle cx="19" cy="12" r="1.75" />
  </>,
  true
);
export const TrashIcon = icon(
  <>
    <path d="M4 7h16M10 3.5h4M6.5 7l.8 11.6A2 2 0 0 0 9.3 20.5h5.4a2 2 0 0 0 2-1.9L17.5 7" />
    <path d="M10 11v5.5M14 11v5.5" />
  </>
);
