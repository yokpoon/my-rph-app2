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
  const activeGradient =
    colorScheme === 'amber'
      ? 'bg-gradient-to-r from-amber-500 to-indigo-600 text-white shadow-md shadow-amber-500/25'
      : colorScheme === 'purple'
      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/25'
      : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25';

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title || label}
        className={`w-11 h-11 mx-auto rounded-xl flex items-center justify-center transition-all duration-200 group relative select-none ${
          active
            ? `${activeGradient} font-bold`
            : 'text-[#869ab0] hover:text-white hover:bg-[#252f38]'
        }`}
      >
        <span className="transition-transform duration-200 group-hover:scale-110 flex items-center justify-center">
          {icon}
        </span>
        {/* Subtle notification dot for items with badges in mini mode */}
        {badge && !active && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400 ring-2 ring-[#1a2229]" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={title || label}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-left group select-none ${
        active
          ? `${activeGradient} font-semibold`
          : 'text-[#869ab0] hover:text-white hover:bg-[#252f38]'
      }`}
    >
      <span
        className={`transition-transform duration-200 group-hover:scale-110 shrink-0 ${
          active ? 'text-white' : 'text-[#869ab0] group-hover:text-cyan-400'
        }`}
      >
        {icon}
      </span>
      <span className="truncate text-xs font-medium flex-1 text-slate-100">{label}</span>
      {badge && <span className="ml-auto shrink-0">{badge}</span>}
    </button>
  );
}
