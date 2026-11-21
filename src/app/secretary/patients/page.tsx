"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isMissingPhone } from "@/lib/phone";

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

    // Add patient modal
    const [showAdd, setShowAdd] = useState(false);
    const [addForm, setAddForm] = useState({ name: "", phone1: "", phone2: "" });
    const [pictureFile, setPictureFile] = useState<File | null>(null);
    const [addError, setAddError] = useState("");
    const [saving, setSaving] = useState(false);

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

    const handleAdd = async () => {
        if (!addForm.name || !addForm.phone1) { setAddError("Name and Phone 1 are required"); return; }
        setSaving(true);
        setAddError("");

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
            body: JSON.stringify({ ...addForm, pictureUrl }),
        });
        const data = await res.json();
        setSaving(false);
        if (res.ok) { setShowAdd(false); setAddForm({ name: "", phone1: "", phone2: "" }); setPictureFile(null); fetchPatients(); }
        else { setAddError(data.error || "Error"); }
    };

    const formatDate = (d: string | null) => {
        if (!d) return "—";
        return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    };

    return (
        <div>
            <div className="page-header">
                <h1>Patients <span className="count">({total})</span></h1>
                <button className="btn-add" onClick={() => router.push("/secretary/patients/new")}>+ Add Patient</button>
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
                        <tr><th>ID</th><th>Name</th><th>Phone</th><th>Last Visit</th><th>Action</th></tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", padding: "2rem" }}>Loading…</td></tr>
                        ) : patients.length === 0 ? (
                            <tr><td colSpan={5} style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", padding: "2rem" }}>No patients found</td></tr>
                        ) : patients.map((p) => (
                            <tr key={p.id}>
                                <td style={{ color: "rgba(255,255,255,0.3)" }}>{p.id}</td>
                                <td>{p.name}</td>
                                <td>{isMissingPhone(p.phone1) ? <span className="no-phone">No phone</span> : p.phone1}</td>
                                <td>{formatDate(p.lastVisitDate)}</td>
                                <td><Link href={`/secretary/patients/${p.id}`} className="btn-sm btn-view">View</Link></td>
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

            {showAdd && (
                <div className="modal-overlay" onClick={() => setShowAdd(false)}>
                    <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                        <h2>Add Patient</h2>
                        {addError && <div className="error-msg">{addError}</div>}
                        <div className="form-stack">
                            <div className="form-group"><label>Name</label><input value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} /></div>
                            <div className="form-group"><label>Phone 1</label><input value={addForm.phone1} onChange={(e) => setAddForm({ ...addForm, phone1: e.target.value })} /></div>
                            <div className="form-group"><label>Phone 2</label><input value={addForm.phone2} onChange={(e) => setAddForm({ ...addForm, phone2: e.target.value })} /></div>
                            <div className="form-group"><label>Picture</label><input type="file" accept="image/*" onChange={(e) => setPictureFile(e.target.files?.[0] || null)} /></div>
                        </div>
                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={() => setShowAdd(false)}>Cancel</button>
                            <button className="btn-save" onClick={handleAdd} disabled={saving}>{saving ? "Saving…" : "Create"}</button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
                .page-header h1 { font-size: 1.5rem; font-weight: 600; }
                .count { color: rgba(255,255,255,0.35); font-weight: 400; font-size: 1.1rem; }
                .btn-add { background: var(--primary, #4CAF93); color: #fff; border: none; padding: 0.45rem 1rem; border-radius: var(--radius-sm, 2px); font-size: 0.82rem; font-weight: 600; cursor: pointer; font-family: inherit; }
                .search-input { width: 100%; max-width: 360px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius-sm, 2px); padding: 0.5rem 0.75rem; color: #fff; font-size: 0.85rem; outline: none; font-family: inherit; margin-bottom: 1rem; }
                .search-input:focus { border-color: var(--primary, #4CAF93); }
                .table-container { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: var(--radius-md, 4px); overflow: hidden; }
                .data-table { width: 100%; border-collapse: collapse; }
                .data-table th { text-align: left; padding: 0.85rem 1rem; font-size: 0.76rem; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(255,255,255,0.4); border-bottom: 1px solid rgba(255,255,255,0.06); font-weight: 600; }
                .data-table td { padding: 0.75rem 1rem; font-size: 0.85rem; border-bottom: 1px solid rgba(255,255,255,0.04); color: rgba(255,255,255,0.8); }
                .data-table tr:hover { background: rgba(255,255,255,0.02); }
                :global(.btn-sm) { padding: 0.28rem 0.6rem; border-radius: var(--radius-sm, 2px); font-size: 0.76rem; border: none; cursor: pointer; font-weight: 500; font-family: inherit; text-decoration: none; display: inline-block; }
                :global(.btn-view) { background: rgba(76,175,147,0.12); color: #6ee7b7; }
                :global(.btn-view:hover) { background: rgba(76,175,147,0.22); }
                .pagination { display: flex; align-items: center; justify-content: center; gap: 1rem; margin-top: 1.25rem; color: rgba(255,255,255,0.5); font-size: 0.85rem; }
                .pagination button { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 0.4rem 0.9rem; border-radius: var(--radius-sm, 2px); cursor: pointer; font-size: 0.82rem; font-family: inherit; }
                .pagination button:disabled { opacity: 0.3; cursor: not-allowed; }
                .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(4px); }
                .modal-card { background: var(--bg-dark-secondary, #243b44); border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius-md, 4px); padding: 2rem; width: 100%; max-width: 440px; }
                .modal-card h2 { font-size: 1.1rem; margin-bottom: 1rem; font-weight: 600; }
                .error-msg { background: rgba(220,38,38,0.1); border: 1px solid rgba(220,38,38,0.2); color: #fca5a5; padding: 0.5rem; border-radius: var(--radius-sm, 2px); font-size: 0.82rem; margin-bottom: 0.75rem; }
                .form-stack { display: flex; flex-direction: column; gap: 0.75rem; }
                .form-group { display: flex; flex-direction: column; gap: 0.25rem; }
                .form-group label { font-size: 0.76rem; color: rgba(255,255,255,0.5); font-weight: 500; }
                .form-group input { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius-sm, 2px); padding: 0.5rem 0.7rem; color: #fff; font-size: 0.85rem; outline: none; font-family: inherit; }
                .form-group input:focus { border-color: var(--primary, #4CAF93); }
                .modal-actions { display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 1.25rem; }
                .btn-cancel { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.6); border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius-sm, 2px); padding: 0.5rem 1rem; font-size: 0.85rem; cursor: pointer; font-family: inherit; }
                .btn-save { background: var(--primary, #4CAF93); color: #fff; border: none; border-radius: var(--radius-sm, 2px); padding: 0.5rem 1.2rem; font-size: 0.85rem; font-weight: 600; cursor: pointer; font-family: inherit; }
                .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
            `}</style>
        </div>
    );
}
