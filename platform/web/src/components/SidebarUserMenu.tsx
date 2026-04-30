import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { logout } from "../api/client";

export type MeForSidebar = {
  auth:
    | {
        mode: "user";
        user: { email: string; displayName: string | null; role: string };
      }
    | { mode: "api_token"; token: { name: string; role: string } };
};

type Props = {
  me: MeForSidebar | undefined;
};

export function SidebarUserMenu({ me }: Props) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const u = me?.auth?.mode === "user" ? me.auth.user : null;
  const isUser = Boolean(u);
  const isAdmin =
    u != null
      ? u.role === "ADMIN"
      : me?.auth?.mode === "api_token" && me.auth.token.role === "ADMIN";

  const primary =
    u != null
      ? (u.displayName?.trim() || u.email)
      : me?.auth?.mode === "api_token"
        ? me.auth.token.name
        : "—";
  const secondary = u && u.displayName?.trim() ? u.email : null;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function onSignOut() {
    setOpen(false);
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="sidebar-user-menu" ref={rootRef}>
      <button
        type="button"
        className="sidebar-user-menu-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="sidebar-user-menu-text">
          <span className="sidebar-user-menu-primary">{primary}</span>
          {secondary ? <span className="sidebar-user-menu-secondary mono">{secondary}</span> : null}
        </span>
        <span className="sidebar-user-menu-chevron" aria-hidden data-open={open} />
      </button>
      {open ? (
        <ul className="sidebar-user-menu-panel" role="menu">
          {isUser ? (
            <li role="none">
              <Link className="sidebar-user-menu-item" to="/account" role="menuitem" onClick={() => setOpen(false)}>
                Account
              </Link>
            </li>
          ) : null}
          {isAdmin ? (
            <li role="none">
              <Link className="sidebar-user-menu-item" to="/platform/admin" role="menuitem" onClick={() => setOpen(false)}>
                Administration
              </Link>
            </li>
          ) : null}
          <li role="none">
            <button type="button" className="sidebar-user-menu-item sidebar-user-menu-item-danger" role="menuitem" onClick={() => void onSignOut()}>
              Sign out
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  );
}
