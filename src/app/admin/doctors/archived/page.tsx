"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface DoctorProfile {
    id: string;
    name: string;
    title: string;
    specialty: string;
    updatedAt: string;
}

export default function ArchivedDoctorsPage() {
    const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleteTarget, setDeleteTarget] = useState<DoctorProfile | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState("");
    const [deleteError, setDeleteError] = useState("");
    const [deleting, setDeleting] = useState(false);

    const fetchArchived = useCallback(async () => {
        setLoading(true);
        const res = await fetch("/api/doctor-profiles?archived=true");
        const data = await res.json();
        setDoctors(Array.isArray(data) ? data : []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchArchived(); }, [fetchArchived]);

    const handleRestore = async (id: string) => {
        if (!confirm("Restore this doctor to the public site?")) return;
        await fetch(`/api/doctor-profiles/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ archived: false }),
        });
        fetchArchived();
    };

    const openDelete = (doc: DoctorProfile) => {
        setDeleteTarget(doc);
        setDeleteConfirm("");
        setDeleteError("");
    };

    const handleHardDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        setDeleteError("");
        const res = await fetch(`/api/doctor-profiles/${deleteTarget.id}?hard=true`, { method: "DELETE" });
        setDeleting(false);
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setDeleteError(data.error || "Could not delete this profile.");
            return;
        }
        setDeleteTarget(null);
        fetchArchived();
    };

    const formatDate = (d: string) =>
        new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

    return (
        <div>
            <div className="page-header">
                <h1>Archived Doctors <span className="count">({doctors.length})</span></h1>
                <Link href="/admin/doctors" className="btn-back">← Active Doctors</Link>
            </div>

            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Title</th>
                            <th>Specialty</th>
                            <th>Archived</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} className="empty-cell">Loading…</td></tr>
                        ) : doctors.length === 0 ? (
                            <tr><td colSpan={5} className="empty-cell">No archived doctors</td></tr>
                        ) : doctors.map((d) => (
                            <tr key={d.id}>
                                <td>{d.name}</td>
                                <td>{d.title}</td>
                                <td>{d.specialty || "—"}</td>
                                <td>{formatDate(d.updatedAt)}</td>
                                <td>
                                    <div className="action-buttons">
                                        <button className="btn-restore" onClick={() => handleRestore(d.id)}>Restore</button>
                                        <button className="btn-delete" onClick={() => openDelete(d)}>Delete permanently</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {deleteTarget && (
                <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
                    <div className="modal-card modal-narrow" onClick={(e) => e.stopPropagation()}>
                        <h2>Delete {deleteTarget.name}?</h2>
                        <p className="delete-warning">
                            This permanently removes the public profile and its photo, and cannot be undone.
                            It does not touch the doctor&apos;s employee account, reservations, or notes.
                        </p>
                        {deleteError && <div className="error-msg" role="alert">{deleteError}</div>}
                        <div className="form-group">
                            <label>Type <strong>{deleteTarget.name}</strong> to confirm</label>
                            <input
                                value={deleteConfirm}
                                onChange={(e) => setDeleteConfirm(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="modal-actions">
                            <button className="staff-btn staff-btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
                            <button
                                className="btn-danger"
                                onClick={handleHardDelete}
                                disabled={deleting || deleteConfirm !== deleteTarget.name}
                            >
                                {deleting ? "Deleting…" : "Delete permanently"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; }
                .page-header h1 { font-size: 1.5rem; font-weight: 600; }
                .count { color: rgba(255,255,255,0.35); font-weight: 400; font-size: 1.1rem; }
                :global(.btn-back) { color: rgba(255,255,255,0.5); text-decoration: none; font-size: 0.85rem; transition: color 0.15s; }
                :global(.btn-back:hover) { color: #fff; }
                .table-container {
                    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
                    border-radius: 10px; overflow-x: auto; overflow-y: hidden;
                    -webkit-overflow-scrolling: touch;
                }
                .data-table { width: 100%; min-width: 640px; border-collapse: collapse; }
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
                .empty-cell { text-align: center; color: rgba(255,255,255,0.35); padding: 2rem !important; }
                .action-buttons { display: flex; gap: 0.5rem; flex-wrap: wrap; }
                .btn-restore {
                    background: rgba(16,185,129,0.15); color: #6ee7b7; border: none;
                    padding: 0.3rem 0.75rem; border-radius: 6px; font-size: 0.8rem;
                    cursor: pointer; font-weight: 500; font-family: inherit;
                }
                .btn-restore:hover { background: rgba(16,185,129,0.25); }
                .btn-delete {
                    background: rgba(239,68,68,0.15); color: #fca5a5; border: none;
                    padding: 0.3rem 0.75rem; border-radius: 6px; font-size: 0.8rem;
                    cursor: pointer; font-weight: 500; font-family: inherit;
                }
                .btn-delete:hover { background: rgba(239,68,68,0.25); }
                .modal-overlay {
                    position: fixed; inset: 0; background: rgba(0,0,0,0.6);
                    display: flex; align-items: center; justify-content: center;
                    z-index: 1000; backdrop-filter: blur(4px);
                }
                .modal-card {
                    background: #1e293b; border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 16px; padding: 2rem; width: 100%; max-width: 420px;
                }
                .modal-card h2 { font-size: 1.3rem; margin-bottom: 1rem; font-weight: 600; }
                .delete-warning { font-size: 0.85rem; color: rgba(255,255,255,0.6); margin-bottom: 1rem; line-height: 1.5; }
                .form-group { display: flex; flex-direction: column; gap: 0.4rem; }
                .form-group label { font-size: 0.8rem; color: rgba(255,255,255,0.6); font-weight: 500; }
                .form-group input {
                    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 8px; padding: 0.65rem 0.8rem; color: #fff;
                    font-size: 0.9rem; outline: none; font-family: inherit; width: 100%;
                }
                .form-group input:focus { border-color: #6ee7b7; }
                .modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem; }
                .btn-danger {
                    background: #dc2626; color: #fff; border: none; border-radius: 10px;
                    padding: 0.6rem 1.25rem; font-size: 0.9rem; font-weight: 600;
                    cursor: pointer; font-family: inherit;
                }
                .btn-danger:hover:not(:disabled) { background: #b91c1c; }
                .btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }
                .error-msg {
                    background: rgba(220,38,38,0.1); border: 1px solid rgba(220,38,38,0.2);
                    color: #fca5a5; padding: 0.5rem 0.75rem; border-radius: 6px;
                    font-size: 0.82rem; margin-bottom: 0.75rem;
                }

                @media (max-width: 560px) {
                    .page-header { flex-direction: column; align-items: stretch; gap: 0.75rem; }
                    .btn-restore, .btn-delete { padding: 0.45rem 0.75rem; }
                    .modal-overlay { padding: 1rem; }
                    .modal-card { padding: 1.25rem; max-height: 85vh; overflow-y: auto; }
                }
            `}</style>
        </div>
    );
}
