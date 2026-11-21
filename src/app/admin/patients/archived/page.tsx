"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Patient {
    id: number;
    name: string;
    phone1: string;
    phone2: string | null;
    lastVisitDate: string | null;
    createdAt: string;
}

export default function ArchivedPatientsPage() {
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
        if (!confirm("Restore this patient?")) return;
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
            <div className="page-header">
                <h1>Archived Patients <span className="count">({total})</span></h1>
                <Link href="/admin/patients" className="btn-back">← Active Patients</Link>
            </div>

            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Phone</th>
                            <th>Last Visit</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", padding: "2rem" }}>Loading…</td></tr>
                        ) : patients.length === 0 ? (
                            <tr><td colSpan={5} style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", padding: "2rem" }}>No archived patients</td></tr>
                        ) : patients.map((p) => (
                            <tr key={p.id}>
                                <td style={{ color: "rgba(255,255,255,0.3)" }}>{p.id}</td>
                                <td>{p.name}</td>
                                <td>{p.phone1}</td>
                                <td>{formatDate(p.lastVisitDate)}</td>
                                <td>
                                    <div className="action-buttons">
                                        <Link href={`/admin/patients/${p.id}`} className="btn-sm btn-view">View</Link>
                                        <button className="btn-sm btn-restore" onClick={() => handleRestore(p.id)}>Restore</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="pagination">
                    <button disabled={page === 1} onClick={() => setPage(page - 1)}>← Prev</button>
                    <span>Page {page} of {totalPages}</span>
                    <button disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next →</button>
                </div>
            )}

            <style jsx>{`
                .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; }
                .page-header h1 { font-size: 1.5rem; font-weight: 600; }
                .count { color: rgba(255,255,255,0.35); font-weight: 400; font-size: 1.1rem; }
                :global(.btn-back) {
                    color: rgba(255,255,255,0.5); text-decoration: none; font-size: 0.85rem;
                    transition: color 0.15s;
                }
                :global(.btn-back:hover) { color: #fff; }
                .table-container {
                    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
                    border-radius: var(--radius-md, 4px); overflow-x: auto; overflow-y: hidden;
                    -webkit-overflow-scrolling: touch;
                }
                .data-table { width: 100%; min-width: 600px; border-collapse: collapse; }
                .data-table th {
                    text-align: left; padding: 0.85rem 1rem; font-size: 0.76rem;
                    text-transform: uppercase; letter-spacing: 0.05em;
                    color: rgba(255,255,255,0.4); border-bottom: 1px solid rgba(255,255,255,0.06);
                    font-weight: 600;
                }
                .data-table td {
                    padding: 0.75rem 1rem; font-size: 0.88rem;
                    border-bottom: 1px solid rgba(255,255,255,0.04);
                    color: rgba(255,255,255,0.8);
                }
                .data-table tr:hover { background: rgba(255,255,255,0.02); }
                .action-buttons { display: flex; gap: 0.4rem; flex-wrap: wrap; }
                :global(.btn-sm) {
                    padding: 0.28rem 0.65rem; border-radius: var(--radius-sm, 2px); font-size: 0.78rem;
                    border: none; cursor: pointer; font-weight: 500; font-family: inherit;
                    text-decoration: none; display: inline-block;
                }
                :global(.btn-view) { background: rgba(76,175,147,0.12); color: #6ee7b7; }
                :global(.btn-view:hover) { background: rgba(76,175,147,0.22); }
                .btn-restore { background: rgba(96,165,250,0.12); color: #93c5fd; }
                .btn-restore:hover { background: rgba(96,165,250,0.22); }
                .pagination {
                    display: flex; align-items: center; justify-content: center; gap: 1rem;
                    margin-top: 1.25rem; color: rgba(255,255,255,0.5); font-size: 0.85rem;
                }
                .pagination button {
                    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
                    color: #fff; padding: 0.4rem 0.9rem; border-radius: var(--radius-sm, 2px);
                    cursor: pointer; font-size: 0.82rem; font-family: inherit;
                }
                .pagination button:disabled { opacity: 0.3; cursor: not-allowed; }

                @media (max-width: 560px) {
                    .page-header { flex-direction: column; align-items: stretch; gap: 0.75rem; }
                    :global(.btn-sm) { padding: 0.42rem 0.75rem; }
                }
            `}</style>
        </div>
    );
}
