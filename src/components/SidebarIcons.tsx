import React from 'react';
import {
  LayoutDashboard,
  Sparkles,
  FileEdit,
  FileText,
  CalendarDays,
  BookOpen,
  ShieldCheck,
  LineChart,
  CalendarRange,
  Users,
  Settings,
  LogOut,
  Pin,
  PinOff,
  ChevronRight,
  ChevronLeft,
  X,
  Menu,
  Sun,
  Moon,
  Check,
} from 'lucide-react';

export {
  LayoutDashboard,
  Sparkles,
  FileEdit,
  FileText,
  CalendarDays,
  BookOpen,
  ShieldCheck,
  LineChart,
  CalendarRange,
  Users,
  Settings,
  LogOut,
  Pin,
  PinOff,
  ChevronRight,
  ChevronLeft,
  X,
  Menu,
  Sun,
  Moon,
  Check,
};

export interface SidebarNavItemProps {
  icon: React.ReactNode;
  label: string;
  badge?: React.ReactNode;
  active: boolean;
  expanded: boolean;
  colorScheme?: 'cyan' | 'amber' | 'purple';
  onClick: () => void;
  title?: string;
}

export function SidebarNavItem({
  icon,
  label,
  badge,
  active,
  expanded,
  colorScheme = 'cyan',
  onClick,
  title,
}: SidebarNavItemProps) {
  // Murmura Dock & Pill palette:
  // Dock surface: #16191d, Butter accent: #f2b740, Pine accent: #11745a
  const activeStyle =
    colorScheme === 'amber'
      ? 'bg-[#f2b740] text-[#16191d] shadow-md shadow-[#f2b740]/25'
      : colorScheme === 'purple'
      ? 'bg-[#11745a] text-[#f6f7f5] shadow-md shadow-[#11745a]/25'
      : 'bg-[#f2b740] text-[#16191d] shadow-md shadow-[#f2b740]/20';

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title || label}
        aria-current={active ? 'page' : undefined}
        className={`murmura-nav-btn w-12 h-12 mx-auto rounded-full flex items-center justify-center group relative select-none ${
          active
            ? 'bg-white/15 text-[#f6f7f5] opacity-100 font-bold'
            : 'text-[#f6f7f5]/70 hover:text-[#f6f7f5] hover:bg-white/10 opacity-80 hover:opacity-100'
        }`}
      >
        <span className="murmura-nav-icon flex items-center justify-center">
          {icon}
        </span>
        {/* Murmura butter active indicator dot on right edge */}
        {active && (
          <span
            aria-hidden="true"
            className="absolute right-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#f2b740]"
          />
        )}
        {/* Coral dot for items with badges in mini dock mode */}
        {badge && !active && (
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#c43c30] ring-2 ring-[#16191d]" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={title || label}
      aria-current={active ? 'page' : undefined}
      className={`murmura-nav-btn relative w-full flex items-center gap-3 px-3.5 py-2.5 rounded-full text-left group select-none overflow-hidden ${
        active
          ? `${activeStyle} font-bold`
          : 'text-[#f6f7f5]/75 hover:text-[#f6f7f5] hover:bg-white/10'
      }`}
    >
      <span
        className={`murmura-nav-icon shrink-0 ${
          active ? 'text-current' : 'text-[#f6f7f5]/75 group-hover:text-[#f2b740]'
        }`}
      >
        {icon}
      </span>
      <span
        className={`truncate text-xs flex-1 ${
          active ? 'font-bold text-current' : 'font-semibold text-[#f6f7f5]'
        }`}
      >
        {label}
      </span>
      {badge && <span className="ml-auto shrink-0">{badge}</span>}
    </button>
  );
}
