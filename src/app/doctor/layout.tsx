"use client";

import { useState, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ConfirmProvider } from "@/app/components/ConfirmDialog";

const navItems = [
    { href: "/doctor", label: "My Schedule", icon: "📅" },
    { href: "/doctor/patients", label: "Patients", icon: "🧑‍⚕️" },
    { href: "/doctor/notes", label: "Notes", icon: "📝" },
    { href: "/doctor/profile", label: "My Profile", icon: "👤" },
];

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const pathname = usePathname();
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const userRef = useRef<HTMLDivElement>(null);

    const userName = session?.user?.name || "Doctor";

    return (
        <div className="doctor-layout">
            <nav className="nav">
                <Link href="/doctor" className="logo">Therapy Jo</Link>
                <div className="nav-links">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`nav-link ${pathname === item.href ? "active" : ""}`}
                        >
                            <span>{item.icon}</span> {item.label}
                        </Link>
                    ))}
                </div>
                <div className="user-area" ref={userRef}>
                    <button className="user-btn" onClick={() => setUserMenuOpen(!userMenuOpen)}>
                        {userName} ▾
                    </button>
                    {userMenuOpen && (
                        <div className="user-menu">
                            <button className="menu-item" onClick={() => signOut({ callbackUrl: "/login" })}>Sign Out</button>
                        </div>
                    )}
                </div>
            </nav>
            <main className="main"><ConfirmProvider>{children}</ConfirmProvider></main>

            <style jsx>{`
                .doctor-layout { min-height: 100vh; background: var(--bg-dark, #1a2e35); color: #fff; }
                .nav { display: flex; align-items: center; justify-content: space-between; padding: 0 1.5rem; height: 56px; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.06); }
                .nav :global(.logo) { font-weight: 700; font-size: 1.1rem; color: var(--primary, #4CAF93); text-decoration: none; }
                .nav-links { display: flex; gap: 0.25rem; }
                .nav :global(.nav-link) { display: flex; align-items: center; gap: 0.35rem; padding: 0.4rem 0.85rem; border-radius: var(--radius-sm, 2px); font-size: 0.82rem; color: rgba(255,255,255,0.6); text-decoration: none; transition: all 0.15s; }
                .nav :global(.nav-link:hover) { background: rgba(255,255,255,0.06); color: #fff; }
                .nav :global(.nav-link.active) { background: rgba(76,175,147,0.12); color: var(--primary, #4CAF93); font-weight: 600; }
                .user-area { position: relative; }
                .user-btn { background: none; border: none; color: rgba(255,255,255,0.6); font-size: 0.82rem; cursor: pointer; padding: 0.4rem 0.7rem; border-radius: var(--radius-sm, 2px); font-family: inherit; }
                .user-btn:hover { background: rgba(255,255,255,0.06); color: #fff; }
                .user-menu { position: absolute; right: 0; top: 100%; z-index: 100; background: var(--bg-dark-secondary, #243b44); border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius-sm, 2px); min-width: 140px; padding: 0.25rem; box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
                .menu-item { display: block; width: 100%; background: none; border: none; color: rgba(255,255,255,0.8); padding: 0.45rem 0.7rem; font-size: 0.82rem; cursor: pointer; text-align: left; border-radius: 2px; font-family: inherit; }
                .menu-item:hover { background: rgba(255,255,255,0.06); }
                .main { padding: 1.5rem; max-width: 1400px; margin: 0 auto; }
            `}</style>
        </div>
    );
}
