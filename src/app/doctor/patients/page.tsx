"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { shouldOpenRow } from "@/lib/rowLink";

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
            <div className="page-header">
                <h1>Patients <span className="count">({total})</span></h1>
            </div>

            <input
                className="search-input"
                placeholder="Search by name or phone..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />

            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr><th>ID</th><th>Name</th><th>Last Visit</th><th></th></tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={4} style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", padding: "2rem" }}>Loading…</td></tr>
                        ) : patients.length === 0 ? (
                            <tr><td colSpan={4} style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", padding: "2rem" }}>No patients found</td></tr>
                        ) : patients.map((p) => (
                            <tr key={p.id} className="staff-row-link" onClick={(e) => { if (shouldOpenRow(e)) router.push(`/doctor/patients/${p.id}`); }}>
                                <td style={{ color: "rgba(255,255,255,0.3)" }}>{p.id}</td>
                                <td><Link href={`/doctor/patients/${p.id}`} className="staff-row-name">{p.name}</Link></td>
                                <td>{formatDate(p.lastVisitDate)}</td>
                                <td><div className="staff-row-end"><ChevronRight size={16} className="staff-row-chevron" aria-hidden="true" /></div></td>
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
                .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
                .page-header h1 { font-size: 1.5rem; font-weight: 600; }
                .count { color: rgba(255,255,255,0.35); font-weight: 400; font-size: 1.1rem; }
                .search-input { width: 100%; max-width: 360px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius-sm, 2px); padding: 0.5rem 0.75rem; color: #fff; font-size: 0.85rem; outline: none; font-family: inherit; margin-bottom: 1rem; }
                .search-input:focus { border-color: var(--primary, #4CAF93); }
                .table-container { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: var(--radius-md, 4px); overflow: hidden; }
                .data-table { width: 100%; border-collapse: collapse; }
                .data-table th { text-align: left; padding: 0.85rem 1rem; font-size: 0.76rem; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(255,255,255,0.4); border-bottom: 1px solid rgba(255,255,255,0.06); font-weight: 600; }
                .data-table td { padding: 0.75rem 1rem; font-size: 0.85rem; border-bottom: 1px solid rgba(255,255,255,0.04); color: rgba(255,255,255,0.8); }
                .data-table tr:hover { background: rgba(255,255,255,0.02); }
                .pagination { display: flex; align-items: center; justify-content: center; gap: 1rem; margin-top: 1.25rem; color: rgba(255,255,255,0.5); font-size: 0.85rem; }
                .pagination button { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 0.4rem 0.9rem; border-radius: var(--radius-sm, 2px); cursor: pointer; font-size: 0.82rem; font-family: inherit; }
                .pagination button:disabled { opacity: 0.3; cursor: not-allowed; }
            `}</style>
        </div>
    );
}
