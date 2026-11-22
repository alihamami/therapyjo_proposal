"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { ConfirmProvider } from "@/app/components/ConfirmDialog";
import { Archive, CalendarDays, StickyNote, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type DropdownItem = { href: string; label: string; icon: LucideIcon };

const patientItems: DropdownItem[] = [
    { href: "/secretary/patients", label: "View Patients", icon: Users },
    { href: "/secretary/patients/archived", label: "Archived", icon: Archive },
];

function NavDropdown({
    label,
    items,
    isActive,
}: {
    label: string;
    items: DropdownItem[];
    isActive: boolean;
}) {
    const [open, setOpen] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const pathname = usePathname();

    const handleEnter = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setOpen(true);
    };
    const handleLeave = () => {
        setOpen(false);
    };

    useEffect(() => () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }, []);

    return (
        <div
            className="nav-dropdown"
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
        >
            <button className={`nav-link ${isActive ? "active" : ""}`}>
                <Users size={15} aria-hidden="true" /> {label}
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
                            onClick={() => setOpen(false)}
                        >
                            <span className="dropdown-icon"><item.icon size={15} aria-hidden="true" /></span>
                            <span>{item.label}</span>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function SecretaryLayout({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const pathname = usePathname();
    const router = useRouter();
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const userRef = useRef<HTMLDivElement>(null);

    const userName = session?.user?.name || "Secretary";

    return (
        <div className="secretary-layout">
            <nav className="nav">
                <Link href="/secretary" className="logo">Therapy Jo</Link>
                <div className="nav-links">
                    <Link
                        href="/secretary"
                        className={`nav-link ${pathname === "/secretary" ? "active" : ""}`}
                    >
                        <CalendarDays size={15} aria-hidden="true" /> Dashboard
                    </Link>
                    <NavDropdown
                        label="Patients"
                        items={patientItems}
                        isActive={pathname.startsWith("/secretary/patients")}
                    />
                    <Link
                        href="/secretary/notes"
                        className={`nav-link ${pathname === "/secretary/notes" ? "active" : ""}`}
                    >
                        <StickyNote size={15} aria-hidden="true" /> Notes
                    </Link>
                </div>
                <div className="user-area" ref={userRef}>
                    <button
                        className="user-btn"
                        onClick={() => setUserMenuOpen(!userMenuOpen)}
                    >
                        {userName} ▾
                    </button>
                    {userMenuOpen && (
                        <div className="user-menu">
                            <button
                                className="menu-item"
                                onClick={() => { signOut({ callbackUrl: "/login" }); }}
                            >
                                Sign Out
                            </button>
                        </div>
                    )}
                </div>
            </nav>
            <main className="main"><ConfirmProvider>{children}</ConfirmProvider></main>

            <style jsx>{`
                .secretary-layout { min-height: 100vh; background: var(--bg-dark, #1a2e35); color: #fff; }
                .nav {
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 0 1.5rem; height: 56px;
                    background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.06);
                }
                .nav :global(.logo) { font-weight: 700; font-size: 1.1rem; color: var(--primary, #4CAF93); text-decoration: none; }
                .nav-links { display: flex; align-items: center; gap: 0.25rem; }
                :global(.nav-link) {
                    display: flex; align-items: center; gap: 0.35rem;
                    padding: 0.4rem 0.85rem; border-radius: var(--radius-sm, 2px);
                    font-size: 0.82rem; color: rgba(255,255,255,0.6); text-decoration: none;
                    transition: all 0.15s;
                    background: none; border: none; cursor: pointer; font-family: inherit;
                }
                :global(.nav-link:hover) { background: rgba(255,255,255,0.06); color: #fff; }
                :global(.nav-link.active) { background: rgba(76,175,147,0.12); color: var(--primary, #4CAF93); font-weight: 600; }

                :global(.chevron) { transition: transform 0.25s ease; opacity: 0.5; }
                :global(.chevron.open) { transform: rotate(180deg); opacity: 0.8; }

                :global(.nav-dropdown) { position: relative; }
                :global(.dropdown-panel) {
                    position: absolute; top: 100%; left: 50%; padding-top: 4px;
                    transform: translateX(-50%) translateY(4px);
                    opacity: 0; visibility: hidden; pointer-events: none;
                    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); z-index: 300;
                }
                :global(.dropdown-panel.visible) {
                    opacity: 1; visibility: visible; pointer-events: all;
                    transform: translateX(-50%) translateY(0);
                }
                :global(.dropdown-inner) {
                    background: rgba(36, 59, 68, 0.95); backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: var(--radius-md, 4px); padding: 0.35rem; min-width: 180px;
                    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(76, 175, 147, 0.05);
                }
                :global(.dropdown-item) {
                    display: flex; align-items: center; gap: 0.55rem;
                    color: #fff; text-decoration: none; padding: 0.5rem 0.75rem;
                    border-radius: var(--radius-sm, 2px); font-size: 0.82rem; transition: all 0.15s;
                }
                :global(.dropdown-item:hover) { color: #fff; background: rgba(76, 175, 147, 0.1); }
                :global(.dropdown-item.current) { color: var(--primary, #4CAF93); background: rgba(76, 175, 147, 0.08); }
                :global(.dropdown-icon) { display: inline-flex; justify-content: center; width: 20px; flex-shrink: 0; }

                .user-area { position: relative; }
                .user-btn {
                    background: none; border: none; color: rgba(255,255,255,0.6);
                    font-size: 0.82rem; cursor: pointer; padding: 0.4rem 0.7rem;
                    border-radius: var(--radius-sm, 2px); font-family: inherit;
                }
                .user-btn:hover { background: rgba(255,255,255,0.06); color: #fff; }
                .user-menu {
                    position: absolute; right: 0; top: 100%; z-index: 100;
                    background: var(--bg-dark-secondary, #243b44); border: 1px solid rgba(255,255,255,0.1);
                    border-radius: var(--radius-sm, 2px); min-width: 140px; padding: 0.25rem;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
                }
                .menu-item {
                    display: block; width: 100%; background: none; border: none;
                    color: rgba(255,255,255,0.8); padding: 0.45rem 0.7rem;
                    font-size: 0.82rem; cursor: pointer; text-align: left;
                    border-radius: 2px; font-family: inherit;
                }
                .menu-item:hover { background: rgba(255,255,255,0.06); }
                .main { padding: 1.5rem; max-width: 1400px; margin: 0 auto; }
            `}</style>
        </div>
    );
}
