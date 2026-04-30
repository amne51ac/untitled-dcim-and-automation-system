import { type ReactNode } from "react";

export function CollapsibleNavSection({
  id,
  title,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="nav-section nav-section-collapsible" data-nav-section={id}>
      <button type="button" className="nav-section-toggle" onClick={onToggle} aria-expanded={open}>
        <span className="nav-section-toggle-label">{title}</span>
        <span className="nav-section-chevron" aria-hidden>
          {open ? "▼" : "▶"}
        </span>
      </button>
      {open ? <div className="nav-section-children">{children}</div> : null}
    </div>
  );
}
