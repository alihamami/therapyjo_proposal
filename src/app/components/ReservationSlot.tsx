"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";
import { isMissingPhone } from "@/lib/phone";

interface SlotAction {
    label: string;
    icon: string;
    onClick: () => void;
    danger?: boolean;
}

interface ReservationSlotProps {
    id: number;
    patientName: string;
    // Absent for a doctor: the server does not send them the number. (TJ-054)
    patientPhone?: string | null;
    doctorName: string;
    doctorColor: string;
    status: string;
    time: string;
    note?: string | null;
    showNoteOnCalendar?: boolean;
    isTwoHours?: boolean;
    onStatusChange: (id: number, status: string) => void;
    // Optional: admin and secretary pass it; the doctor dashboard does not,
    // so doctors get no Duplicate item. (TJ-061)
    onDuplicate?: (id: number) => void;
    onDelete: (id: number) => void;
    onClick: (id: number) => void;
    // Optional: the card body now opens the patient's file, so a dashboard that
    // also has a session-detail view exposes it here instead.
    onViewDetails?: (id: number) => void;
    // Optional: only the dashboards that have an edit screen pass this, so the
    // doctor dashboard grows no Edit item.
    onEdit?: (id: number) => void;
    canDelete?: boolean;
    // A colleague's session on the doctor dashboard: no actions, and no menu
    // trigger. The card still opens the session to read. (TJ-062)
    readOnly?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
    SCHEDULED: "Scheduled",
    WAITING: "Waiting",
    CHECKED_IN: "Checked In",
    WITH_DOCTOR: "With Doctor",
    CHECKED_OUT: "Checked Out",
    CANCELLED: "Cancelled",
    NO_SHOW: "No Show",
};

const STATUS_COLORS: Record<string, string> = {
    SCHEDULED: "#60a5fa",
    WAITING: "#fbbf24",
    CHECKED_IN: "#34d399",
    WITH_DOCTOR: "#a78bfa",
    CHECKED_OUT: "rgba(255,255,255,0.3)",
    CANCELLED: "#f87171",
    NO_SHOW: "#f87171",
};

// Statuses that read fine on their own steam (plain, or via opacity/hatch)
// don't get a dot — only the "in progress" ones do.
const DOT_STATUSES = new Set(["WAITING", "CHECKED_IN", "WITH_DOCTOR"]);

