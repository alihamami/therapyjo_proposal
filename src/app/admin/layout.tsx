"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Archive, ClipboardCheck, Contact, Copy, Newspaper, Stethoscope, Users } from "lucide-react";
import StaffShell, { type StaffNavEntry } from "@/app/components/StaffShell";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const [pendingCount, setPendingCount] = useState(0);

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

    const nav: StaffNavEntry[] = [
        { label: "Dashboard", href: "/admin", match: ["/admin/reservations"] },
        {
            label: "Employees",
            match: ["/admin/employees"],
            items: [
                { href: "/admin/employees/doctors", label: "Doctors", icon: Stethoscope },
                { href: "/admin/employees/secretaries", label: "Secretaries", icon: Contact },
            ],
        },
        {
            label: "Patients",
            match: ["/admin/patients"],
            items: [
                { href: "/admin/patients", label: "View Patients", icon: Users },
                { href: "/admin/patients/archived", label: "Archived", icon: Archive },
                { href: "/admin/patients/duplicates", label: "Duplicates", icon: Copy },
            ],
        },
        { label: "Notes", href: "/admin/notes", match: ["/admin/notes"] },
        "divider",
        // Blog, the public doctor profiles and Approvals are all about the
        // public website. Grouped, "Doctors" no longer appears twice in the
        // bar (Employees > Doctors are the staff accounts). (TJ-070)
        {
            label: "Website",
            match: ["/admin/blog", "/admin/doctors", "/admin/approvals"],
            badge: pendingCount,
            items: [
                { href: "/admin/blog", label: "Blog", icon: Newspaper },
                { href: "/admin/doctors", label: "Doctor profiles", icon: Stethoscope },
                { href: "/admin/doctors/archived", label: "Archived profiles", icon: Archive },
                { href: "/admin/approvals", label: "Approvals", icon: ClipboardCheck, badge: pendingCount },
            ],
        },
    ];

    return <StaffShell home="/admin" nav={nav} fallbackName="Admin">{children}</StaffShell>;
}
