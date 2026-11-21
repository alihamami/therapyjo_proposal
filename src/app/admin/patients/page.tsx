"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { joinPhones } from "@/lib/phone";

interface Patient {
    id: number;
    name: string;
    phone1: string;
    phone2: string | null;
    pictureUrl: string | null;
    archived: boolean;
    lastVisitDate: string | null;
    createdAt: string;
}

export default function PatientsPage() {
    const router = useRouter();
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [showAdd, setShowAdd] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ name: "", phone1: "", phone2: "" });
    const [pictureFile, setPictureFile] = useState<File | null>(null);
    const [error, setError] = useState("");

    const fetchPatients = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams({
            page: page.toString(),
            limit: "20",
            ...(search && { search }),
        });
        const res = await fetch(`/api/patients?${params}`);
        const data = await res.json();
        setPatients(data.patients);
        setTotalPages(data.totalPages);
        setTotal(data.total);
        setLoading(false);
    }, [page, search]);

    useEffect(() => { fetchPatients(); }, [fetchPatients]);

    // Debounced search
    const [searchInput, setSearchInput] = useState("");
    useEffect(() => {
        const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
        return () => clearTimeout(t);
    }, [searchInput]);

    const handleAdd = async () => {
        setError("");
        if (!form.name || !form.phone1) {
            setError("Name and phone are required");
            return;
        }
        setSaving(true);

        let pictureUrl: string | null = null;
        if (pictureFile) {
            const fd = new FormData();
            fd.append("file", pictureFile);
            const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
            if (uploadRes.ok) {
                const uploadData = await uploadRes.json();
                pictureUrl = uploadData.url;
            }
        }

        const res = await fetch("/api/patients", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...form, pictureUrl }),
        });
        const data = await res.json();
        if (!res.ok) {
            setError(data.error + (data.duplicate ? ` (ID: ${data.duplicate.id} — ${data.duplicate.name})` : ""));
            setSaving(false);
            return;
        }
        setSaving(false);
        setShowAdd(false);
        setForm({ name: "", phone1: "", phone2: "" });
        setPictureFile(null);
        fetchPatients();
    };

    const handleArchive = async (id: number) => {
        if (!confirm("Archive this patient?")) return;
        await fetch(`/api/patients/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ archived: true }),
        });
        fetchPatients();
    };

    const formatDate = (d: string | null) => {
        if (!d) return "—";
        return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    };

    return (
        <div>
            <div className="page-header">
                <h1>Patients <span className="count">({total})</span></h1>
                <button className="btn-add" onClick={() => router.push("/admin/patients/new")}>+ Add Patient</button>
            </div>

            <div className="search-bar">
                <input
                    type="text"
                    placeholder="Search by name or phone…"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                />
            </div>

            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Phone</th>
                            <th>Last Visit</th>
                            <th>Created</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", padding: "2rem" }}>Loading…</td></tr>
                        ) : patients.length === 0 ? (
                            <tr><td colSpan={6} style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", padding: "2rem" }}>No patients found</td></tr>
                        ) : patients.map((p) => (
                            <tr key={p.id}>
                                <td className="id-cell">{p.id}</td>
                                <td className="name-cell">{p.name}</td>
                                <td>{joinPhones(p.phone1, p.phone2) ?? <span className="no-phone">No phone</span>}</td>
                                <td>{formatDate(p.lastVisitDate)}</td>
                                <td>{formatDate(p.createdAt)}</td>
                                <td>
                                    <div className="action-buttons">
                                        <Link href={`/admin/patients/${p.id}`} className="btn-sm btn-view">View</Link>
                                        <button className="btn-sm btn-archive" onClick={() => handleArchive(p.id)}>Archive</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="pagination">
                    <button disabled={page === 1} onClick={() => setPage(page - 1)}>← Prev</button>
                    <span>Page {page} of {totalPages}</span>
                    <button disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next →</button>
                </div>
            )}

            {/* Add Patient Modal */}
            {showAdd && (
                <div className="modal-overlay" onClick={() => setShowAdd(false)}>
                    <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                        <h2>Add Patient</h2>
                        {error && <div className="form-error">{error}</div>}
                        <div className="form-stack">
                            <div className="form-group">
                                <label>Patient Name *</label>
                                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
                            </div>
                            <div className="form-group">
                                <label>Phone 1 *</label>
                                <input value={form.phone1} onChange={(e) => setForm({ ...form, phone1: e.target.value })} placeholder="e.g. 0791234567" />
                            </div>
                            <div className="form-group">
                                <label>Phone 2</label>
                                <input value={form.phone2} onChange={(e) => setForm({ ...form, phone2: e.target.value })} placeholder="Optional" />
                            </div>
                            <div className="form-group">
                                <label>Patient Picture</label>
                                <input type="file" accept="image/*" onChange={(e) => setPictureFile(e.target.files?.[0] || null)} />
                            </div>
                        </div>
                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={() => setShowAdd(false)}>Cancel</button>
                            <button className="btn-save" onClick={handleAdd} disabled={saving}>
                                {saving ? "Saving…" : "Save Patient"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; }
                .page-header h1 { font-size: 1.5rem; font-weight: 600; }
                .count { color: rgba(255,255,255,0.35); font-weight: 400; font-size: 1.1rem; }
                .btn-add {
                    background: var(--primary, #4CAF93); color: #fff;
                    border: none; border-radius: var(--radius-sm, 2px); padding: 0.55rem 1.2rem;
                    font-size: 0.88rem; font-weight: 600; cursor: pointer; font-family: inherit;
                    transition: all 0.2s;
                }
                .btn-add:hover { background: var(--primary-dark, #3a8f77); }
                .search-bar { margin-bottom: 1rem; }
                .search-bar input {
                    width: 100%; max-width: 400px;
                    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
                    border-radius: var(--radius-sm, 2px); padding: 0.6rem 0.9rem;
                    color: #fff; font-size: 0.88rem; outline: none; font-family: inherit;
                }
                .search-bar input:focus { border-color: var(--primary, #4CAF93); }
                .search-bar input::placeholder { color: rgba(255,255,255,0.25); }
                .table-container {
                    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
                    border-radius: var(--radius-md, 4px); overflow-x: auto; overflow-y: hidden;
                    -webkit-overflow-scrolling: touch;
                }
                .data-table { width: 100%; min-width: 680px; border-collapse: collapse; }
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
                .id-cell { color: rgba(255,255,255,0.35); font-variant-numeric: tabular-nums; }
                .name-cell { font-weight: 500; color: #fff; }
                .action-buttons { display: flex; gap: 0.4rem; flex-wrap: wrap; }
                :global(.btn-sm) {
                    padding: 0.28rem 0.65rem; border-radius: var(--radius-sm, 2px); font-size: 0.78rem;
                    border: none; cursor: pointer; font-weight: 500; font-family: inherit;
                    text-decoration: none; display: inline-block;
                }
                :global(.btn-view) { background: rgba(76,175,147,0.12); color: #6ee7b7; }
                :global(.btn-view:hover) { background: rgba(76,175,147,0.22); }
                .btn-archive { background: rgba(251,191,36,0.12); color: #fbbf24; }
                .btn-archive:hover { background: rgba(251,191,36,0.22); }
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
                    border-radius: var(--radius-md, 4px); padding: 2rem; width: 100%; max-width: 440px;
                    max-height: 85vh; overflow-y: auto;
                }
                .modal-card h2 { font-size: 1.2rem; margin-bottom: 1.25rem; font-weight: 600; }
                .form-error {
                    background: rgba(220,38,38,0.1); border: 1px solid rgba(220,38,38,0.2);
                    color: #fca5a5; padding: 0.55rem 0.85rem; border-radius: var(--radius-sm, 2px);
                    font-size: 0.82rem; margin-bottom: 1rem;
                }
                .form-stack { display: flex; flex-direction: column; gap: 0.9rem; }
                .form-group { display: flex; flex-direction: column; gap: 0.35rem; }
                .form-group label { font-size: 0.78rem; color: rgba(255,255,255,0.55); font-weight: 500; }
                .form-group input {
                    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
                    border-radius: var(--radius-sm, 2px); padding: 0.6rem 0.8rem; color: #fff;
                    font-size: 0.88rem; outline: none; font-family: inherit;
                }
                .form-group input:focus { border-color: var(--primary, #4CAF93); }
                .modal-actions { display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 1.5rem; }
                .btn-cancel {
                    background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.6);
                    border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius-sm, 2px);
                    padding: 0.5rem 1rem; font-size: 0.85rem; cursor: pointer; font-family: inherit;
                }
                .btn-save {
                    background: var(--primary, #4CAF93); color: #fff;
                    border: none; border-radius: var(--radius-sm, 2px);
                    padding: 0.5rem 1.25rem; font-size: 0.85rem; font-weight: 600;
                    cursor: pointer; font-family: inherit;
                }
                .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }

                @media (max-width: 560px) {
                    .page-header { flex-direction: column; align-items: stretch; gap: 0.75rem; }
                    .btn-add { width: 100%; padding: 0.65rem 1.2rem; }
                    .search-bar input { max-width: 100%; }
                    .modal-card { padding: 1.25rem; }
                    :global(.btn-sm) { padding: 0.42rem 0.75rem; }
                }
            `}</style>
        </div>
    );
}
