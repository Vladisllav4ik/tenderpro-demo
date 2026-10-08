import { accountInitials } from "@/lib/account-model";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Box,
  Files,
  Settings,
  Bot,
  User,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { useAccount } from "@/lib/account";
import { logout } from "@/lib/account-session";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
export function GlobalHotbar() {
  const account = useAccount()!;
  const path = useRouterState({ select: (s) => s.location.pathname });
  const links = [
    { to: "/tenders", label: "Тендери", icon: Files },
    { to: "/settings", label: "Налаштування", icon: Settings },
    ...(account.role === "ADMIN"
      ? [{ to: "/agents", label: "AI Агенти", icon: Bot }]
      : []),
  ];
  return (
    <header className="sheet-toolbar global-hotbar">
      <Link
        to="/tenders"
        className="sheet-brand"
        aria-label="TenderPro — Тендери"
      >
        <span className="sheet-mark">
          <Box />
        </span>
        <strong>TenderPro</strong>
      </Link>
      <nav aria-label="Глобальна навігація">
        {links.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={`sheet-tool ${path.startsWith(to) ? "is-current" : ""}`}
            aria-current={path.startsWith(to) ? "page" : undefined}
          >
            <Icon />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      <Popover>
        <PopoverTrigger asChild>
          <button
            className="sheet-tool global-account"
            aria-label="Меню акаунта"
          >
            <span className="global-avatar">
              {accountInitials(account.name)}
            </span>
            <span className="global-account-name">{account.name}</span>
            <small>{account.role}</small>
            <ChevronDown />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="sheet-menu global-account-menu">
          <p className="sheet-menu-heading">
            {account.name} · {account.role}
            <span className="global-account-email">{account.email}</span>
          </p>
          <Link className="sheet-nav-link" to="/profile">
            <User />
            Профіль
          </Link>
          <Link className="sheet-nav-link" to="/settings">
            <Settings />
            Налаштування
          </Link>
          <button
            className="sheet-nav-link"
            onClick={async () => {
              await logout();
              window.location.assign("/login");
            }}
          >
            <LogOut />
            Вийти
          </button>
        </PopoverContent>
      </Popover>
    </header>
  );
}
