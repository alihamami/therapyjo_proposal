"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { CircleCheck, Plus, Search, StickyNote } from "lucide-react";
import StaffEmpty from "@/app/components/StaffEmpty";

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

    // Only the newest request may fill the list: an older, slower answer is
    // dropped instead of overwriting a newer one. (TJ-069h)
    const latest = useRef(0);
    const fetchNotes = useCallback(async () => {
        const req = ++latest.current;
        setLoading(true);
        const params = new URLSearchParams({ page: String(page), limit: "20" });
        if (search) params.set("search", search);
        if (doctorFilter !== "all") params.set("doctorId", doctorFilter);
        const res = await fetch(`/api/notes?${params}`);
        const data = await res.json();
        if (req !== latest.current) return;
        setNotes(data.notes || []);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
        setLoading(false);
    }, [page, search, doctorFilter]);

    useEffect(() => { fetchDoctors(); }, [fetchDoctors]);
    useEffect(() => { fetchNotes(); }, [fetchNotes]);

    // The box updates as you type; the search waits until typing pauses for
    // 300ms, as on admin's patient list. (TJ-069h)
    const [searchInput, setSearchInput] = useState("");
    useEffect(() => {
        const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
        return () => clearTimeout(t);
    }, [searchInput]);

    const formatDate = (d: string) => new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

    return (
        <div>
            <div className="staff-page-header">
                <h1>Notes <span className="staff-page-count">({total})</span></h1>
                <button className="staff-btn staff-btn-primary" onClick={() => { window.location.href = "/secretary/notes/new"; }}><Plus size={15} aria-hidden="true" />Add Note</button>
            </div>
            <div className="filters">
                <div className="staff-search">
                    <Search size={15} aria-hidden="true" />
                    <input type="text" aria-label="Search notes" placeholder="Search notes…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
                </div>
                <select className="filter-select" aria-label="Doctor" value={doctorFilter} onChange={(e) => { setDoctorFilter(e.target.value); setPage(1); }}>
                    <option value="all">All Doctors</option>
                    {doctors.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
                </select>
            </div>
            <div className="staff-table-wrap">
                <table className="staff-table">
                    <thead><tr><th>Date</th><th>Name</th><th>Doctor</th><th>Checked</th><th>Details</th></tr></thead>
                    <tbody>
                        {loading ? (
                            <tr className="staff-table-state"><td colSpan={5}><p className="staff-loading" role="status">Loading…</p></td></tr>
                        ) : notes.length === 0 ? (
                            <tr className="staff-table-state"><td colSpan={5}>
                                {search || doctorFilter !== "all" ? (
                                    <StaffEmpty icon={Search} title="No notes match your search" hint="Try other words, or choose All Doctors." />
                                ) : (
                                    <StaffEmpty
                                        icon={StickyNote}
                                        title="No notes yet"
                                        hint="Notes you add for the doctors appear here."
                                        action={<button className="staff-btn staff-btn-primary staff-btn-sm" onClick={() => { window.location.href = "/secretary/notes/new"; }}><Plus size={15} aria-hidden="true" />Add Note</button>}
                                    />
                                )}
                            </td></tr>
                        ) : notes.map((n) => (
                            <tr key={n.id}>
                                <td>{formatDate(n.noteDate)}</td>
                                <td style={{ fontWeight: 600 }}>{n.name}</td>
                                <td><span style={{ borderLeft: `3px solid ${n.doctor?.color || "#666"}`, paddingLeft: "0.5rem" }}>{n.doctor?.name ?? n.doctorNameSnapshot ?? "—"}</span></td>
                                <td>{n.doctorCheckNote ? <span className="check-yes"><CircleCheck size={16} role="img" aria-label="Checked" /></span> : "—"}</td>
                                <td className="note-details">{n.details || "—"}</td>
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
                .filters { display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap; }
                .filters .staff-search { flex: 1 1 200px; margin-bottom: 0; }
                .filter-select {
                    min-height: 36px; padding: 0.45rem 0.7rem;
                    background: rgba(255,255,255,0.05); border: 1px solid var(--staff-border-strong);
                    border-radius: var(--staff-radius-md); color: var(--staff-text); color-scheme: dark;
                    font-size: var(--staff-size-base); font-family: inherit;
                }
                .filter-select option { background: #1a2e35; }
                .check-yes { display: inline-flex; color: var(--staff-ok); }
                .note-details { max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: rgba(255,255,255,0.5); }
            `}</style>
        </div>
    );
}
