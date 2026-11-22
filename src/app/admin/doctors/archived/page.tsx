"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useConfirm } from "@/app/components/ConfirmDialog";
import StaffModal from "@/app/components/StaffModal";

interface DoctorProfile {
    id: string;
    name: string;
    title: string;
    specialty: string;
    updatedAt: string;
}

export default function ArchivedDoctorsPage() {
    const confirm = useConfirm();
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
        const name = doctors.find((d) => d.id === id)?.name;
        if (!(await confirm({
            title: `Restore ${name ?? "this doctor"} to the website?`,
            message: "Their profile shows on the public Doctors page again.",
            confirmLabel: "Restore",
        }))) return;
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
                <StaffModal
                    title={`Delete ${deleteTarget.name}?`}
                    onClose={() => setDeleteTarget(null)}
                    closeDisabled={deleting}
                    footer={<>
                        <button className="staff-btn staff-btn-secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
                        <button
                            className="staff-btn staff-btn-danger"
                            aria-busy={deleting}
                            onClick={handleHardDelete}
                            disabled={deleting || deleteConfirm !== deleteTarget.name}
                        >
                            {deleting ? "Deleting…" : "Delete permanently"}
                        </button>
                    </>}
                >
                    <p className="staff-modal-text">
                        This permanently removes the public profile and its photo, and cannot be undone.
                        It does not touch the doctor&apos;s employee account, reservations, or notes.
                    </p>
                    {deleteError && <div className="staff-form-error" role="alert">{deleteError}</div>}
                    <div className="staff-field">
                        <label htmlFor="delete-confirm">Type <strong>{deleteTarget.name}</strong> to confirm</label>
                        <input
                            id="delete-confirm"
                            value={deleteConfirm}
                            onChange={(e) => setDeleteConfirm(e.target.value)}
                            autoComplete="off"
                            autoFocus
                        />
                    </div>
                </StaffModal>
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

                @media (max-width: 560px) {
                    .page-header { flex-direction: column; align-items: stretch; gap: 0.75rem; }
                    .btn-restore, .btn-delete { padding: 0.45rem 0.75rem; }
                }
            `}</style>
        </div>
    );
}
