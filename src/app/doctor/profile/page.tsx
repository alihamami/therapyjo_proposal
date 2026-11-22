"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface DoctorProfile {
    id: string;
    name: string;
    title: string;
    specialty: string;
    bio: string | null;
    contact: string | null;
    photo: string | null;
    pendingChanges: { id: string; field: string; newValue: string; submittedAt: string }[];
}

export default function DoctorProfilePage() {
    const [profile, setProfile] = useState<DoctorProfile | null>(null);
    const [notLinked, setNotLinked] = useState(false);
    const [form, setForm] = useState({ name: "", title: "", specialty: "", bio: "", contact: "" });
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchProfile = useCallback(async () => {
        const res = await fetch("/api/doctor-profiles/me");
        if (!res.ok) { setNotLinked(true); return; }
        const data = await res.json();
        setProfile(data);
        setForm({
            name: data.name, title: data.title, specialty: data.specialty,
            bio: data.bio || "", contact: data.contact || "",
        });
        setPhotoPreview(data.photo);
    }, []);

    useEffect(() => { fetchProfile(); }, [fetchProfile]);

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPhotoFile(file);
        const reader = new FileReader();
        reader.onload = () => setPhotoPreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    const handleSubmit = async () => {
        if (!profile) return;
        setMessage("");
        setSaving(true);

        const changes: Record<string, string> = {};
        if (form.name !== profile.name) changes.NAME = form.name;
        if (form.title !== profile.title) changes.TITLE = form.title;
        if (form.specialty !== profile.specialty) changes.SPECIALTY = form.specialty;
        if (form.bio !== (profile.bio || "")) changes.BIO = form.bio;
        if (form.contact !== (profile.contact || "")) changes.CONTACT = form.contact;

        if (photoFile) {
            const fd = new FormData();
            fd.append("file", photoFile);
            fd.append("folder", "doctor-profiles");
            const up = await fetch("/api/upload", { method: "POST", body: fd });
            if (up.ok) {
                const data = await up.json();
                changes.PHOTO = data.url;
            }
        }

        if (Object.keys(changes).length === 0) {
            setSaving(false);
            setMessage("No changes to submit.");
            return;
        }

        const res = await fetch("/api/pending-changes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ changes }),
        });

        setSaving(false);
        if (res.ok) {
            setMessage("Submitted for approval. Changes go live once reviewed.");
            setPhotoFile(null);
            fetchProfile();
        } else {
            const data = await res.json();
            setMessage(data.error || "Failed to submit changes");
        }
    };

    if (notLinked) {
        return (
            <div className="page">
                <h1>My Public Profile</h1>
                <p className="empty-note">Your account isn&apos;t linked to a public doctor profile yet. Ask an admin to link it from the Doctors CMS.</p>
                <style jsx>{`
                    .page { max-width: 640px; }
                    h1 { font-size: var(--staff-size-xl); font-weight: 600; margin: 0 0 1rem; }
                    .empty-note { color: rgba(255,255,255,0.5); font-size: var(--staff-size-base); }
                `}</style>
            </div>
        );
    }

    if (!profile) {
        return <div style={{ color: "rgba(255,255,255,0.5)", padding: "2rem" }}>Loading…</div>;
    }

    return (
        <div className="page">
            <h1>My Public Profile</h1>
            <p className="subtitle">Changes require approval before they appear on the public site.</p>

            {profile.pendingChanges.length > 0 && (
                <div className="pending-banner">
                    {profile.pendingChanges.length} change{profile.pendingChanges.length > 1 ? "s" : ""} awaiting review.
                </div>
            )}

            {message && <div className="message">{message}</div>}

            <div className="form-layout">
                <div className="photo-col">
                    <div className="photo-drop" onClick={() => fileInputRef.current?.click()}>
                        {photoPreview ? <img src={photoPreview} alt="Preview" className="photo-img" /> : <span>Upload photo</span>}
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoChange} />
                </div>
                <div className="fields-col">
                    <div className="field">
                        <label>Name</label>
                        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div className="field">
                        <label>Title</label>
                        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                    </div>
                    <div className="field">
                        <label>Specialty</label>
                        <input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} />
                    </div>
                    <div className="field">
                        <label>Bio</label>
                        <textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
                    </div>
                    <div className="field">
                        <label>Contact</label>
                        <input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
                    </div>
                    <button className="staff-btn staff-btn-primary" aria-busy={saving} onClick={handleSubmit} disabled={saving}>
                        {saving ? "Submitting…" : "Submit for Approval"}
                    </button>
                </div>
            </div>

            <style jsx>{`
                .page { max-width: 720px; }
                h1 { font-size: var(--staff-size-xl); font-weight: 600; margin: 0 0 0.25rem; }
                .subtitle { color: rgba(255,255,255,0.4); font-size: var(--staff-size-base); margin: 0 0 1.25rem; }
                .pending-banner {
                    background: rgba(96,165,250,0.1); border: 1px solid rgba(96,165,250,0.25); color: #93c5fd;
                    padding: 0.6rem 0.9rem; border-radius: 8px; font-size: var(--staff-size-base); margin-bottom: 1rem;
                }
                .message {
                    background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.25); color: #6ee7b7;
                    padding: 0.6rem 0.9rem; border-radius: 8px; font-size: var(--staff-size-base); margin-bottom: 1rem;
                }
                .form-layout { display: flex; gap: 1.5rem; align-items: flex-start; }
                .photo-col { width: 140px; flex-shrink: 0; }
                .photo-drop {
                    width: 140px; height: 140px; border-radius: 50%; border: 2px dashed rgba(255,255,255,0.15);
                    display: flex; align-items: center; justify-content: center; cursor: pointer;
                    color: rgba(255,255,255,0.3); font-size: var(--staff-size-sm); overflow: hidden; text-align: center;
                }
                .photo-img { width: 100%; height: 100%; object-fit: cover; }
                .fields-col { flex: 1; display: flex; flex-direction: column; gap: 0.9rem; min-width: 0; }
                .field { display: flex; flex-direction: column; gap: 0.3rem; }
                .field label { font-size: var(--staff-size-sm); color: rgba(255,255,255,0.55); font-weight: 500; }
                .field input, .field textarea {
                    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 8px; padding: 0.6rem 0.8rem; color: #fff; font-size: var(--staff-size-base);
                    outline: none; font-family: inherit; resize: vertical;
                }
                .field input:focus, .field textarea:focus { border-color: var(--primary, #4CAF93); }
                .staff-btn { align-self: flex-start; }

                @media (max-width: 560px) {
                    .form-layout { flex-direction: column; align-items: center; }
                }
            `}</style>
        </div>
    );
}
