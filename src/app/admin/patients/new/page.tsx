"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function NewPatientPage() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [form, setForm] = useState({ name: "", phone1: "", phone2: "" });
    const [pictureFile, setPictureFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const handlePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPictureFile(file);
        const reader = new FileReader();
        reader.onload = () => setPreviewUrl(reader.result as string);
        reader.readAsDataURL(file);
    };

    const removePicture = () => {
        setPictureFile(null);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleSubmit = async () => {
        setError("");
        if (!form.name.trim()) { setError("Patient name is required"); return; }
        if (!form.phone1.trim()) { setError("Phone number is required"); return; }
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
        router.push(`/admin/patients/${data.id}`);
    };

    return (
        <div className="page">
            <button className="back-btn" onClick={() => router.push("/admin/patients")}>← Back to Patients</button>
            <h1>New Patient</h1>
            <p className="subtitle">Fill in the patient&apos;s details to create their profile.</p>

            {error && <div className="error-banner">{error}</div>}

            <div className="form-layout">
                {/* Left: Avatar area */}
                <div className="avatar-column">
                    <div className="avatar-card">
                        <div className="avatar-circle" onClick={() => fileInputRef.current?.click()}>
                            {previewUrl ? (
                                <img src={previewUrl} alt="Preview" className="avatar-img" />
                            ) : (
                                <div className="avatar-placeholder">
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                        <circle cx="12" cy="7" r="4" />
                                    </svg>
                                </div>
                            )}
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handlePictureChange}
                            style={{ display: "none" }}
                        />
                        <button className="upload-btn" onClick={() => fileInputRef.current?.click()}>
                            {previewUrl ? "Change Photo" : "Upload Photo"}
                        </button>
                        {previewUrl && (
                            <button className="remove-btn" onClick={removePicture}>Remove</button>
                        )}
                        <p className="upload-hint">JPG, PNG or WebP. Max 5MB.</p>
                    </div>
                </div>

                {/* Right: Form fields */}
                <div className="fields-column">
                    <div className="fields-card">
                        <h2>Patient Information</h2>
                        <div className="field">
                            <label htmlFor="name">Full Name <span className="req">*</span></label>
                            <input
                                id="name"
                                type="text"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="Enter patient's full name"
                                autoFocus
                            />
                        </div>
                        <div className="field-row">
                            <div className="field">
                                <label htmlFor="phone1">Phone 1 <span className="req">*</span></label>
                                <input
                                    id="phone1"
                                    type="tel"
                                    value={form.phone1}
                                    onChange={(e) => setForm({ ...form, phone1: e.target.value })}
                                    placeholder="e.g. 0791234567"
                                />
                            </div>
                            <div className="field">
                                <label htmlFor="phone2">Phone 2</label>
                                <input
                                    id="phone2"
                                    type="tel"
                                    value={form.phone2}
                                    onChange={(e) => setForm({ ...form, phone2: e.target.value })}
                                    placeholder="Optional"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="form-actions">
                        <button className="staff-btn staff-btn-secondary" onClick={() => router.push("/admin/patients")}>Cancel</button>
                        <button className="staff-btn staff-btn-primary" aria-busy={saving} onClick={handleSubmit} disabled={saving}>
                            {saving ? "Creating…" : "Create Patient"}
                        </button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .page { max-width: 820px; }
                .back-btn { background: none; border: none; color: rgba(255,255,255,0.45); font-size: 0.85rem; cursor: pointer; padding: 0; margin-bottom: 1rem; font-family: inherit; }
                .back-btn:hover { color: #fff; }
                h1 { font-size: 1.6rem; font-weight: 700; margin: 0 0 0.25rem; }
                .subtitle { color: rgba(255,255,255,0.4); font-size: 0.9rem; margin-bottom: 1.5rem; }

                .error-banner {
                    background: rgba(220,38,38,0.1); border: 1px solid rgba(220,38,38,0.25);
                    color: #fca5a5; padding: 0.65rem 1rem; border-radius: var(--radius-sm, 2px);
                    font-size: 0.85rem; margin-bottom: 1.25rem;
                }

                .form-layout { display: flex; gap: 1.5rem; align-items: flex-start; }

                /* Avatar column */
                .avatar-column { width: 220px; flex-shrink: 0; }
                .avatar-card {
                    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
                    border-radius: var(--radius-md, 4px); padding: 1.5rem;
                    display: flex; flex-direction: column; align-items: center; gap: 0.75rem;
                }
                .avatar-circle {
                    width: 140px; height: 140px; border-radius: 50%;
                    border: 2px dashed rgba(255,255,255,0.12);
                    display: flex; align-items: center; justify-content: center;
                    overflow: hidden; cursor: pointer; transition: border-color 0.2s;
                    background: rgba(255,255,255,0.03);
                }
                .avatar-circle:hover { border-color: var(--primary, #4CAF93); }
                .avatar-placeholder { color: rgba(255,255,255,0.2); }
                .avatar-img { width: 100%; height: 100%; object-fit: cover; }
                .upload-btn {
                    background: rgba(76,175,147,0.12); color: var(--primary, #4CAF93); border: none;
                    padding: 0.4rem 0.9rem; border-radius: var(--radius-sm, 2px); font-size: 0.8rem;
                    font-weight: 600; cursor: pointer; font-family: inherit; transition: background 0.15s;
                }
                .upload-btn:hover { background: rgba(76,175,147,0.22); }
                .remove-btn {
                    background: none; border: none; color: rgba(220,100,100,0.7); font-size: 0.76rem;
                    cursor: pointer; font-family: inherit;
                }
                .remove-btn:hover { color: #fca5a5; }
                .upload-hint { color: rgba(255,255,255,0.25); font-size: 0.72rem; text-align: center; margin: 0; }

                /* Fields column */
                .fields-column { flex: 1; min-width: 0; }
                .fields-card {
                    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
                    border-radius: var(--radius-md, 4px); padding: 1.5rem;
                }
                .fields-card h2 { font-size: 1rem; font-weight: 600; margin: 0 0 1.25rem; color: rgba(255,255,255,0.85); }
                .field { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 1rem; }
                .field label {
                    font-size: 0.78rem; color: rgba(255,255,255,0.55); font-weight: 500;
                }
                .req { color: var(--primary, #4CAF93); }
                .field input {
                    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
                    border-radius: var(--radius-sm, 2px); padding: 0.65rem 0.85rem; color: #fff;
                    font-size: 0.9rem; outline: none; font-family: inherit;
                    transition: border-color 0.15s;
                }
                .field input:focus { border-color: var(--primary, #4CAF93); }
                .field input::placeholder { color: rgba(255,255,255,0.2); }
                .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

                .form-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.25rem; }

                @media (max-width: 640px) {
                    .form-layout { flex-direction: column; }
                    .avatar-column { width: 100%; }
                    .avatar-card { flex-direction: row; flex-wrap: wrap; gap: 0.6rem 1rem; padding: 1rem; }
                    .avatar-circle { width: 80px; height: 80px; flex-shrink: 0; }
                    .upload-hint { flex: 1 1 100%; text-align: left; }
                    .field-row { grid-template-columns: 1fr; }
                }

                @media (max-width: 480px) {
                    .form-actions { flex-direction: column-reverse; align-items: stretch; }
                    .form-actions button { width: 100%; }
                }
            `}</style>
        </div>
    );
}
