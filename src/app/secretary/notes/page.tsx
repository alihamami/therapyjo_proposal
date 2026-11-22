"use client";

import { useState, useEffect, useCallback } from "react";

interface Doctor {
    id: string;
    name: string;
    color: string | null;
}

interface Note {
    id: number;
    name: string;
    noteDate: string;
    doctorCheckNote: boolean;
    details: string | null;
    doctor: { id: string; name: string; color: string | null } | null;
    doctorNameSnapshot: string | null;
}

export default function SecretaryNotesPage() {
    const [notes, setNotes] = useState<Note[]>([]);
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [search, setSearch] = useState("");
    const [doctorFilter, setDoctorFilter] = useState("all");

    const fetchDoctors = useCallback(async () => {
        const res = await fetch("/api/employees/doctors");
        const data = await res.json();
        setDoctors(data.filter((d: Doctor & { status: string }) => d.status === "ACTIVE"));
    }, []);

    const fetchNotes = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams({ page: String(page), limit: "20" });
        if (search) params.set("search", search);
        if (doctorFilter !== "all") params.set("doctorId", doctorFilter);
        const res = await fetch(`/api/notes?${params}`);
        const data = await res.json();
        setNotes(data.notes || []);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
        setLoading(false);
    }, [page, search, doctorFilter]);

    useEffect(() => { fetchDoctors(); }, [fetchDoctors]);
    useEffect(() => { fetchNotes(); }, [fetchNotes]);

    const formatDate = (d: string) => new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

    return (
        <div>
            <div className="page-header">
                <h1>Notes <span className="count">({total})</span></h1>
                <button className="btn-add" onClick={() => { window.location.href = "/secretary/notes/new"; }}>+ Add Note</button>
            </div>
            <div className="filters">
                <input className="search-input" placeholder="Search..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                <select className="filter-select" value={doctorFilter} onChange={(e) => { setDoctorFilter(e.target.value); setPage(1); }}>
                    <option value="all">All Doctors</option>
                    {doctors.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
                </select>
            </div>
            <div className="table-container">
                <table className="data-table">
                    <thead><tr><th>Date</th><th>Name</th><th>Doctor</th><th>Checked</th><th>Details</th></tr></thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", padding: "2rem" }}>Loading…</td></tr>
                        ) : notes.length === 0 ? (
                            <tr><td colSpan={5} style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", padding: "2rem" }}>No notes</td></tr>
                        ) : notes.map((n) => (
                            <tr key={n.id}>
                                <td>{formatDate(n.noteDate)}</td>
                                <td style={{ fontWeight: 600 }}>{n.name}</td>
                                <td><span style={{ borderLeft: `3px solid ${n.doctor?.color || "#666"}`, paddingLeft: "0.5rem" }}>{n.doctor?.name ?? n.doctorNameSnapshot ?? "—"}</span></td>
                                <td>{n.doctorCheckNote ? "✅" : "—"}</td>
                                <td className="note-details">{n.details || "—"}</td>
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
                .btn-add { background: var(--primary, #4CAF93); color: #fff; border: none; padding: 0.45rem 1rem; border-radius: var(--radius-sm, 2px); font-size: 0.82rem; font-weight: 600; cursor: pointer; font-family: inherit; }
                .filters { display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap; }
                .search-input { flex: 1; min-width: 200px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius-sm, 2px); padding: 0.5rem 0.75rem; color: #fff; font-size: 0.85rem; outline: none; font-family: inherit; }
                .search-input:focus { border-color: var(--primary, #4CAF93); }
                .filter-select { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 0.5rem 0.75rem; border-radius: var(--radius-sm, 2px); font-size: 0.82rem; font-family: inherit; }
                .filter-select option { background: #1a2e35; }
                .table-container { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: var(--radius-md, 4px); overflow: hidden; }
                .data-table { width: 100%; border-collapse: collapse; }
                .data-table th { text-align: left; padding: 0.85rem 1rem; font-size: 0.76rem; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(255,255,255,0.4); border-bottom: 1px solid rgba(255,255,255,0.06); font-weight: 600; }
                .data-table td { padding: 0.75rem 1rem; font-size: 0.85rem; border-bottom: 1px solid rgba(255,255,255,0.04); color: rgba(255,255,255,0.8); }
                .data-table tr:hover { background: rgba(255,255,255,0.02); }
                .note-details { max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: rgba(255,255,255,0.5); }
                .pagination { display: flex; align-items: center; justify-content: center; gap: 1rem; margin-top: 1.25rem; color: rgba(255,255,255,0.5); font-size: 0.85rem; }
                .pagination button { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 0.4rem 0.9rem; border-radius: var(--radius-sm, 2px); cursor: pointer; font-size: 0.82rem; font-family: inherit; }
                .pagination button:disabled { opacity: 0.3; cursor: not-allowed; }
            `}</style>
        </div>
    );
}
