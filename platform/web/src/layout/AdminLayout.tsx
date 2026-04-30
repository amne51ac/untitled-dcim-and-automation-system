import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet } from "react-router-dom";

import { apiJson } from "../api/client";

const FALLBACK_LINKS: { to: string; label: string; end: boolean }[] = [
  { to: "/platform/admin/tokens", label: "API tokens", end: true },
  { to: "/platform/admin/llm", label: "LLM & AI assistant", end: true },
  { to: "/platform/admin/identity", label: "Sign-in & identity", end: true },
  { to: "/platform/admin/users", label: "User management", end: true },
  { to: "/platform/admin/audit", label: "Audit log", end: true },
  { to: "/platform/admin/docs", label: "Docs & API", end: true },
  { to: "/platform/admin/health", label: "Service health", end: true },
  { to: "/platform/admin/extensions", label: "Plugins & extensions", end: true },
];

type NavItem = { href: string; label: string; order?: number };

function linkClass(active: boolean) {
  return "admin-subnav-link" + (active ? " admin-subnav-link-active" : "");
}

export function AdminLayout() {
  const nav = useQuery({
    queryKey: ["ui", "navigation", "admin"],
    queryFn: () => apiJson<{ items: NavItem[] }>("/v1/ui/navigation"),
    staleTime: 60_000,
  });

  const links =
    nav.data?.items?.map((i) => ({
      to: i.href,
      label: i.label,
      end: true as boolean,
    })) ?? FALLBACK_LINKS;

  return (
    <div className="admin-layout">
      <nav className="admin-subnav" aria-label="Administration">
        <p className="admin-subnav-title">Administration</p>
        {nav.isError ? (
          <p className="form-hint" role="status">
            Could not load navigation; showing defaults.
          </p>
        ) : null}
        <ul className="admin-subnav-list">
          {links.map(({ to, label, end }) => (
            <li key={to}>
              <NavLink to={to} end={end} className={({ isActive }) => linkClass(isActive)}>
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="admin-layout-outlet">
        <Outlet />
      </div>
    </div>
  );
}
