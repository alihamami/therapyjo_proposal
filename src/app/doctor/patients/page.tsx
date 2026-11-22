"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Search, Users } from "lucide-react";
import { shouldOpenRow } from "@/lib/rowLink";
import StaffEmpty from "@/app/components/StaffEmpty";

interface Patient {
    id: number;
    name: string;
    lastVisitDate: string | null;
    createdAt: string;
}

export default function DoctorPatientsPage() {
    const router = useRouter();
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const fetchPatients = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams({ page: String(page), limit: "20" });
        if (search) params.set("search", search);
        const res = await fetch(`/api/patients?${params}`);
        const data = await res.json();
        setPatients(data.patients || []);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
        setLoading(false);
    }, [page, search]);

    useEffect(() => { fetchPatients(); }, [fetchPatients]);

    const formatDate = (d: string | null) => {
        if (!d) return "—";
        return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    };

    return (
        <div>
            <div className="staff-page-header">
                <h1>Patients <span className="staff-page-count">({total})</span></h1>
            </div>

            <div className="staff-search">
                <Search size={15} aria-hidden="true" />
                <input
                    type="text"
                    aria-label="Search patients"
                    placeholder="Search by name or phone…"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
            </div>

            <div className="staff-table-wrap">
                <table className="staff-table">
                    <thead>
                        <tr><th>ID</th><th>Name</th><th>Last Visit</th><th></th></tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr className="staff-table-state"><td colSpan={4}><p className="staff-loading" role="status">Loading…</p></td></tr>
                        ) : patients.length === 0 ? (
                            <tr className="staff-table-state"><td colSpan={4}>
                                {search ? (
                                    <StaffEmpty icon={Search} title="No patients match your search" hint="Try part of the name, or a phone number." />
                                ) : (
                                    <StaffEmpty icon={Users} title="No patients yet" hint="Patients registered at the clinic appear here." />
                                )}
                            </td></tr>
                        ) : patients.map((p) => (
                            <tr key={p.id} className="staff-row-link" onClick={(e) => { if (shouldOpenRow(e)) router.push(`/doctor/patients/${p.id}`); }}>
                                <td className="staff-cell-id">{p.id}</td>
                                <td><Link href={`/doctor/patients/${p.id}`} className="staff-row-name">{p.name}</Link></td>
                                <td>{formatDate(p.lastVisitDate)}</td>
                                <td><div className="staff-row-end"><ChevronRight size={16} className="staff-row-chevron" aria-hidden="true" /></div></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="staff-pagination">
                    <button className="staff-btn staff-btn-secondary staff-btn-sm" disabled={page === 1} onClick={() => setPage(page - 1)}>← Prev</button>
                    <span>Page {page} of {totalPages}</span>
                    <button className="staff-btn staff-btn-secondary staff-btn-sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next →</button>
                </div>
            )}
        </div>
    );
}
