"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { parseWorkingHours, formatWorkingHours, isLegacyWorkingHours } from "@/lib/workingHours";

export default function NewSecretaryPage() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [form, setForm] = useState({
        name: "", email: "", phone: "", workingHours: "",
        username: "", password: "", confirmPassword: "",
    });
    const [pictureFile, setPictureFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [hoursFrom, setHoursFrom] = useState("");
    const [hoursTo, setHoursTo] = useState("");

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
        if (!form.name.trim()) { setError("Name is required"); return; }
        if (!form.username.trim()) { setError("Username is required"); return; }
        if (!form.password.trim()) { setError("Password is required"); return; }
        if (form.password.length < 8) { setError("Password must be at least 8 characters"); return; }
        if (form.password !== form.confirmPassword) { setError("Passwords do not match"); return; }
        setSaving(true);

        let pictureUrl: string | null = null;
        if (pictureFile) {
            const fd = new FormData();
            fd.append("file", pictureFile);
            const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
            if (uploadRes.ok) {
                const data = await uploadRes.json();
                pictureUrl = data.url;
            }
        }

        const res = await fetch("/api/employees/secretaries", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: form.name, email: form.email, phone: form.phone,
                workingHours: form.workingHours, username: form.username,
                password: form.password, pictureUrl,
            }),
        });
        const data = await res.json();
        if (!res.ok) {
            setError(data.error || "Failed to create secretary");
            setSaving(false);
            return;
        }
        router.push("/admin/employees/secretaries");
    };

    return (
        <div className="page">
            <button className="back-btn" onClick={() => router.push("/admin/employees/secretaries")}>← Back to Secretaries</button>
            <h1>New Secretary</h1>
            <p className="subtitle">Create a new secretary account with login credentials.</p>

            {error && <div className="staff-form-error" role="alert">{error}</div>}

            <div className="form-layout">
                {/* Left: Avatar */}
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
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePictureChange} style={{ display: "none" }} />
                        <button className="upload-btn" onClick={() => fileInputRef.current?.click()}>
                            {previewUrl ? "Change Photo" : "Upload Photo"}
                        </button>
                        {previewUrl && <button className="remove-btn" onClick={removePicture}>Remove</button>}
                        <p className="upload-hint">JPG, PNG or WebP. Max 5MB.</p>
                    </div>
                </div>

                {/* Right: Form fields */}
                <div className="fields-column">
                    <div className="staff-form-card">
                        <h2 className="staff-form-card-title">Personal Information</h2>
                        <div className="staff-field">
                            <label htmlFor="name">Full Name <span className="staff-field-req">*</span></label>
                            <input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name..." autoFocus />
                        </div>
                        <div className="staff-field-row">
                            <div className="staff-field">
                                <label htmlFor="phone">Phone</label>
                                <input id="phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0791234567" />
                            </div>
                            <div className="staff-field">
                                <label htmlFor="email">Email</label>
                                <input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@clinic.com" />
                            </div>
                        </div>
                        <div className="staff-field">
                            <label htmlFor="hours">Working Hours</label>
                            <div className="hours-row">
                                <input
                                    id="hours"
                                    type="time"
                                    aria-label="Start time"
                                    value={hoursFrom}
                                    onChange={(e) => {
                                        setHoursFrom(e.target.value);
                                        setForm({ ...form, workingHours: formatWorkingHours(e.target.value, hoursTo) });
                                    }}
                                />
                                <span className="hours-sep">to</span>
                                <input
                                    type="time"
                                    aria-label="End time"
                                    value={hoursTo}
                                    onChange={(e) => {
                                        setHoursTo(e.target.value);
                                        setForm({ ...form, workingHours: formatWorkingHours(hoursFrom, e.target.value) });
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="staff-form-card">
                        <h2 className="staff-form-card-title">Login Credentials</h2>
                        <div className="staff-field-row">
                            <div className="staff-field">
                                <label htmlFor="username">Username <span className="staff-field-req">*</span></label>
                                <input id="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="sec.name" />
                            </div>
                            <div className="staff-field">
                                <label htmlFor="password">Password <span className="staff-field-req">*</span></label>
                                <div className="password-wrap">
                                    <input id="password" type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
                                    <button
                                        type="button"
                                        className="toggle-password"
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? (
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.4 0 10 7 10 7a17.6 17.6 0 0 1-2.2 3.15M6.6 6.6A17.7 17.7 0 0 0 2 11s3.6 7 10 7a9 9 0 0 0 4.4-1.1" />
                                                <path d="m2 2 20 20" />
                                                <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                                            </svg>
                                        ) : (
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
                                                <circle cx="12" cy="12" r="3" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                                <span className="staff-field-hint">At least 8 characters.</span>
                            </div>
                        </div>
                        <div className="staff-field">
                            <label htmlFor="confirmPassword">Repeat Password <span className="staff-field-req">*</span></label>
                            <input id="confirmPassword" type={showPassword ? "text" : "password"} value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} placeholder="••••••••" />
                        </div>
                    </div>

                    <div className="staff-form-actions">
                        <button className="staff-btn staff-btn-secondary" onClick={() => router.push("/admin/employees/secretaries")}>Cancel</button>
                        <button className="staff-btn staff-btn-primary" aria-busy={saving} onClick={handleSubmit} disabled={saving}>
                            {saving ? "Creating…" : "Create Secretary"}
                        </button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .page { max-width: 860px; }
                .back-btn { background: none; border: none; color: rgba(255,255,255,0.45); font-size: var(--staff-size-base); cursor: pointer; padding: 0; margin-bottom: 1rem; font-family: inherit; }
                .back-btn:hover { color: #fff; }
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
                    font-weight: 600; cursor: pointer; font-family: inherit;
                }
                .upload-btn:hover { background: rgba(76,175,147,0.22); }
                .remove-btn { background: none; border: none; color: rgba(220,100,100,0.7); font-size: var(--staff-size-sm); cursor: pointer; font-family: inherit; }
                .remove-btn:hover { color: #fca5a5; }
                .upload-hint { color: rgba(255,255,255,0.25); font-size: var(--staff-size-xs); text-align: center; margin: 0; }

                .fields-column { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1rem; }
                .hours-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
                /* A time input needs about 125px to show "09:00 AM" and its clock
                   icon (measured). 9.5rem leaves room for that; below it the row
                   wraps rather than clipping the time. (TJ-020) */
                .hours-row input { flex: 1 1 9.5rem; min-width: 0; }
                .hours-sep { font-size: var(--staff-size-sm); color: rgba(255,255,255,0.4); flex-shrink: 0; }
                .password-wrap { position: relative; }
                .password-wrap input { width: 100%; padding-inline-end: 2.4rem; }
                .toggle-password {
                  position: absolute; inset-inline-end: 0.5rem; top: 50%; transform: translateY(-50%);
                  background: none; border: none; padding: 0.15rem; line-height: 0;
                  color: rgba(255,255,255,0.45); cursor: pointer;
                }
                .toggle-password:hover { color: #fff; }

                @media (max-width: 640px) {
                    .form-layout { flex-direction: column; align-items: stretch; }
                    .avatar-column { width: 100%; }
                    .avatar-card { flex-direction: row; flex-wrap: wrap; gap: 1rem; padding: 1rem; }
                    .avatar-circle { width: 80px; height: 80px; flex-shrink: 0; }
                }
            `}</style>
        </div>
    );
}
