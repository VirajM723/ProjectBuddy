import type { ReactNode } from 'react';
import { useAuth } from '../App';
import { LayoutList, SquarePlus, ShieldCheck, LogOut } from 'lucide-react';
import { Avatar, Mark, cx } from './ui';

type Page = 'home' | 'profile' | 'create' | 'admin' | 'project';

interface NavbarProps {
  navigate: (page: Page, id?: string) => void;
  currentPage: string;
}

interface NavItem {
  page: Page;
  label: string;
  icon: ReactNode;
  active: boolean;
}

export function Navbar({ navigate, currentPage }: NavbarProps) {
  const { user, profile, logout } = useAuth();

  const items: NavItem[] = [
    { page: 'home', label: 'Projects', icon: <LayoutList className="w-[18px] h-[18px]" strokeWidth={1.5} />, active: currentPage === 'home' || currentPage === 'project' },
    { page: 'create', label: 'Post a project', icon: <SquarePlus className="w-[18px] h-[18px]" strokeWidth={1.5} />, active: currentPage === 'create' },
    { page: 'profile', label: 'Profile', icon: <Avatar name={profile?.name || user?.name} src={profile?.profileImage} size={22} />, active: currentPage === 'profile' },
  ];
  if (profile?.role === 'admin') {
    items.push({ page: 'admin', label: 'Admin', icon: <ShieldCheck className="w-[18px] h-[18px]" strokeWidth={1.5} />, active: currentPage === 'admin' });
  }

  const go = (page: Page) => (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(page);
  };
  const hrefFor = (page: Page) => (page === 'home' ? '/' : page === 'create' ? '/create' : `/${page}`);

  return (
    <>
      {/* Desktop: icon rail */}
      <nav aria-label="Main" className="hidden md:flex fixed inset-y-0 left-0 z-40 w-14 flex-col items-center border-r border-line bg-ground py-3">
        <a href="/" onClick={go('home')} aria-label="Project Buddy, all projects" className="group relative mb-5">
          <Mark size={32} />
          <Tip>Project Buddy</Tip>
        </a>
        <ul className="flex flex-col items-center gap-1.5">
          {items.map(item => (
            <li key={item.page}>
              <a
                href={hrefFor(item.page)}
                onClick={go(item.page)}
                aria-label={item.label}
                aria-current={item.active ? 'page' : undefined}
                className={cx(
                  'group relative flex items-center justify-center w-10 h-10 rounded-md transition-colors',
                  item.active ? 'bg-raised text-ink' : 'text-muted hover:text-ink hover:bg-raised/60'
                )}
              >
                {item.icon}
                <Tip>{item.label}</Tip>
              </a>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={logout}
          aria-label="Log out"
          className="group relative mt-auto flex items-center justify-center w-10 h-10 rounded-md text-muted hover:text-ink hover:bg-raised/60 transition-colors"
        >
          <LogOut className="w-[18px] h-[18px]" strokeWidth={1.5} />
          <Tip>Log out</Tip>
        </button>
      </nav>

      {/* Phone: top bar with the product, bottom bar with the destinations */}
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between h-12 px-4 bg-ground border-b border-line">
        <a href="/" onClick={go('home')} className="flex items-center gap-2 font-medium">
          <Mark size={24} />
          Project Buddy
        </a>
        <button type="button" onClick={logout} className="flex items-center gap-1.5 h-9 px-2 -mr-2 text-sm text-muted hover:text-ink">
          <LogOut className="w-4 h-4" strokeWidth={1.5} />
          Log out
        </button>
      </header>
      <nav aria-label="Main" className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-line pb-[env(safe-area-inset-bottom)]">
        <ul className="flex">
          {items.map(item => (
            <li key={item.page} className="flex-1">
              <a
                href={hrefFor(item.page)}
                onClick={go(item.page)}
                aria-current={item.active ? 'page' : undefined}
                className={cx(
                  'flex flex-col items-center justify-center gap-1 h-14 text-xs',
                  item.active ? 'text-ink font-medium' : 'text-muted'
                )}
              >
                {item.icon}
                {item.page === 'create' ? 'Post' : item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

function Tip({ children }: { children: ReactNode }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden group-hover:block group-focus-visible:block whitespace-nowrap rounded-md bg-primary px-2 py-1 text-xs text-white shadow-md"
    >
      {children}
    </span>
  );
}
