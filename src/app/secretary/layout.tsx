"use client";

import { Archive, Users } from "lucide-react";
import StaffShell, { type StaffNavEntry } from "@/app/components/StaffShell";

const nav: StaffNavEntry[] = [
    { label: "Dashboard", href: "/secretary", match: ["/secretary/reservations"] },
    {
        label: "Patients",
        match: ["/secretary/patients"],
        items: [
            { href: "/secretary/patients", label: "View Patients", icon: Users },
            { href: "/secretary/patients/archived", label: "Archived", icon: Archive },
        ],
    },
    { label: "Notes", href: "/secretary/notes", match: ["/secretary/notes"] },
];

export default function SecretaryLayout({ children }: { children: React.ReactNode }) {
    return <StaffShell home="/secretary" nav={nav} fallbackName="Secretary">{children}</StaffShell>;
}
