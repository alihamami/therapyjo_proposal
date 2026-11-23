"use client";

import StaffShell, { type StaffNavEntry } from "@/app/components/StaffShell";

const nav: StaffNavEntry[] = [
    { label: "My Schedule", href: "/doctor", match: ["/doctor/session"] },
    { label: "Patients", href: "/doctor/patients", match: ["/doctor/patients"] },
    { label: "Notes", href: "/doctor/notes", match: ["/doctor/notes"] },
    { label: "My Profile", href: "/doctor/profile", match: ["/doctor/profile"] },
];

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
    return <StaffShell home="/doctor" nav={nav} fallbackName="Doctor">{children}</StaffShell>;
}
