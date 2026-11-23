"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function SecretaryNewPatientPage() {
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
        router.push(`/secretary/patients/${data.id}`);
    };

    return (
        <div className="page">
            <button className="staff-back" onClick={() => router.push("/secretary/patients")}>← Back to Patients</button>
            <h1>New Patient</h1>
            <p className="subtitle">Fill in the patient&apos;s details to create their profile.</p>

            {error && <div className="staff-form-error" role="alert">{error}</div>}

            <div className="form-layout">
                {/* Left: Avatar area */}
                <div className="avatar-column">
                    <div className="staff-form-card avatar-card">
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
                    <div className="staff-form-card">
                        <h2 className="staff-form-card-title">Patient Information</h2>
                        <div className="staff-field">
                            <label htmlFor="name">Full Name <span className="staff-field-req">*</span></label>
                            <input
                                id="name"
                                type="text"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="Enter patient's full name"
                                autoFocus
                            />
                        </div>
                        <div className="staff-field-row">
                            <div className="staff-field">
                                <label htmlFor="phone1">Phone 1 <span className="staff-field-req">*</span></label>
                                <input
                                    id="phone1"
                                    type="tel"
                                    value={form.phone1}
                                    onChange={(e) => setForm({ ...form, phone1: e.target.value })}
                                    placeholder="e.g. 0791234567"
                                />
                            </div>
                            <div className="staff-field">
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
                    <div className="staff-form-actions">
                        <button className="staff-btn staff-btn-secondary" onClick={() => router.push("/secretary/patients")}>Cancel</button>
                        <button className="staff-btn staff-btn-primary" aria-busy={saving} onClick={handleSubmit} disabled={saving}>
                            {saving ? "Creating…" : "Create Patient"}
                        </button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .page { max-width: 820px; }
                h1 { font-size: var(--staff-size-xl); font-weight: 700; margin: 0 0 0.25rem; }
                .subtitle { color: rgba(255,255,255,0.4); font-size: var(--staff-size-base); margin-bottom: 1.5rem; }

                .page > .staff-form-error { margin-bottom: 1.25rem; }

                .form-layout { display: flex; gap: 1.5rem; align-items: flex-start; }

                .avatar-column { width: 220px; flex-shrink: 0; }
                .avatar-card { align-items: center; gap: 0.75rem; }
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
                    padding: 0.4rem 0.9rem; border-radius: var(--radius-sm, 2px); font-size: var(--staff-size-sm);
                    font-weight: 600; cursor: pointer; font-family: inherit; transition: background 0.15s;
                }
                .upload-btn:hover { background: rgba(76,175,147,0.22); }
                .remove-btn {
                    background: none; border: none; color: rgba(220,100,100,0.7); font-size: var(--staff-size-sm);
                    cursor: pointer; font-family: inherit;
                }
                .remove-btn:hover { color: #fca5a5; }
                .upload-hint { color: rgba(255,255,255,0.25); font-size: var(--staff-size-xs); text-align: center; margin: 0; }

                .fields-column { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1rem; }

                @media (max-width: 640px) {
                    .form-layout { flex-direction: column; align-items: stretch; }
                    .avatar-column { width: 100%; }
                    .avatar-card { flex-direction: row; gap: 1rem; padding: 1rem; }
                    .avatar-circle { width: 80px; height: 80px; flex-shrink: 0; }
                }
            `}</style>
        </div>
    );
}
