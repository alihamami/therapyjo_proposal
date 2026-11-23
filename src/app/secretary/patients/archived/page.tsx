"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { isMissingPhone } from "@/lib/phone";
import { useRouter } from "next/navigation";
import { Archive, ChevronRight } from "lucide-react";
import { shouldOpenRow } from "@/lib/rowLink";
import { useConfirm } from "@/app/components/ConfirmDialog";
import StaffEmpty from "@/app/components/StaffEmpty";

interface Patient {
    id: number;
    name: string;
    phone1: string;
    phone2: string | null;
    lastVisitDate: string | null;
    createdAt: string;
}

export default function SecretaryArchivedPatientsPage() {
    const confirm = useConfirm();
    const router = useRouter();
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const fetchArchived = useCallback(async () => {
        setLoading(true);
        const res = await fetch(`/api/patients?archived=true&page=${page}&limit=20`);
        const data = await res.json();
        setPatients(data.patients);
        setTotalPages(data.totalPages);
        setTotal(data.total);
        setLoading(false);
    }, [page]);

    useEffect(() => { fetchArchived(); }, [fetchArchived]);

    const handleRestore = async (id: number) => {
        const name = patients.find((p) => p.id === id)?.name;
        if (!(await confirm({
            title: `Restore ${name ?? "this patient"}?`,
            message: "They move back to the active patient list.",
            confirmLabel: "Restore",
        }))) return;
        await fetch(`/api/patients/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ archived: false }),
        });
        fetchArchived();
    };

    const formatDate = (d: string | null) => {
        if (!d) return "—";
        return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    };

    return (
        <div>
            <div className="staff-page-header">
                <h1>Archived Patients <span className="staff-page-count">({total})</span></h1>
                <Link href="/secretary/patients" className="btn-back">← Active Patients</Link>
            </div>

            <div className="staff-table-wrap">
                <table className="staff-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Phone</th>
                            <th>Last Visit</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr className="staff-table-state"><td colSpan={5}><p className="staff-loading" role="status">Loading…</p></td></tr>
                        ) : patients.length === 0 ? (
                            <tr className="staff-table-state"><td colSpan={5}>
                                <StaffEmpty icon={Archive} title="No archived patients" hint="Patients you archive move here. You can restore them any time." />
                            </td></tr>
                        ) : patients.map((p) => (
                            <tr key={p.id} className="staff-row-link" onClick={(e) => { if (shouldOpenRow(e)) router.push(`/secretary/patients/${p.id}`); }}>
                                <td className="staff-cell-id">{p.id}</td>
                                <td><Link href={`/secretary/patients/${p.id}`} className="staff-row-name">{p.name}</Link></td>
                                <td>{isMissingPhone(p.phone1) ? <span className="no-phone">No phone</span> : p.phone1}</td>
                                <td>{formatDate(p.lastVisitDate)}</td>
                                <td>
                                    <div className="staff-row-end">
                                        <button className="btn-sm btn-restore" onClick={() => handleRestore(p.id)}>Restore</button>
                                        <ChevronRight size={16} className="staff-row-chevron" aria-hidden="true" />
                                    </div>
                                </td>
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

            <style jsx>{`
                .staff-page-header :global(.btn-back) { color: rgba(255,255,255,0.5); text-decoration: none; font-size: 0.85rem; transition: color 0.15s; }
                .staff-page-header :global(.btn-back:hover) { color: #fff; }
                .btn-sm {
                    padding: 0.28rem 0.65rem; border-radius: var(--radius-sm, 2px); font-size: 0.78rem;
                    border: none; cursor: pointer; font-weight: 500; font-family: inherit;
                    text-decoration: none; display: inline-block;
                }
                .btn-restore { background: rgba(96,165,250,0.12); color: #93c5fd; }
                .btn-restore:hover { background: rgba(96,165,250,0.22); }
            `}</style>
        </div>
    );
}