// --- Contrast helper ---------------------------------------------------
// The doctor palette is all light pastels, so a filled card needs dark text
// on most of them — but doctorColor can also be the "#666" fallback for a
// deleted doctor, or (from old/bad data) a malformed, short, or non-hex
// string. Never throw: fall back to white whenever the color can't be
// parsed, and otherwise pick whichever of white / var(--text-primary)
// actually gives the better WCAG contrast against that background.
function hexToRgb(hex: string): [number, number, number] | null {
    if (typeof hex !== "string") return null;
    let h = hex.trim();
    if (h.startsWith("#")) h = h.slice(1);
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    if (h.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(h)) return null;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
    const chan = (v: number) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

function contrastRatio(l1: number, l2: number): number {
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}

const DARK_TEXT_LUMINANCE = relativeLuminance(hexToRgb("1a2e35") as [number, number, number]);

function readableTextColor(bg: string): string {
    const rgb = hexToRgb(bg);
    if (!rgb) return "#fff";
    const bgL = relativeLuminance(rgb);
    const withWhite = contrastRatio(bgL, 1);
    const withDark = contrastRatio(bgL, DARK_TEXT_LUMINANCE);
    return withDark >= withWhite ? "var(--text-primary, #1a2e35)" : "#fff";
}

// Dropdown sizing used both for the CSS and for the on-open position math.
const MENU_WIDTH = 200;
const MENU_ITEM_HEIGHT = 34;
const MENU_PADDING = 10;
const EDGE_MARGIN = 8;

export default function ReservationSlot({
    id,
    patientName,
    patientPhone,
    doctorName,
    doctorColor,
    status,
    time,
    note,
    showNoteOnCalendar,
    isTwoHours,
    onStatusChange,
    onDuplicate,
    onDelete,
    onClick,
    onViewDetails,
    onEdit,
    canDelete = false,
    readOnly = false,
}: ReservationSlotProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
    const menuRef = useRef<HTMLDivElement>(null);
    const menuPanelRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                menuRef.current &&
                !menuRef.current.contains(target) &&
                !menuPanelRef.current?.contains(target)
            ) {
                setMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    // The calendar can scroll horizontally, so a dropdown positioned
    // relative to the card would get clipped by that scroll container. The
    // menu is `position: fixed` instead, placed from the trigger's real
    // screen coordinates (computed on open, below) and closed on scroll so
    // it never drifts from the button it belongs to.
    useEffect(() => {
        if (!menuOpen) return;
        const close = () => setMenuOpen(false);
        window.addEventListener("scroll", close, true);
        window.addEventListener("resize", close);
        return () => {
            window.removeEventListener("scroll", close, true);
            window.removeEventListener("resize", close);
        };
    }, [menuOpen]);

    const actions: SlotAction[] = [];
    if (onViewDetails) {
        actions.push({ label: "Session Details", icon: "📄", onClick: () => onViewDetails(id) });
    }
    if (status === "SCHEDULED" || status === "WAITING") {
        actions.push({ label: "Check In", icon: "✅", onClick: () => onStatusChange(id, "CHECKED_IN") });
    }
    if (status === "SCHEDULED") {
        actions.push({ label: "Waiting", icon: "⏳", onClick: () => onStatusChange(id, "WAITING") });
    }
    if (status === "CHECKED_IN") {
        actions.push({ label: "Entry to Doctor", icon: "🩺", onClick: () => onStatusChange(id, "WITH_DOCTOR") });
        actions.push({ label: "Waiting", icon: "⏳", onClick: () => onStatusChange(id, "WAITING") });
    }
    if (status === "WITH_DOCTOR") {
        actions.push({ label: "Checkout", icon: "🚪", onClick: () => onStatusChange(id, "CHECKED_OUT") });
    }
    if (status === "CANCELLED" || status === "NO_SHOW") {
        actions.push({ label: "Reschedule", icon: "↩️", onClick: () => onStatusChange(id, "SCHEDULED") });
    }
    if (status === "CHECKED_OUT") {
        actions.push({ label: "Undo Checkout", icon: "↩️", onClick: () => onStatusChange(id, "WITH_DOCTOR") });
    }
    if (onEdit) {
        actions.push({ label: "Edit", icon: "✏️", onClick: () => onEdit(id) });
    }
    if (onDuplicate) {
        actions.push({ label: "Duplicate", icon: "📋", onClick: () => onDuplicate(id) });
    }
    const cancellable = ["SCHEDULED", "WAITING", "CHECKED_IN"].includes(status);
    if (cancellable) {
        actions.push({ label: "Cancel", icon: "🚫", onClick: () => onStatusChange(id, "CANCELLED"), danger: true });
    }
    if (canDelete) {
        actions.push({ label: "Delete", icon: "🗑️", onClick: () => onDelete(id), danger: true });
    }

    const openMenu = () => {
        const btn = triggerRef.current;
        if (!btn) return;
        const rect = btn.getBoundingClientRect();
        const menuHeight = actions.length * MENU_ITEM_HEIGHT + MENU_PADDING;

        // Default: right edge of the menu aligns with the trigger's right
        // edge (grows leftward), matching the old in-flow look. Flip to
        // grow rightward instead if that would run off the left edge of
        // the viewport, then clamp either way so it always stays reachable.
        let left = rect.right - MENU_WIDTH;
        if (left < EDGE_MARGIN) left = rect.left;
        left = Math.min(Math.max(left, EDGE_MARGIN), window.innerWidth - MENU_WIDTH - EDGE_MARGIN);

        // Default: open downward below the trigger. Flip upward if it
        // would run off the bottom of the viewport.
        let top = rect.bottom + 4;
        if (top + menuHeight > window.innerHeight - EDGE_MARGIN) {
            top = rect.top - menuHeight - 4;
        }
        top = Math.max(top, EDGE_MARGIN);

        setMenuPos({ top, left });
    };

    const textColor = readableTextColor(doctorColor);
    const edgeColor = `color-mix(in srgb, ${doctorColor} 75%, black)`;
    const isCheckedOut = status === "CHECKED_OUT";
    const isVoided = status === "CANCELLED" || status === "NO_SHOW";
    const showDot = DOT_STATUSES.has(status);
    const statusLabel = STATUS_LABELS[status] ?? status;

    return (
        <div
            className={`slot ${isVoided ? "voided" : ""}`}
            style={{
                background: doctorColor,
                color: textColor,
                borderLeftColor: edgeColor,
                opacity: isCheckedOut ? 0.5 : 1,
                // Read by the muted text below to mix its colour. (TJ-056)
                "--slot-bg": doctorColor,
            } as CSSProperties}
            onClick={() => onClick(id)}
            title={`${patientName} — ${statusLabel} — ${doctorName}`}
            aria-label={`${patientName}, ${statusLabel}, with ${doctorName} at ${time}`}
        >
            {showDot && (
                <span className="status-dot" style={{ background: STATUS_COLORS[status] }} />
            )}
            <div className="slot-main">
                <span className={`slot-name ${isVoided ? "strike" : ""}`} dir="auto">{patientName}</span>
                <span className="slot-sub">
                    {/* A doctor is never sent the phone (TJ-054), so undefined
                        hides it; a stored blank or "0" says so. (TJ-068d) */}
                    {patientPhone != null && (
                        <>
                            {isMissingPhone(patientPhone)
                                ? <span className="slot-phone slot-phone-none">No phone</span>
                                : <span className="slot-phone">{patientPhone}</span>}
                            <span className="slot-sep" aria-hidden="true">·</span>
                        </>
                    )}
                    <span className="slot-time">{time}</span>
                </span>
                {showNoteOnCalendar && note && (
                    <span className="slot-note">📝 {note}</span>
                )}
            </div>
            <div className="slot-right">
                <div className="menu-wrap" ref={menuRef}>
                    {!readOnly && (
                        <button
                            ref={triggerRef}
                            className="menu-trigger"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!menuOpen) openMenu();
                                setMenuOpen(!menuOpen);
                            }}
                        >
                            ⋮
                        </button>
                    )}
                    {menuOpen && createPortal(
                        <div
                            ref={menuPanelRef}
                            className="menu-panel"
                            style={{ top: menuPos.top, left: menuPos.left }}
                        >
                            {actions.map((a) => (
                                <button
                                    key={a.label}
                                    className={`menu-item ${a.danger ? "danger" : ""}`}
                                    onClick={(e) => { e.stopPropagation(); a.onClick(); setMenuOpen(false); }}
                                >
                                    <span>{a.icon}</span> {a.label}
                                </button>
                            ))}
                        </div>,
                        document.body
                    )}
                </div>
            </div>

            <style jsx>{`
                .slot {
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 0.4rem 0.65rem; border-left: 3px solid;
                    border-radius: var(--radius-sm, 2px);
                    cursor: pointer; transition: box-shadow var(--transition-fast, 0.2s ease);
                    width: 100%; height: 100%; min-height: 48px; box-sizing: border-box;
                    position: relative; overflow: hidden;
                }
                .slot:hover { box-shadow: inset 0 0 0 1000px rgba(0,0,0,0.08); }
                .slot.voided::before {
                    content: ""; position: absolute; inset: 0; pointer-events: none;
                    background: repeating-linear-gradient(
                        135deg, rgba(0,0,0,0.14) 0 6px, transparent 6px 12px
                    );
                }
                .status-dot {
                    position: absolute; top: 5px; right: 5px;
                    width: 7px; height: 7px; border-radius: 50%;
                    box-shadow: 0 0 0 1px rgba(0,0,0,0.25);
                }
                .slot-main {
                    display: flex; flex-direction: column; gap: 0.05rem; min-width: 0; flex: 1;
                }
                /* dir="auto" on the name: an Arabic name in this LTR card was laid
                   out left-to-right, so in a narrow column it clipped its FIRST
                   word. As RTL it clips its last. text-align keeps every name at
                   the same edge as before. (TJ-057) */
                .slot-name {
                    font-weight: 700; font-size: 0.8rem; white-space: nowrap;
                    overflow: hidden; text-overflow: ellipsis; text-align: left;
                }
                .slot-name.strike { text-decoration: line-through; }
                /* The muted lines are MIXED toward the card colour, not faded with
                   opacity. Chrome drops ClearType for any text drawn with opacity
                   below 1, so on Windows the phone/time line fell back to soft
                   greyscale smoothing (measured in a clinic screenshot). Same
                   shades as before, but opaque. (TJ-056) */
                .slot-sub {
                    display: flex; align-items: baseline; gap: 0.3rem;
                    font-size: 0.7rem; white-space: nowrap;
                    color: color-mix(in srgb, currentColor 80%, var(--slot-bg));
                    overflow: hidden; min-width: 0;
                }
                /* The phone is the half that may truncate; the time never is. */
                .slot-phone { overflow: hidden; text-overflow: ellipsis; min-width: 0; }
                .slot-phone-none { font-style: italic; color: color-mix(in srgb, currentColor 65%, var(--slot-bg)); }
                .slot-sep { flex-shrink: 0; color: color-mix(in srgb, currentColor 60%, var(--slot-bg)); }
                .slot-time { flex-shrink: 0; color: color-mix(in srgb, currentColor 85%, var(--slot-bg)); }
                .slot-note {
                    font-size: 0.68rem; font-style: italic;
                    color: color-mix(in srgb, currentColor 75%, var(--slot-bg));
                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                }
                .slot-right { display: flex; align-items: center; gap: 0.4rem; flex-shrink: 0; margin-left: 0.3rem; }
                .menu-wrap { position: relative; }
                .menu-trigger {
                    background: none; border: none; color: inherit; opacity: 0.7;
                    font-size: 1.2rem; cursor: pointer; padding: 0.1rem 0.3rem;
                    border-radius: 4px; line-height: 1;
                }
                .menu-trigger:hover { background: rgba(0,0,0,0.12); opacity: 1; }
                .menu-panel {
                    position: fixed; z-index: 200;
                    min-width: 160px; max-width: ${MENU_WIDTH}px;
                    background: var(--bg-dark-secondary, #243b44);
                    border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius-sm, 2px);
                    padding: 0.25rem; box-shadow: 0 8px 32px rgba(0,0,0,0.4);
                }
                .menu-item {
                    display: flex; align-items: center; gap: 0.5rem; width: 100%;
                    background: none; border: none; color: rgba(255,255,255,0.8);
                    padding: 0.45rem 0.65rem; font-size: 0.8rem; cursor: pointer;
                    border-radius: 2px; font-family: inherit; text-align: left;
                }
                .menu-item:hover { background: rgba(255,255,255,0.06); }
                .menu-item.danger { color: #fca5a5; }
                .menu-item.danger:hover { background: rgba(220,38,38,0.1); }

                /* Thresholds are column widths — the container is .card-wrap in
                   Calendar.tsx, which is exactly one column wide. These sit at the
                   END of the block deliberately: a container query adds no
                   specificity, so any base rule declared after them would win on
                   source order, which is precisely what silently killed the
                   .slot-right and .menu-trigger tiers the first time round.
                   Each tier gives back the space the tier above could not afford,
                   in order of what the front desk needs least. (TJ-049a) */
                @container reservation-card (max-width: 265px) {
                    .slot-note { display: none; }
                }
                @container reservation-card (max-width: 200px) {
                    .slot { padding: 0.35rem 0.45rem; }
                    .slot-name { font-size: 0.75rem; }
                    .slot-sub { font-size: 0.66rem; }
                }
                @container reservation-card (max-width: 150px) {
                    .slot { padding: 0.3rem 0.35rem; }
                    .slot-name { font-size: 0.72rem; }
                    .slot-phone, .slot-sep { display: none; }
                    .slot-right { margin-left: 0.15rem; }
                    .menu-trigger { font-size: 1rem; padding: 0.1rem 0.15rem; }
                }

                @media (max-width: 768px) {
                    .slot { height: auto; min-height: 54px; }
                }
            `}</style>
        </div>
    );
}
