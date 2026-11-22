"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isMissingPhone } from "@/lib/phone";
import { ChevronRight, Plus, Search, Users } from "lucide-react";
import { shouldOpenRow } from "@/lib/rowLink";
import StaffEmpty from "@/app/components/StaffEmpty";

interface Patient {
    id: number;
    name: string;
    phone1: string;
    phone2: string | null;
    lastVisitDate: string | null;
    createdAt: string;
}

export default function SecretaryPatientsPage() {
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
                <button className="staff-btn staff-btn-primary" onClick={() => router.push("/secretary/patients/new")}><Plus size={15} aria-hidden="true" />Add Patient</button>
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
                        <tr><th>ID</th><th>Name</th><th>Phone</th><th>Last Visit</th><th></th></tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr className="staff-table-state"><td colSpan={5}><p className="staff-loading" role="status">Loading…</p></td></tr>
                        ) : patients.length === 0 ? (
                            <tr className="staff-table-state"><td colSpan={5}>
                                {search ? (
                                    <StaffEmpty icon={Search} title="No patients match your search" hint="Try part of the name, or a phone number." />
                                ) : (
                                    <StaffEmpty
                                        icon={Users}
                                        title="No patients yet"
                                        hint="Patients you add appear here."
                                        action={<button className="staff-btn staff-btn-primary staff-btn-sm" onClick={() => router.push("/secretary/patients/new")}><Plus size={15} aria-hidden="true" />Add Patient</button>}
                                    />
                                )}
                            </td></tr>
                        ) : patients.map((p) => (
                            <tr key={p.id} className="staff-row-link" onClick={(e) => { if (shouldOpenRow(e)) router.push(`/secretary/patients/${p.id}`); }}>
                                <td className="staff-cell-id">{p.id}</td>
                                <td><Link href={`/secretary/patients/${p.id}`} className="staff-row-name">{p.name}</Link></td>
                                <td>{isMissingPhone(p.phone1) ? <span className="no-phone">No phone</span> : p.phone1}</td>
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
