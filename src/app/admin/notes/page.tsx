"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import RowMenu from "@/app/components/RowMenu";
import { shouldOpenRow } from "@/lib/rowLink";

interface Doctor {
    id: string;
    name: string;
    color: string | null;
}

interface Note {
    id: number;
    name: string;
    noteDate: string;
    doctorId: string | null;
    doctorCheckNote: boolean;
    details: string | null;
    createdAt: string;
    doctor: { id: string; name: string; color: string | null } | null;
    doctorNameSnapshot: string | null;
}

export default function NotesPage() {
    const [notes, setNotes] = useState<Note[]>([]);
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [search, setSearch] = useState("");
    const [doctorFilter, setDoctorFilter] = useState("all");
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState({
        name: "",
        noteDate: new Date().toISOString().split("T")[0],
        doctorId: "",
        doctorCheckNote: false,
        details: "",
    });
    const [saving, setSaving] = useState(false);

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

    const openAdd = () => {
        setEditId(null);
        setForm({
            name: "",
            noteDate: new Date().toISOString().split("T")[0],
            doctorId: doctors.length > 0 ? doctors[0].id : "",
            doctorCheckNote: false,
            details: "",
        });
        setShowModal(true);
    };

    const openEdit = (note: Note) => {
        setEditId(note.id);
        setForm({
            name: note.name,
            noteDate: new Date(note.noteDate).toISOString().split("T")[0],
            doctorId: note.doctorId,
            doctorCheckNote: note.doctorCheckNote,
            details: note.details || "",
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        setSaving(true);
        const url = editId ? `/api/notes/${editId}` : "/api/notes";
        const method = editId ? "PUT" : "POST";
        await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
        });
        setSaving(false);
        setShowModal(false);
        fetchNotes();
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Delete this note?")) return;
        await fetch(`/api/notes/${id}`, { method: "DELETE" });
        fetchNotes();
    };

    const formatDate = (d: string) =>
        new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

    return (
        <div>
            <div className="page-header">
                <h1>Notes <span className="count">({total})</span></h1>
                <button className="staff-btn staff-btn-primary" onClick={() => { window.location.href = "/admin/notes/new"; }}><Plus size={15} aria-hidden="true" />Add Note</button>
            </div>

            {/* Filters */}
            <div className="filters">
                <input
                    className="search-input"
                    placeholder="Search notes..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
                <select
                    className="filter-select"
                    value={doctorFilter}
                    onChange={(e) => { setDoctorFilter(e.target.value); setPage(1); }}
                >
                    <option value="all">All Doctors</option>
                    {doctors.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                </select>
            </div>

            {/* Table */}
            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Name</th>
                            <th>Doctor</th>
                            <th>Dr. Check</th>
                            <th>Details</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", padding: "2rem" }}>Loading…</td></tr>
                        ) : notes.length === 0 ? (
                            <tr><td colSpan={6} style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", padding: "2rem" }}>No notes found</td></tr>
                        ) : notes.map((n) => (
                            <tr key={n.id} className="staff-row-link" onClick={(e) => { if (shouldOpenRow(e)) openEdit(n); }}>
                                <td>{formatDate(n.noteDate)}</td>
                                <td className="note-name"><button type="button" className="staff-row-name" onClick={() => openEdit(n)}>{n.name}</button></td>
                                <td>
                                    <span className="doctor-tag" style={{ borderColor: n.doctor?.color || "#666" }}>
                                        {n.doctor?.name ?? n.doctorNameSnapshot ?? "—"}
                                    </span>
                                </td>
                                <td>{n.doctorCheckNote ? "✅" : "—"}</td>
                                <td className="note-details">{n.details || "—"}</td>
                                <td>
                                    <div className="staff-row-end">
                                        <RowMenu
                                            label={`More actions for ${n.name}`}
                                            items={[
                                                { label: "Edit", icon: Pencil, onSelect: () => openEdit(n) },
                                                { label: "Delete", icon: Trash2, onSelect: () => handleDelete(n.id), destructive: true },
                                            ]}
                                        />
                                        <ChevronRight size={16} className="staff-row-chevron" aria-hidden="true" />
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

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                        <h2>{editId ? "Edit Note" : "Add Note"}</h2>
                        <div className="form-stack">
                            <div className="form-group">
                                <label>Name / Title</label>
                                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Date</label>
                                    <input type="date" value={form.noteDate} onChange={(e) => setForm({ ...form, noteDate: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Doctor</label>
                                    <select value={form.doctorId} onChange={(e) => setForm({ ...form, doctorId: e.target.value })}>
                                        {doctors.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="checkbox-label">
                                    <input type="checkbox" checked={form.doctorCheckNote} onChange={(e) => setForm({ ...form, doctorCheckNote: e.target.checked })} />
                                    Doctor check note
                                </label>
                            </div>
                            <div className="form-group">
                                <label>Details</label>
                                <textarea rows={4} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />
                            </div>
                        </div>
                        <div className="modal-actions">
                            <button className="staff-btn staff-btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                            <button className="staff-btn staff-btn-primary" aria-busy={saving} onClick={handleSave} disabled={saving || !form.name}>
                                {saving ? "Saving…" : editId ? "Update" : "Create"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
                .page-header h1 { font-size: 1.5rem; font-weight: 600; }
                .count { color: rgba(255,255,255,0.35); font-weight: 400; font-size: 1.1rem; }
                .filters { display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap; }
                .search-input {
                    flex: 1; min-width: 200px;
                    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
                    border-radius: var(--radius-sm, 2px); padding: 0.5rem 0.75rem;
                    color: #fff; font-size: 0.85rem; outline: none; font-family: inherit;
                }
                .search-input:focus { border-color: var(--primary, #4CAF93); }
                .filter-select {
                    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
                    color: #fff; padding: 0.5rem 0.75rem; border-radius: var(--radius-sm, 2px);
                    font-size: 0.82rem; font-family: inherit;
                }
                .filter-select option { background: #1a2e35; }
                .table-container {
                    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
                    border-radius: var(--radius-md, 4px); overflow-x: auto; overflow-y: hidden;
                    -webkit-overflow-scrolling: touch;
                }
                .data-table { width: 100%; border-collapse: collapse; min-width: 720px; }
                .data-table th {
                    text-align: left; padding: 0.85rem 1rem; font-size: 0.76rem;
                    text-transform: uppercase; letter-spacing: 0.05em;
                    color: rgba(255,255,255,0.4); border-bottom: 1px solid rgba(255,255,255,0.06);
                    font-weight: 600;
                }
                .data-table td {
                    padding: 0.75rem 1rem; font-size: 0.85rem;
                    border-bottom: 1px solid rgba(255,255,255,0.04);
                    color: rgba(255,255,255,0.8);
                }
                .data-table tr:hover { background: rgba(255,255,255,0.02); }
                .note-name { font-weight: 600; }
                .note-details { max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: rgba(255,255,255,0.5); }
                .doctor-tag { border-left: 3px solid; padding-left: 0.5rem; }
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
                .modal-overlay {
                    position: fixed; inset: 0; background: rgba(0,0,0,0.6);
                    display: flex; align-items: center; justify-content: center;
                    z-index: 1000; backdrop-filter: blur(4px); padding: 1rem;
                }
                .modal-card {
                    background: var(--bg-dark-secondary, #243b44); border: 1px solid rgba(255,255,255,0.08);
                    border-radius: var(--radius-md, 4px); padding: 2rem; width: 100%; max-width: 480px;
                    max-height: 85vh; overflow-y: auto;
                }
                .modal-card h2 { font-size: 1.15rem; margin-bottom: 1.25rem; font-weight: 600; }
                .form-stack { display: flex; flex-direction: column; gap: 0.75rem; }
                .form-row { display: flex; gap: 0.75rem; }
                .form-row .form-group { flex: 1; }
                .form-group { display: flex; flex-direction: column; gap: 0.3rem; }
                .form-group label { font-size: 0.76rem; color: rgba(255,255,255,0.5); font-weight: 500; }
                .form-group input, .form-group textarea, .form-group select {
                    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
                    border-radius: var(--radius-sm, 2px); padding: 0.55rem 0.75rem; color: #fff;
                    font-size: 0.85rem; outline: none; font-family: inherit; resize: vertical;
                }
                .form-group select option { background: #1a2e35; }
                .form-group input:focus, .form-group textarea:focus, .form-group select:focus { border-color: var(--primary, #4CAF93); }
                .checkbox-label {
                    flex-direction: row !important; display: flex; align-items: center; gap: 0.4rem;
                    font-size: 0.8rem !important; cursor: pointer;
                }
                .checkbox-label input[type="checkbox"] { width: auto; }
                .modal-actions { display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 1.5rem; }

                @media (max-width: 560px) {
                    .page-header { flex-direction: column; align-items: stretch; gap: 0.5rem; }
                    .page-header .staff-btn { width: 100%; }
                    .search-input { min-width: 0; }
                    .form-row { flex-direction: column; gap: 0.75rem; }
                    .modal-card { padding: 1.25rem; }
                }
            `}</style>
        </div>
    );
}
