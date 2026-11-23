"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Doctor { id: string; name: string; color: string | null; }

export default function SecretaryNewNotePage() {
    const router = useRouter();

    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [form, setForm] = useState({
        name: "",
        noteDate: new Date().toISOString().split("T")[0],
        doctorId: "",
        details: "",
    });
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    const fetchDoctors = useCallback(async () => {
        const res = await fetch("/api/employees/doctors");
        const data = await res.json();
        const active = data.filter((d: Doctor & { status: string }) => d.status === "ACTIVE");
        setDoctors(active);
        if (active.length > 0 && !form.doctorId) setForm((f) => ({ ...f, doctorId: active[0].id }));
    }, []);

    useEffect(() => { fetchDoctors(); }, [fetchDoctors]);

    const handleSubmit = async () => {
        setError("");
        if (!form.name.trim()) { setError("Note title is required"); return; }
        if (!form.doctorId) { setError("Please select a doctor"); return; }
        setSaving(true);

        const res = await fetch("/api/notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) {
            setError(data.error || "Failed to create note");
            setSaving(false);
            return;
        }
        router.push("/secretary/notes");
    };

    return (
        <div className="page">
            <button className="back-btn" onClick={() => router.push("/secretary/notes")}>← Back to Notes</button>
            <h1>New Note</h1>
            <p className="subtitle">Create a clinical or administrative note.</p>

            {error && <div className="staff-form-error" role="alert">{error}</div>}

            <div className="form-layout">
                <div className="main-column">
                    <div className="staff-form-card">
                        <h2 className="staff-form-card-title">Note Details</h2>
                        <div className="staff-field">
                            <label htmlFor="name">Title <span className="staff-field-req">*</span></label>
                            <input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Patient follow-up…" autoFocus />
                        </div>
                        <div className="staff-field">
                            <label htmlFor="details">Details</label>
                            <textarea id="details" rows={6} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} placeholder="Write the note details here…" />
                        </div>
                    </div>
                </div>

                <div className="side-column">
                    <div className="staff-form-card">
                        <h2 className="staff-form-card-title">Metadata</h2>
                        <div className="staff-field">
                            <label htmlFor="date">Date</label>
                            <input id="date" type="date" value={form.noteDate} onChange={(e) => setForm({ ...form, noteDate: e.target.value })} />
                        </div>
                        <div className="staff-field">
                            <label htmlFor="doctor">Doctor <span className="staff-field-req">*</span></label>
                            <select id="doctor" value={form.doctorId} onChange={(e) => setForm({ ...form, doctorId: e.target.value })}>
                                {doctors.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
                            </select>
                        </div>
                    </div>

                    <div className="staff-form-actions">
                        <button className="staff-btn staff-btn-secondary" onClick={() => router.push("/secretary/notes")}>Cancel</button>
                        <button className="staff-btn staff-btn-primary" aria-busy={saving} onClick={handleSubmit} disabled={saving}>{saving ? "Creating…" : "Create Note"}</button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .page { max-width: 820px; }
                .back-btn { background: none; border: none; color: rgba(255,255,255,0.45); font-size: var(--staff-size-base); cursor: pointer; padding: 0; margin-bottom: 1rem; font-family: inherit; }
                .back-btn:hover { color: #fff; }
                h1 { font-size: var(--staff-size-xl); font-weight: 700; margin: 0 0 0.25rem; }
                .subtitle { color: rgba(255,255,255,0.4); font-size: var(--staff-size-base); margin-bottom: 1.5rem; }
                .page > .staff-form-error { margin-bottom: 1.25rem; }
                .form-layout { display: flex; gap: 1.5rem; align-items: flex-start; }
                .main-column { flex: 1.4; min-width: 0; }
                .side-column { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1rem; }
                @media (max-width: 640px) { .form-layout { flex-direction: column; align-items: stretch; } }
            `}</style>
        </div>
    );
}
