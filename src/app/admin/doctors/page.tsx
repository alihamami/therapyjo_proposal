"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Archive, Eye, EyeOff, Pencil, Plus } from "lucide-react";
import RowMenu from "@/app/components/RowMenu";
import { shouldOpenRow } from "@/lib/rowLink";

interface DoctorProfile {
    id: string;
    name: string;
    title: string;
    specialty: string;
    bio: string | null;
    contact: string | null;
    photo: string | null;
    order: number;
    hidden: boolean;
    userId: string | null;
}

interface LoginAccount {
    id: string;
    name: string;
}

const emptyForm = { name: "", title: "", specialty: "", bio: "", contact: "", order: 0, userId: "" };

export default function DoctorsCmsPage() {
    const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
    const [accounts, setAccounts] = useState<LoginAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<DoctorProfile | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dragId = useRef<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);

    const fetchDoctors = useCallback(async () => {
        const res = await fetch("/api/doctor-profiles");
        const data = await res.json();
        setDoctors(Array.isArray(data) ? data : []);
        setLoading(false);
    }, []);

    const fetchAccounts = useCallback(async () => {
        const res = await fetch("/api/employees/doctors");
        const data = await res.json();
        setAccounts(Array.isArray(data) ? data : []);
    }, []);

    useEffect(() => { fetchDoctors(); fetchAccounts(); }, [fetchDoctors, fetchAccounts]);

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2200);
    };

    const openAdd = () => {
        setEditing(null);
        setForm({ ...emptyForm, order: doctors.length + 1 });
        setPhotoFile(null);
        setPhotoPreview(null);
        setShowModal(true);
    };

    const openEdit = (doc: DoctorProfile) => {
        setEditing(doc);
        setForm({
            name: doc.name, title: doc.title, specialty: doc.specialty,
            bio: doc.bio || "", contact: doc.contact || "", order: doc.order,
            userId: doc.userId || "",
        });
        setPhotoFile(null);
        setPhotoPreview(doc.photo);
        setShowModal(true);
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPhotoFile(file);
        const reader = new FileReader();
        reader.onload = () => setPhotoPreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        if (!form.name.trim() || !form.title.trim()) return;
        setSaving(true);

        let photoUrl = editing?.photo || null;
        if (photoFile) {
            const fd = new FormData();
            fd.append("file", photoFile);
            fd.append("folder", "doctor-profiles");
            const up = await fetch("/api/upload", { method: "POST", body: fd });
            if (up.ok) {
                const data = await up.json();
                photoUrl = data.url;
            }
        }

        const payload = { ...form, photo: photoUrl };
        const url = editing ? `/api/doctor-profiles/${editing.id}` : "/api/doctor-profiles";
        const method = editing ? "PUT" : "POST";

        await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        setSaving(false);
        setShowModal(false);
        fetchDoctors();
        showToast("Doctor saved");
    };

    const toggleHidden = async (doc: DoctorProfile) => {
        await fetch(`/api/doctor-profiles/${doc.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ hidden: !doc.hidden }),
        });
        fetchDoctors();
    };

    const archiveDoctor = async (doc: DoctorProfile) => {
        if (!confirm(`Archive ${doc.name}? This removes them from the public site.`)) return;
        await fetch(`/api/doctor-profiles/${doc.id}`, { method: "DELETE" });
        fetchDoctors();
        showToast("Doctor archived");
    };

    // Drag & drop reorder
    const onDragStart = (id: string) => { dragId.current = id; };
    const onDragOver = (e: React.DragEvent, id: string) => {
        e.preventDefault();
        setDragOverId(id);
    };
    const onDrop = async (targetId: string) => {
        const sourceId = dragId.current;
        dragId.current = null;
        setDragOverId(null);
        if (!sourceId || sourceId === targetId) return;

        const reordered = [...doctors];
        const fromIdx = reordered.findIndex((d) => d.id === sourceId);
        const toIdx = reordered.findIndex((d) => d.id === targetId);
        if (fromIdx === -1 || toIdx === -1) return;
        const [moved] = reordered.splice(fromIdx, 1);
        reordered.splice(toIdx, 0, moved);
        setDoctors(reordered);

        await fetch("/api/doctor-profiles/reorder", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: reordered.map((d) => d.id) }),
        });
        showToast("Order updated");
        fetchDoctors();
    };

    if (loading) {
        return <div style={{ color: "rgba(255,255,255,0.5)", padding: "2rem" }}>Loading…</div>;
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>Doctors</h1>
                    <p className="subtitle">Drag cards to set the order they appear on the public site.</p>
                </div>
                <button className="staff-btn staff-btn-primary" onClick={openAdd}><Plus size={15} aria-hidden="true" />Add Doctor</button>
            </div>

            <div className="grid">
                {doctors.map((doc) => (
                    <div
                        key={doc.id}
                        className={`cms-doctor-card ${doc.hidden ? "is-hidden" : ""} ${dragOverId === doc.id ? "drag-over" : ""}`}
                        draggable
                        onDragStart={() => onDragStart(doc.id)}
                        onDragOver={(e) => onDragOver(e, doc.id)}
                        onDragLeave={() => setDragOverId(null)}
                        onDrop={() => onDrop(doc.id)}
                        onClick={(e) => { if (shouldOpenRow(e)) openEdit(doc); }}
                    >
                        <div className="photo-area">
                            {doc.photo ? (
                                <img src={doc.photo} alt={doc.name} className="photo-img" />
                            ) : (
                                <div className="photo-placeholder">Drop zone</div>
                            )}
                            <span className="order-badge">#{doc.order}</span>
                            {doc.hidden && <span className="hidden-badge">Hidden</span>}
                        </div>
                        <div className="card-body">
                            <div className="card-text">
                                <h3><button type="button" className="staff-row-name" onClick={() => openEdit(doc)}>{doc.name}</button></h3>
                                <p className="doc-title">{doc.title}</p>
                            </div>
                            <RowMenu
                                label={`More actions for ${doc.name}`}
                                items={[
                                    { label: "Edit", icon: Pencil, onSelect: () => openEdit(doc) },
                                    { label: doc.hidden ? "Show on the site" : "Hide from the site", icon: doc.hidden ? Eye : EyeOff, onSelect: () => toggleHidden(doc) },
                                    { label: "Archive", icon: Archive, onSelect: () => archiveDoctor(doc) },
                                ]}
                            />
                        </div>
                    </div>
                ))}
                {doctors.length === 0 && (
                    <div className="empty-state">Nothing here yet.</div>
                )}
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                        <h2>{editing ? "Edit Doctor" : "Add Doctor"}</h2>

                        <div className="modal-top-row">
                            <div className="photo-drop" onClick={() => fileInputRef.current?.click()}>
                                {photoPreview ? (
                                    <img src={photoPreview} alt="Preview" className="photo-preview-img" />
                                ) : (
                                    <span className="drop-hint">Photo</span>
                                )}
                            </div>
                            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoChange} />
                            <div className="modal-top-fields">
                                <div className="field">
                                    <label>Name *</label>
                                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                                </div>
                                <div className="field">
                                    <label>Title *</label>
                                    <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Physiotherapist" />
                                </div>
                            </div>
                        </div>

                        <div className="field">
                            <label>Specialty</label>
                            <input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} placeholder="Manual Therapy & Sports Rehab" />
                        </div>
                        <div className="field">
                            <label>Bio</label>
                            <textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
                        </div>
                        <div className="field-row">
                            <div className="field">
                                <label>Contact</label>
                                <input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
                            </div>
                            <div className="field">
                                <label>Order</label>
                                <input type="number" min={1} value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} />
                            </div>
                        </div>

                        <div className="field">
                            <label>Linked login account</label>
                            <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}>
                                <option value="">— None (staff-managed only) —</option>
                                {accounts.map((a) => (
                                    <option key={a.id} value={a.id}>{a.name}</option>
                                ))}
                            </select>
                            <span className="field-hint">Lets this doctor submit self-edits from their own dashboard, subject to approval.</span>
                        </div>

                        <div className="modal-actions">
                            <button className="staff-btn staff-btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                            <button className="staff-btn staff-btn-primary" aria-busy={saving} onClick={handleSave} disabled={saving || !form.name || !form.title}>
                                {saving ? "Saving…" : "Save"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {toast && <div className="toast">✓ {toast}</div>}

            <style jsx>{`
                .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1.5rem; gap: 1rem; flex-wrap: wrap; }
                .page-header h1 { font-size: 1.5rem; font-weight: 600; margin: 0 0 0.25rem; }
                .subtitle { color: rgba(255,255,255,0.4); font-size: 0.85rem; margin: 0; }

                .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1.25rem; }
                .empty-state { grid-column: 1 / -1; text-align: center; color: rgba(255,255,255,0.35); padding: 3rem; }

                .cms-doctor-card {
                    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
                    border-radius: 12px; cursor: grab; transition: opacity 0.15s, border-color 0.15s;
                }
                .cms-doctor-card:active { cursor: grabbing; }
                .cms-doctor-card.drag-over { border-color: var(--primary, #4CAF93); }
                .cms-doctor-card.is-hidden { opacity: 0.6; }

                /* overflow:hidden lives on this inner wrapper, not .cms-doctor-card itself —
                   putting it on the grid item makes the browser mis-size the row and
                   clip the action buttons below (CSS Grid + overflow interaction). */
                .photo-area { position: relative; aspect-ratio: 1; background: rgba(255,255,255,0.04); overflow: hidden; border-radius: 12px 12px 0 0; }
                .photo-img { width: 100%; height: 100%; object-fit: cover; }
                .photo-placeholder {
                    width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
                    color: rgba(255,255,255,0.2); font-size: 0.8rem; border: 2px dashed rgba(255,255,255,0.08);
                    box-sizing: border-box;
                }
                .order-badge {
                    position: absolute; top: 0.5rem; left: 0.5rem; background: rgba(10,18,22,0.75);
                    color: #fff; border-radius: 5px; padding: 0.15rem 0.4rem; font-size: 0.7rem; font-weight: 700;
                }
                .hidden-badge {
                    position: absolute; top: 0.5rem; right: 0.5rem; background: rgba(245,158,11,0.9);
                    color: #3a2606; border-radius: 5px; padding: 0.15rem 0.4rem; font-size: 0.7rem; font-weight: 700;
                }

                .card-body { padding: 0.9rem 1rem; display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem; }
                .card-text { min-width: 0; }
                .card-body h3 .staff-row-name { font-weight: 700; }
                .card-body h3 { font-size: 0.98rem; font-weight: 700; margin: 0 0 0.15rem; }
                .doc-title { font-size: 0.8rem; color: #6ec4ab; margin: 0; }

                .modal-overlay {
                    position: fixed; inset: 0; background: rgba(0,0,0,0.6);
                    display: flex; align-items: center; justify-content: center;
                    z-index: 1000; backdrop-filter: blur(4px);
                }
                .modal-card {
                    background: #243b44; border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 14px; padding: 1.75rem; width: 100%; max-width: 520px;
                    max-height: 90vh; overflow-y: auto;
                }
                .modal-card h2 { font-size: 1.2rem; margin: 0 0 1.25rem; font-weight: 600; }
                .modal-top-row { display: flex; gap: 1rem; margin-bottom: 1rem; align-items: flex-start; }
                .photo-drop {
                    width: 100px; height: 100px; border-radius: 10px; border: 2px dashed rgba(255,255,255,0.12);
                    display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;
                    background: rgba(255,255,255,0.03); overflow: hidden;
                }
                .photo-drop:hover { border-color: var(--primary, #4CAF93); }
                .drop-hint { color: rgba(255,255,255,0.3); font-size: 0.78rem; }
                .photo-preview-img { width: 100%; height: 100%; object-fit: cover; }
                .modal-top-fields { flex: 1; display: flex; flex-direction: column; gap: 0.75rem; }

                .field { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 0.9rem; }
                .field label { font-size: 0.78rem; color: rgba(255,255,255,0.55); font-weight: 500; }
                .field input, .field textarea, .field select {
                    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 8px; padding: 0.65rem 0.85rem; color: #fff; font-size: 0.9rem;
                    outline: none; font-family: inherit; resize: vertical;
                }
                .field input:focus, .field textarea:focus, .field select:focus { border-color: var(--primary, #4CAF93); }
                .field select option { background: #243b44; }
                .field-hint { font-size: 0.74rem; color: rgba(255,255,255,0.35); }
                .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

                .modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 0.5rem; }

                .toast {
                    position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 1300;
                    background: #06281f; color: #10b981; border-radius: 8px; padding: 0.8rem 1.2rem;
                    font-size: 0.88rem; font-weight: 600; box-shadow: 0 12px 32px rgba(16,185,129,0.35);
                }

                @media (max-width: 560px) {
                    .modal-overlay { padding: 1rem; }
                    .modal-card { padding: 1.25rem; }
                    .modal-top-row { flex-direction: column; align-items: center; text-align: center; }
                    .modal-top-fields { width: 100%; }
                    .field-row { grid-template-columns: 1fr; }
                    .toast { left: 1rem; right: 1rem; bottom: 1rem; }
                }
            `}</style>
        </div>
    );
}
