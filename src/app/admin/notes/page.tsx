"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronRight, CircleCheck, Pencil, Plus, Search, StickyNote, Trash2 } from "lucide-react";
import RowMenu from "@/app/components/RowMenu";
import { shouldOpenRow } from "@/lib/rowLink";
import { useConfirm } from "@/app/components/ConfirmDialog";
import StaffModal from "@/app/components/StaffModal";
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
    doctorId: string | null;
    doctorCheckNote: boolean;
    details: string | null;
    createdAt: string;
    doctor: { id: string; name: string; color: string | null } | null;
    doctorNameSnapshot: string | null;
}

export default function NotesPage() {
    const confirm = useConfirm();
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
        const name = notes.find((n) => n.id === id)?.name;
        if (!(await confirm({
            title: "Delete this note?",
            message: `${name ? `"${name}"` : "The note"} is deleted for good. This can't be undone.`,
            confirmLabel: "Delete",
            tone: "danger",
        }))) return;
        await fetch(`/api/notes/${id}`, { method: "DELETE" });
        fetchNotes();
    };

    const formatDate = (d: string) =>
        new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

    return (
        <div>
            <div className="staff-page-header">
                <h1>Notes <span className="staff-page-count">({total})</span></h1>
                <button className="staff-btn staff-btn-primary" onClick={() => { window.location.href = "/admin/notes/new"; }}><Plus size={15} aria-hidden="true" />Add Note</button>
            </div>

            {/* Filters */}
            <div className="filters">
                <div className="staff-search">
                    <Search size={15} aria-hidden="true" />
                    <input
                        type="text"
                        aria-label="Search notes"
                        placeholder="Search notes…"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                    />
                </div>
                <select
                    className="filter-select"
                    aria-label="Doctor"
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
            <div className="staff-table-wrap">
                <table className="staff-table">
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
                            <tr className="staff-table-state"><td colSpan={6}><p className="staff-loading" role="status">Loading…</p></td></tr>
                        ) : notes.length === 0 ? (
                            <tr className="staff-table-state"><td colSpan={6}>
                                {search || doctorFilter !== "all" ? (
                                    <StaffEmpty icon={Search} title="No notes match your search" hint="Try other words, or choose All Doctors." />
                                ) : (
                                    <StaffEmpty
                                        icon={StickyNote}
                                        title="No notes yet"
                                        hint="Notes you add for the doctors appear here."
                                        action={<button className="staff-btn staff-btn-primary staff-btn-sm" onClick={() => { window.location.href = "/admin/notes/new"; }}><Plus size={15} aria-hidden="true" />Add Note</button>}
                                    />
                                )}
                            </td></tr>
                        ) : notes.map((n) => (
                            <tr key={n.id} className="staff-row-link" onClick={(e) => { if (shouldOpenRow(e)) openEdit(n); }}>
                                <td>{formatDate(n.noteDate)}</td>
                                <td className="note-name"><button type="button" className="staff-row-name" onClick={() => openEdit(n)}>{n.name}</button></td>
                                <td>
                                    <span className="doctor-tag" style={{ borderColor: n.doctor?.color || "#666" }}>
                                        {n.doctor?.name ?? n.doctorNameSnapshot ?? "—"}
                                    </span>
                                </td>
                                <td>{n.doctorCheckNote ? <span className="check-yes"><CircleCheck size={16} role="img" aria-label="Checked" /></span> : "—"}</td>
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
                <div className="staff-pagination">
                    <button className="staff-btn staff-btn-secondary staff-btn-sm" disabled={page === 1} onClick={() => setPage(page - 1)}>← Prev</button>
                    <span>Page {page} of {totalPages}</span>
                    <button className="staff-btn staff-btn-secondary staff-btn-sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next →</button>
                </div>
            )}

            {/* Add/Edit Modal (design 2B, TJ-069d1) */}
            {showModal && (
                <StaffModal
                    title={editId ? "Edit Note" : "Add Note"}
                    onClose={() => setShowModal(false)}
                    footer={<>
                        <button className="staff-btn staff-btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                        <button className="staff-btn staff-btn-primary" aria-busy={saving} onClick={handleSave} disabled={saving || !form.name}>
                            {saving ? "Saving…" : editId ? "Update" : "Create"}
                        </button>
                    </>}
                >
                    <div className="staff-field">
                        <label htmlFor="note-name">Name / Title</label>
                        <input id="note-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
                    </div>
                    <div className="staff-field-row">
                        <div className="staff-field">
                            <label htmlFor="note-date">Date</label>
                            <input id="note-date" type="date" value={form.noteDate} onChange={(e) => setForm({ ...form, noteDate: e.target.value })} />
                        </div>
                        <div className="staff-field">
                            <label htmlFor="note-doctor">Doctor</label>
                            <select id="note-doctor" value={form.doctorId} onChange={(e) => setForm({ ...form, doctorId: e.target.value })}>
                                {doctors.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
                            </select>
                        </div>
                    </div>
                    <label className="staff-check">
                        <input type="checkbox" checked={form.doctorCheckNote} onChange={(e) => setForm({ ...form, doctorCheckNote: e.target.checked })} />
                        Doctor check note
                    </label>
                    <div className="staff-field">
                        <label htmlFor="note-details">Details</label>
                        <textarea id="note-details" rows={4} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />
                    </div>
                </StaffModal>
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
                .staff-table { min-width: 720px; }
                .note-name { font-weight: 600; }
                .check-yes { display: inline-flex; color: var(--staff-ok); }
                .note-details { max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: rgba(255,255,255,0.5); }
                .doctor-tag { border-left: 3px solid; padding-left: 0.5rem; }
            `}</style>
        </div>
    );
}
