import type { MouseEvent } from "react";

/**
 * Whether a click on a list row should open the row's record (design 5B,
 * TJ-068f1). Not when it landed on a link, button, form control or a row
 * menu (they do their own thing), and not when it ended a text selection.
 */
export function shouldOpenRow(e: MouseEvent): boolean {
    const target = e.target as HTMLElement;
    if (target.closest("a, button, input, select, textarea, label, [role='menu']")) return false;
    if (window.getSelection()?.toString()) return false;
    return true;
}
