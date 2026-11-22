"use client";

// Row actions, design 5B (TJ-068f1). A ⋯ button that opens a small menu of
// the actions other than "open the record". The menu is portalled to <body>
// with fixed positioning, so a table's overflow never clips it, and it is
// aligned to the button's inline end, so it mirrors under dir="rtl".
// Keyboard: Enter/Space on the button opens it and focuses the first item;
// ArrowUp/ArrowDown move; Escape closes and returns focus; Tab closes.
// Destructive items come last, after a divider.

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface RowMenuItem {
    label: string;
    icon?: LucideIcon;
    onSelect: () => void;
    destructive?: boolean;
}

interface Props {
    items: RowMenuItem[];
    /** Accessible name of the ⋯ button, e.g. "More actions for Sara Khalil". */
    label: string;
}

type Pos = { top: number; left?: number; right?: number };

export default function RowMenu({ items, label }: Props) {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState<Pos | null>(null);
    const btnRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const menuId = useId();

    const close = (returnFocus: boolean) => {
        setOpen(false);
        setPos(null);
        if (returnFocus) btnRef.current?.focus();
    };

    // Place the menu once it has rendered and can be measured: below the
    // button, or above it when there is no room below.
    useLayoutEffect(() => {
        if (!open || !btnRef.current || !menuRef.current) return;
        const r = btnRef.current.getBoundingClientRect();
        const h = menuRef.current.offsetHeight;
        const below = r.bottom + 4;
        const above = r.top - 4 - h;
        const top = below + h > window.innerHeight && above >= 0 ? above : below;
        const rtl = getComputedStyle(btnRef.current).direction === "rtl";
        setPos(rtl ? { top, left: r.left } : { top, right: document.documentElement.clientWidth - r.right });
    }, [open]);

    // Focus the first item once the menu is placed (a hidden element cannot take focus).
    useEffect(() => {
        if (open && pos) menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus({ preventScroll: true });
    }, [open, pos]);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: globalThis.MouseEvent) => {
            const t = e.target as Node;
            if (!menuRef.current?.contains(t) && !btnRef.current?.contains(t)) close(false);
        };
        const onMove = () => close(false);
        document.addEventListener("mousedown", onDown);
        window.addEventListener("scroll", onMove, true);
        window.addEventListener("resize", onMove);
        return () => {
            document.removeEventListener("mousedown", onDown);
            window.removeEventListener("scroll", onMove, true);
            window.removeEventListener("resize", onMove);
        };
    }, [open]);

    const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
        e.stopPropagation();
        const els = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
        const i = els.indexOf(document.activeElement as HTMLButtonElement);
        if (e.key === "ArrowDown") { e.preventDefault(); els[(i + 1) % els.length]?.focus(); }
        else if (e.key === "ArrowUp") { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus(); }
        else if (e.key === "Escape") { e.preventDefault(); close(true); }
        else if (e.key === "Tab") { close(false); }
    };

    const renderItem = (item: RowMenuItem) => {
        const Icon = item.icon;
        return (
            <button
                key={item.label}
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={item.destructive ? "row-menu-item danger" : "row-menu-item"}
                onClick={(e) => {
                    e.stopPropagation();
                    close(true);
                    // After the menu has gone, so a confirm() does not open over it.
                    window.setTimeout(item.onSelect, 0);
                }}
            >
                {Icon && <Icon size={15} aria-hidden="true" />}
                {item.label}
            </button>
        );
    };

    const normal = items.filter((i) => !i.destructive);
    const danger = items.filter((i) => i.destructive);

    return (
        <span className="row-menu" onClick={(e) => e.stopPropagation()}>
            <button
                ref={btnRef}
                type="button"
                className="row-menu-trigger"
                aria-label={label}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                onClick={() => (open ? close(false) : setOpen(true))}
            >
                <MoreHorizontal size={16} aria-hidden="true" />
            </button>
            {open && createPortal(
                <div
                    ref={menuRef}
                    id={menuId}
                    role="menu"
                    aria-label={label}
                    className="row-menu-panel"
                    style={pos ? { top: pos.top, left: pos.left, right: pos.right } : { top: 0, left: 0, visibility: "hidden" }}
                    onKeyDown={onMenuKey}
                    onClick={(e) => e.stopPropagation()}
                >
                    {normal.map(renderItem)}
                    {normal.length > 0 && danger.length > 0 && <div className="row-menu-divider" role="separator" />}
                    {danger.map(renderItem)}
                </div>,
                document.body
            )}
            <style jsx>{`
                .row-menu { display: inline-flex; }
                .row-menu-trigger {
                    display: inline-flex; align-items: center; justify-content: center;
                    width: 30px; height: 30px; padding: 0; border-radius: 8px;
                    background: transparent; border: 1px solid transparent;
                    color: rgba(255, 255, 255, 0.55); cursor: pointer;
                    transition: background-color 0.15s ease, color 0.15s ease;
                }
                .row-menu-trigger:hover,
                .row-menu-trigger[aria-expanded="true"] { background: rgba(255, 255, 255, 0.08); color: #fff; }
                .row-menu-trigger:focus-visible { outline: 2px solid #a7f3d0; outline-offset: 2px; }
                .row-menu-panel {
                    position: fixed; z-index: 1100; min-width: 168px; padding: 4px;
                    background: #243b44; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px;
                    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
                }
                .row-menu-panel :global(.row-menu-item) {
                    display: flex; align-items: center; gap: 8px; width: 100%;
                    padding: 8px 10px; border: none; border-radius: 6px; background: none;
                    color: rgba(255, 255, 255, 0.88); font-family: inherit; font-size: var(--staff-size-base);
                    text-align: start; cursor: pointer;
                }
                .row-menu-panel :global(.row-menu-item:hover),
                .row-menu-panel :global(.row-menu-item:focus) { background: rgba(255, 255, 255, 0.07); outline: none; }
                .row-menu-panel :global(.row-menu-item.danger) { color: #fca5a5; }
                .row-menu-panel :global(.row-menu-item.danger:hover),
                .row-menu-panel :global(.row-menu-item.danger:focus) { background: rgba(220, 38, 38, 0.14); }
                .row-menu-divider { height: 1px; margin: 4px 2px; background: rgba(255, 255, 255, 0.08); }
            `}</style>
        </span>
    );
}
