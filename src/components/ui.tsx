import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Project } from '../types';
import { getId } from '../services/api';

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

// One control height (36px) and one radius (6px) across the app
const buttonBase = 'inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-60 disabled:cursor-not-allowed';
export const buttonStyles = {
  primary: `${buttonBase} bg-primary text-white hover:bg-primary-hover`,
  secondary: `${buttonBase} bg-raised text-ink hover:bg-control`,
  ghost: `${buttonBase} text-ink hover:bg-raised`,
  danger: `${buttonBase} text-negative hover:bg-neg-bg`,
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof buttonStyles;
}

export function Button({ variant = 'secondary', className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={cx(buttonStyles[variant], className)} {...rest} />;
}

export const inputStyles = 'w-full h-10 px-3 bg-surface border border-line rounded-md text-sm text-ink outline-none transition-colors focus:border-ink';
export const labelStyles = 'block text-sm font-medium mb-2';
export const cardStyles = 'bg-surface border border-line rounded-lg';

type Tone = 'positive' | 'negative' | 'warning' | 'neutral';
const toneStyles: Record<Tone, string> = {
  positive: 'bg-pos-bg text-pos-ink',
  negative: 'bg-neg-bg text-neg-ink',
  warning: 'bg-warn-bg text-warn-ink',
  neutral: 'bg-neutral-bg text-neutral-ink',
};

export function Pill({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cx('inline-flex flex-none items-center h-5 px-2 rounded text-xs font-medium whitespace-nowrap', toneStyles[tone])}>
      {children}
    </span>
  );
}

export const projectStatusTone = (status: string): Tone =>
  status === 'Open' || status === 'Reopened' ? 'positive' : 'neutral';

export const requestStatusTone = (status: string): Tone =>
  status === 'Accepted' ? 'positive' : status === 'Rejected' ? 'negative' : 'warning';

// The product's mark: a filled seat beside an open one
export function Mark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <rect width="32" height="32" rx="8" fill="#141414" />
      <rect x="6" y="12" width="8" height="8" rx="2" fill="#ffffff" />
      <rect x="19" y="13" width="6" height="6" rx="1.5" fill="none" stroke="#ffffff" strokeWidth="2" />
    </svg>
  );
}

// Registration assigns a grey silhouette; people without their own photo get initials instead
const isPlaceholderImage = (src?: string | null) =>
  !src || (src.startsWith('data:image/svg+xml') && src.includes('%23DBDBDB'));

// A stable pale tint per person, skipping the violet band
function personHue(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hue = h % 290;
  return hue < 230 ? hue : hue + 70;
}

export function initials(name?: string) {
  if (!name) return '?';
  return name.trim().split(/\s+/).map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

interface AvatarProps {
  name?: string;
  src?: string | null;
  size?: number;
  className?: string;
}

export function Avatar({ name, src, size = 32, className }: AvatarProps) {
  if (!isPlaceholderImage(src)) {
    return (
      <img
        src={src!}
        alt=""
        width={size}
        height={size}
        className={cx('rounded-full object-cover flex-none bg-raised', className)}
        style={{ width: size, height: size }}
        referrerPolicy="no-referrer"
      />
    );
  }
  const hue = personHue(name || '?');
  return (
    <span
      aria-hidden="true"
      className={cx('rounded-full flex-none inline-flex items-center justify-center font-medium select-none', className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(11, Math.round(size * 0.38)),
        background: `hsl(${hue} 45% 91%)`,
        color: `hsl(${hue} 45% 26%)`,
      }}
    >
      {initials(name)}
    </span>
  );
}

// Closed and completed projects no longer take requests
export const isRecruiting = (project: Project) => project.status !== 'Closed' && project.status !== 'Completed';

// Roles the owner asked for that nobody on the team has taken yet
export function openRoles(project: Project) {
  if (!isRecruiting(project)) return [];
  const taken = Object.values(project.userRoles || {}).map(r => r.trim().toLowerCase());
  return (project.requiredRoles || []).filter(role => !taken.includes(role.trim().toLowerCase()));
}

export function teamSize(project: Project) {
  const ids = new Set([getId(project.ownerId), ...(project.acceptedUsers || []).map(getId)].filter(Boolean));
  return ids.size;
}

// One square per person on the team, one outlined square in the data hue per open role
export function SeatStrip({ filled, open, max = 8 }: { filled: number; open: number; max?: number }) {
  const shownFilled = Math.min(filled, max);
  const shownOpen = Math.min(open, Math.max(0, max - shownFilled));
  return (
    <span className="inline-flex items-center gap-1 flex-none" aria-hidden="true">
      {Array.from({ length: shownFilled }).map((_, i) => (
        <span key={`f${i}`} className="w-2.5 h-2.5 rounded-[2px] bg-ink" />
      ))}
      {Array.from({ length: shownOpen }).map((_, i) => (
        <span key={`o${i}`} className="w-2.5 h-2.5 rounded-[2px] border-[1.5px] border-data" />
      ))}
    </span>
  );
}

export function seatSummary(filled: number, open: number) {
  const team = `${filled} on the team`;
  if (open === 0) return `${team} · no open roles`;
  return `${team} · ${open} ${open === 1 ? 'role' : 'roles'} open`;
}

export function Notice({ children, onDismiss }: { children: ReactNode; onDismiss?: () => void }) {
  return (
    <div className="flex items-start gap-3 bg-warn-bg border border-warn-line text-warn-ink rounded-md px-3 py-2 text-sm">
      <div className="flex-1">{children}</div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="text-sm font-medium underline underline-offset-2">
          Dismiss
        </button>
      )}
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <p role="alert" className="text-sm text-negative">{children}</p>;
}
