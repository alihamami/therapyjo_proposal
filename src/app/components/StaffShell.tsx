"use client";

// One menu bar and page frame for the admin, secretary and doctor portals
// (TJ-070). Each portal's layout passes its own links; this component owns
// the look and the behaviour phase 0 built for the admin bar (TJ-068b,
// TJ-068g): solid and sticky, lined up with the 1400px content column, a
// phone menu below 861px, and tighter spacing from 861px to 1040px. Its
// styles are the .staff-nav* rules in the globals.css staff section.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ConfirmProvider } from "@/app/components/ConfirmDialog";

export type StaffMenuItem = { href: string; label: string; icon: LucideIcon; badge?: number };

/** A link, a menu of links, or a divider. A link is active on its own path
    and on paths under any prefix in `match`; a menu is active on paths under
    any prefix in `match`. */
export type StaffNavEntry =
    | { label: string; href: string; match?: string[]; badge?: number }
    | { label: string; items: StaffMenuItem[]; match: string[]; badge?: number }
    | "divider";

function under(pathname: string, prefix: string) {
    return pathname === prefix || pathname.startsWith(prefix + "/");
}

function Badge({ count }: { count?: number }) {
    return count ? <span className="staff-nav-badge">{count}</span> : null;
}

function NavMenu({
    label,
    items,
    badge,
    active,
    onNavigate,
}: {
    label: string;
    items: StaffMenuItem[];
    badge?: number;
    active: boolean;
    onNavigate: () => void;
}) {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);
    const pathname = usePathname();

    // Open on click, not on hover, so it works by touch and by keyboard.
    // A click outside or Escape closes it.
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
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

    return (
        <div className="staff-nav-menu" ref={wrapRef}>
            <button
                type="button"
                className={`staff-nav-link ${active ? "active" : ""}`}
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
            >
                <span>{label}<Badge count={badge} /></span>
                <svg
                    className={`staff-nav-chevron ${open ? "open" : ""}`}
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="M2 3.5L5 6.5L8 3.5" />
                </svg>
            </button>

            <div className={`staff-nav-panel ${open ? "visible" : ""}`}>
                <div className="staff-nav-panel-inner">
                    {items.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`staff-nav-item ${pathname === item.href ? "current" : ""}`}
                            onClick={() => { setOpen(false); onNavigate(); }}
                        >
                            <span className="staff-nav-item-icon"><item.icon size={15} aria-hidden="true" /></span>
                            <span>{item.label}</span>
                            <Badge count={item.badge} />
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function StaffShell({
    home,
    nav,
    fallbackName,
    children,
}: {
    home: string;
    nav: StaffNavEntry[];
    fallbackName: string;
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const { data: session } = useSession();
    const [mobileOpen, setMobileOpen] = useState(false);

    // Close the phone menu whenever the route changes.
    useEffect(() => { setMobileOpen(false); }, [pathname]);

    const closeMenu = () => setMobileOpen(false);
    const name = session?.user?.name || fallbackName;

    return (
        <div className="staff-shell">
            <nav className="staff-nav" aria-label="Main">
                <div className="staff-nav-top">
                    <Link href={home} className="staff-nav-brand">Therapy Jo</Link>
                    <button
                        type="button"
                        className="staff-nav-toggle"
                        aria-label={mobileOpen ? "Close menu" : "Open menu"}
                        aria-expanded={mobileOpen}
                        onClick={() => setMobileOpen((o) => !o)}
                    >
                        <span className={`staff-nav-toggle-icon ${mobileOpen ? "open" : ""}`} />
                    </button>
                </div>

                <div className={`staff-nav-body ${mobileOpen ? "open" : ""}`}>
                    <div className="staff-nav-links">
                        {nav.map((entry, i) => {
                            if (entry === "divider") return <span key={`divider-${i}`} className="staff-nav-divider" />;
                            if ("items" in entry) {
                                return (
                                    <NavMenu
                                        key={entry.label}
                                        label={entry.label}
                                        items={entry.items}
                                        badge={entry.badge}
                                        active={entry.match.some((p) => under(pathname, p))}
                                        onNavigate={closeMenu}
                                    />
                                );
                            }
                            const active = pathname === entry.href || (entry.match ?? []).some((p) => under(pathname, p));
                            return (
                                <Link
                                    key={entry.href}
                                    href={entry.href}
                                    className={`staff-nav-link ${active ? "active" : ""}`}
                                    onClick={closeMenu}
                                >
                                    <span>{entry.label}<Badge count={entry.badge} /></span>
                                </Link>
                            );
                        })}
                    </div>

                    <div className="staff-nav-user">
                        <div className="staff-nav-avatar" title={name}>{name[0].toUpperCase()}</div>
                        <span className="staff-nav-name">{name}</span>
                        <button
                            type="button"
                            className="staff-nav-signout"
                            onClick={() => signOut({ callbackUrl: "/login" })}
                            aria-label="Sign out"
                            title="Sign out"
                        >
                            <LogOut size={14} aria-hidden="true" />
                            <span className="staff-nav-signout-label">Sign Out</span>
                        </button>
                    </div>
                </div>
            </nav>

            <main className="staff-content"><ConfirmProvider>{children}</ConfirmProvider></main>
        </div>
    );
}
