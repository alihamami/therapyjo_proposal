"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useState, useRef, useEffect } from "react";

type DropdownItem = { href: string; label: string; icon: string };

const employeeItems: DropdownItem[] = [
    { href: "/admin/employees/doctors", label: "Doctors", icon: "🩺" },
    { href: "/admin/employees/secretaries", label: "Secretaries", icon: "📋" },
];

const patientItems: DropdownItem[] = [
    { href: "/admin/patients", label: "View Patients", icon: "👥" },
    { href: "/admin/patients/archived", label: "Archived", icon: "🗄️" },
    { href: "/admin/patients/duplicates", label: "Duplicates", icon: "🔍" },
];

const noteItems: DropdownItem[] = [
    { href: "/admin/notes", label: "View Notes", icon: "📝" },
];

const doctorItems: DropdownItem[] = [
    { href: "/admin/doctors", label: "View Doctors", icon: "🩺" },
    { href: "/admin/doctors/archived", label: "Archived", icon: "🗄️" },
];

function NavDropdown({
    label,
    items,
    isActive,
    onNavigate,
}: {
    label: string;
    items: DropdownItem[];
    isActive: boolean;
    onNavigate?: () => void;
}) {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);
    const pathname = usePathname();

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    return (
        <div className="nav-dropdown" ref={wrapRef}>
            <button
                className={`nav-link ${isActive ? "active" : ""}`}
                onClick={() => setOpen((o) => !o)}
            >
                {label}
                <svg
                    className={`chevron ${open ? "open" : ""}`}
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M2 3.5L5 6.5L8 3.5" />
                </svg>
            </button>

            <div className={`dropdown-panel ${open ? "visible" : ""}`}>
                <div className="dropdown-inner">
                    {items.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`dropdown-item ${pathname === item.href ? "current" : ""}`}
                            onClick={() => { setOpen(false); onNavigate?.(); }}
                        >
                            <span className="dropdown-icon">{item.icon}</span>
                            <span>{item.label}</span>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const { data: session } = useSession();
    const [pendingCount, setPendingCount] = useState(0);
    const [mobileOpen, setMobileOpen] = useState(false);

    // Close the mobile menu whenever the route changes.
    useEffect(() => { setMobileOpen(false); }, [pathname]);

    useEffect(() => {
        fetch("/api/pending-changes")
            .then((res) => (res.ok ? res.json() : []))
            .then((data) => setPendingCount(Array.isArray(data) ? data.length : 0))
            .catch(() => {});
    }, [pathname]);

    // An ended session used to be handled here with a hard redirect to
    // /login on visibilitychange and on status === "unauthenticated" — both
    // removed. That bounced the user away with no explanation, and now fights
    // the shared SessionExpiryNotice (src/app/SessionExpiryNotice.tsx, mounted
    // in providers.tsx) which shows a modal instead. That component is the
    // single place that reacts to a session ending, for every staff area.

    return (
        <div className="admin-layout">
            <nav className="admin-nav">
                <div className="nav-top-row">
                    <div className="nav-brand">
                        <Link href="/admin">Therapy Jo</Link>
                    </div>

                    <button
                        className="nav-hamburger"
                        aria-label={mobileOpen ? "Close menu" : "Open menu"}
                        aria-expanded={mobileOpen}
                        onClick={() => setMobileOpen((o) => !o)}
                    >
                        <span className={`hamburger-icon ${mobileOpen ? "open" : ""}`} />
                    </button>
                </div>

                <div className={`nav-collapsible ${mobileOpen ? "open" : ""}`}>
                    <div className="nav-links">
                        <Link
                            href="/admin"
                            className={`nav-link ${pathname === "/admin" ? "active" : ""}`}
                            onClick={() => setMobileOpen(false)}
                        >
                            Dashboard
                        </Link>

                        <NavDropdown
                            label="Employees"
                            items={employeeItems}
                            isActive={pathname.startsWith("/admin/employees")}
                            onNavigate={() => setMobileOpen(false)}
                        />
                        <NavDropdown
                            label="Patients"
                            items={patientItems}
                            isActive={pathname.startsWith("/admin/patients")}
                            onNavigate={() => setMobileOpen(false)}
                        />
                        <NavDropdown
                            label="Notes"
                            items={noteItems}
                            isActive={pathname.startsWith("/admin/notes")}
                            onNavigate={() => setMobileOpen(false)}
                        />

                        <span className="nav-divider" />

                        <Link
                            href="/admin/blog"
                            className={`nav-link ${pathname.startsWith("/admin/blog") ? "active" : ""}`}
                            onClick={() => setMobileOpen(false)}
                        >
                            Blog
                        </Link>
                        <NavDropdown
                            label="Doctors"
                            items={doctorItems}
                            isActive={pathname.startsWith("/admin/doctors")}
                            onNavigate={() => setMobileOpen(false)}
                        />
                        <Link
                            href="/admin/approvals"
                            className={`nav-link ${pathname.startsWith("/admin/approvals") ? "active" : ""}`}
                            onClick={() => setMobileOpen(false)}
                        >
                            Approvals
                            {pendingCount > 0 && <span className="badge">{pendingCount}</span>}
                        </Link>
                    </div>

                    <div className="nav-user">
                        <div className="user-avatar" title={session?.user?.name || "Admin"}>
                            {(session?.user?.name?.[0] || "A").toUpperCase()}
                        </div>
                        <span className="user-name">{session?.user?.name || "Admin"}</span>
                        <button
                            onClick={() => signOut({ callbackUrl: "/login" })}
                            className="logout-btn"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                            Sign Out
                        </button>
                    </div>
                </div>
            </nav>

            <main className="admin-content">{children}</main>

            <style jsx>{`
                .admin-layout {
                    min-height: 100vh;
                    background: var(--bg-dark, #1a2e35);
                    color: #fff;
                }

                /* ── Navbar ── */
                .admin-nav {
                    display: flex;
                    align-items: center;
                    gap: 2rem;
                    /* Side padding puts the wordmark on the page content's left
                       edge: .admin-content is a centred 1400px column with 2rem
                       padding. (TJ-068b) */
                    padding: 0.5rem max(2rem, calc((100% - 1400px) / 2 + 2rem));
                    box-sizing: border-box;
                    /* Solid. At 70% opacity, form fields scrolled visibly behind
                       the links. The blur, and the WebKit compositing hack it
                       needed, went with it. (TJ-068b) */
                    background: var(--bg-dark, #1a2e35);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
                    position: sticky;
                    top: 0;
                    z-index: 100;
                }
                .nav-top-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    min-height: 44px;
                }
                .nav-brand :global(a) {
                    font-family: var(--font-outfit, 'Outfit', sans-serif);
                    color: var(--primary, #4CAF93);
                    font-size: 1.1rem;
                    font-weight: 700;
                    text-decoration: none;
                    letter-spacing: -0.02em;
                }
                .nav-hamburger {
                    display: none;
                    background: none;
                    border: none;
                    padding: 0.5rem;
                    margin: -0.5rem;
                    cursor: pointer;
                }
                .hamburger-icon,
                .hamburger-icon::before,
                .hamburger-icon::after {
                    display: block;
                    width: 20px;
                    height: 2px;
                    background: #fff;
                    border-radius: 2px;
                    transition: transform 0.2s ease, opacity 0.2s ease;
                }
                .hamburger-icon {
                    position: relative;
                }
                .hamburger-icon::before,
                .hamburger-icon::after {
                    content: "";
                    position: absolute;
                    left: 0;
                }
                .hamburger-icon::before { top: -6px; }
                .hamburger-icon::after { top: 6px; }
                .hamburger-icon.open { background: transparent; }
                .hamburger-icon.open::before { top: 0; transform: rotate(45deg); }
                .hamburger-icon.open::after { top: 0; transform: rotate(-45deg); }

                .nav-collapsible {
                    display: flex;
                    align-items: center;
                    flex-wrap: wrap;
                    row-gap: 0.35rem;
                    gap: 1.5rem;
                    min-height: 44px;
                    flex: 1;
                    min-width: 0;
                }
                .nav-links {
                    display: flex;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 0.1rem;
                    flex: 1;
                }

                /* ── Nav Link ── */
                :global(.nav-link) {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.3rem;
                    color: #fff;
                    text-decoration: none;
                    padding: 0.4rem 0.85rem;
                    border-radius: var(--radius-sm, 2px);
                    font-size: 0.83rem;
                    font-weight: 500;
                    transition: all 0.2s;
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-family: inherit;
                    position: relative;
                }
                :global(.nav-link:hover) {
                    color: #fff;
                    background: rgba(255, 255, 255, 0.06);
                }
                :global(.nav-link.active) {
                    color: var(--primary, #4CAF93);
                }

                /* ── Divider & badge ── */
                .nav-divider {
                    width: 1px; height: 20px; background: rgba(255,255,255,0.1); margin: 0 0.35rem; flex-shrink: 0;
                }
                :global(.badge) {
                    display: inline-flex; align-items: center; justify-content: center;
                    background: #f59e0b; color: #3a2606; border-radius: 999px;
                    min-width: 17px; height: 17px; padding: 0 0.3rem; font-size: 0.68rem;
                    font-weight: 700; margin-inline-start: 0.35rem;
                }

                /* ── Chevron ── */
                :global(.chevron) {
                    transition: transform 0.25s ease;
                    opacity: 0.5;
                }
                :global(.chevron.open) {
                    transform: rotate(180deg);
                    opacity: 0.8;
                }

                /* ── Dropdown ── */
                :global(.nav-dropdown) {
                    position: relative;
                }
                :global(.dropdown-panel) {
                    position: absolute;
                    top: 100%;
                    left: 50%;
                    padding-top: 4px;
                    transform: translateX(-50%) translateY(4px);
                    opacity: 0;
                    visibility: hidden;
                    pointer-events: none;
                    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                    z-index: 300;
                }
                :global(.dropdown-panel.visible) {
                    opacity: 1;
                    visibility: visible;
                    pointer-events: all;
                    transform: translateX(-50%) translateY(0);
                }
                :global(.dropdown-inner) {
                    background: rgba(36, 59, 68, 0.95);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: var(--radius-md, 4px);
                    padding: 0.35rem;
                    min-width: 180px;
                    box-shadow:
                        0 16px 48px rgba(0, 0, 0, 0.4),
                        0 0 0 1px rgba(76, 175, 147, 0.05);
                }

                /* ── Dropdown Item ── */
                :global(.dropdown-item) {
                    display: flex;
                    align-items: center;
                    gap: 0.55rem;
                    color: #fff;
                    text-decoration: none;
                    padding: 0.5rem 0.75rem;
                    border-radius: var(--radius-sm, 2px);
                    font-size: 0.82rem;
                    transition: all 0.15s;
                }
                :global(.dropdown-item:hover) {
                    color: #fff;
                    background: rgba(76, 175, 147, 0.1);
                }
                :global(.dropdown-item.current) {
                    color: var(--primary, #4CAF93);
                    background: rgba(76, 175, 147, 0.08);
                }
                :global(.dropdown-icon) {
                    font-size: 0.9rem;
                    width: 20px;
                    text-align: center;
                    flex-shrink: 0;
                }

                /* ── User ── */
                .nav-user {
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                }
                .user-avatar {
                    width: 28px;
                    height: 28px;
                    background: rgba(76, 175, 147, 0.15);
                    border: 1px solid rgba(76, 175, 147, 0.25);
                    border-radius: var(--radius-sm, 2px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: var(--primary, #4CAF93);
                }
                .user-name {
                    color: rgba(255, 255, 255, 0.45);
                    font-size: 0.82rem;
                }
                .logout-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.35rem;
                    background: rgba(220, 38, 38, 0.08);
                    border: 1px solid rgba(220, 38, 38, 0.15);
                    color: rgba(252, 165, 165, 0.8);
                    padding: 0.32rem 0.75rem;
                    border-radius: var(--radius-sm, 2px);
                    font-size: 0.76rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-family: inherit;
                }
                .logout-btn:hover {
                    background: rgba(220, 38, 38, 0.18);
                    border-color: rgba(220, 38, 38, 0.3);
                    color: #fca5a5;
                }
                .admin-content {
                    padding: 2rem;
                    max-width: 1400px;
                    margin: 0 auto;
                }

                /* One row needs ~1,090px with the user's name. Below 1180px the
                   name goes first; it stays in the avatar's tooltip. (TJ-068b) */
                @media (min-width: 861px) and (max-width: 1180px) {
                    .user-name { display: none; }
                }

                @media (max-width: 860px) {
                    .admin-nav { padding: 0.5rem 1rem; flex-direction: column; align-items: stretch; gap: 0; }
                    .nav-hamburger { display: block; }

                    .nav-collapsible {
                        display: none;
                        flex-direction: column;
                        align-items: stretch;
                        gap: 0;
                        min-height: 0;
                    }
                    .nav-collapsible.open {
                        display: flex;
                        padding: 0.75rem 0 1rem;
                        border-top: 1px solid rgba(255, 255, 255, 0.06);
                        margin-top: 0.5rem;
                    }

                    .nav-links {
                        flex-direction: column;
                        align-items: stretch;
                        gap: 0.15rem;
                    }
                    :global(.nav-link) {
                        width: 100%;
                        justify-content: space-between;
                        padding: 0.7rem 0.5rem;
                        font-size: 0.9rem;
                    }
                    .nav-divider {
                        display: none;
                    }

                    /* Dropdowns become inline accordions instead of floating panels. */
                    :global(.nav-dropdown) {
                        width: 100%;
                    }
                    :global(.dropdown-panel) {
                        position: static;
                        transform: none !important;
                        left: auto;
                        padding-top: 0;
                        display: none;
                    }
                    :global(.dropdown-panel.visible) {
                        display: block;
                    }
                    :global(.dropdown-inner) {
                        box-shadow: none;
                        background: rgba(255, 255, 255, 0.03);
                        min-width: 0;
                        margin: 0.15rem 0 0.35rem;
                    }

                    .nav-user {
                        margin-top: 0.5rem;
                        padding-top: 0.75rem;
                        border-top: 1px solid rgba(255, 255, 255, 0.06);
                        justify-content: space-between;
                        width: 100%;
                    }
                    .user-name { flex: 1; }
                }

                @media (max-width: 640px) {
                    .admin-content { padding: 1rem; }
                }
            `}</style>
        </div>
    );
}
