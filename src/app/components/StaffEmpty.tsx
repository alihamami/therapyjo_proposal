// Empty state, design 3B (TJ-069e1, decision P1-3): an icon, a title, a
// one-sentence hint and, where the viewer's role can add, the Add button.
// Titles read "No … yet" for an empty list and "No … match your search" when
// a search finds nothing. The styles are global (.staff-empty-* in
// globals.css), so it looks the same wherever a page renders it.

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface StaffEmptyProps {
    icon: LucideIcon;
    title: string;
    hint?: string;
    /** The Add button, only where the viewer's role can add. */
    action?: ReactNode;
}

export default function StaffEmpty({ icon: Icon, title, hint, action }: StaffEmptyProps) {
    return (
        <div className="staff-empty">
            <span className="staff-empty-icon"><Icon size={20} aria-hidden="true" /></span>
            <p className="staff-empty-title">{title}</p>
            {hint && <p className="staff-empty-hint">{hint}</p>}
            {action}
        </div>
    );
}
