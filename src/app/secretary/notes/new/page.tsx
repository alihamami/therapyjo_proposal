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

            {error && <div className="error-banner">{error}</div>}

            <div className="form-layout">
                <div className="main-column">
                    <div className="card">
                        <h2>Note Details</h2>
                        <div className="field">
                            <label htmlFor="name">Title <span className="req">*</span></label>
                            <input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Patient follow-up…" autoFocus />
                        </div>
                        <div className="field">
                            <label htmlFor="details">Details</label>
                            <textarea id="details" rows={6} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} placeholder="Write the note details here…" />
                        </div>
                    </div>
                </div>

                <div className="side-column">
                    <div className="card">
                        <h2>Metadata</h2>
                        <div className="field">
                            <label htmlFor="date">Date</label>
                            <input id="date" type="date" value={form.noteDate} onChange={(e) => setForm({ ...form, noteDate: e.target.value })} />
                        </div>
                        <div className="field">
                            <label htmlFor="doctor">Doctor <span className="req">*</span></label>
                            <select id="doctor" value={form.doctorId} onChange={(e) => setForm({ ...form, doctorId: e.target.value })}>
                                {doctors.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
                            </select>
                        </div>
                    </div>

                    <div className="form-actions">
                        <button className="staff-btn staff-btn-secondary" onClick={() => router.push("/secretary/notes")}>Cancel</button>
                        <button className="staff-btn staff-btn-primary" aria-busy={saving} onClick={handleSubmit} disabled={saving}>{saving ? "Creating…" : "Create Note"}</button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .page { max-width: 820px; }
                .back-btn { background: none; border: none; color: rgba(255,255,255,0.45); font-size: 0.85rem; cursor: pointer; padding: 0; margin-bottom: 1rem; font-family: inherit; }
                .back-btn:hover { color: #fff; }
                h1 { font-size: 1.6rem; font-weight: 700; margin: 0 0 0.25rem; }
                .subtitle { color: rgba(255,255,255,0.4); font-size: 0.9rem; margin-bottom: 1.5rem; }
                .error-banner { background: rgba(220,38,38,0.1); border: 1px solid rgba(220,38,38,0.25); color: #fca5a5; padding: 0.65rem 1rem; border-radius: var(--radius-sm, 2px); font-size: 0.85rem; margin-bottom: 1.25rem; }
                .form-layout { display: flex; gap: 1.5rem; align-items: flex-start; }
                .main-column { flex: 1.4; min-width: 0; }
                .side-column { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1rem; }
                .card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: var(--radius-md, 4px); padding: 1.5rem; }
                .card h2 { font-size: 1rem; font-weight: 600; margin: 0 0 1.25rem; color: rgba(255,255,255,0.85); }
                .field { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 1rem; }
                .field:last-child { margin-bottom: 0; }
                .field label { font-size: 0.78rem; color: rgba(255,255,255,0.55); font-weight: 500; }
                .req { color: var(--primary, #4CAF93); }
                .field input, .field textarea, .field select { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius-sm, 2px); padding: 0.65rem 0.85rem; color: #fff; font-size: 0.9rem; outline: none; font-family: inherit; transition: border-color 0.15s; }
                .field textarea { resize: vertical; }
                .field select option { background: #1a2e35; }
                .field input:focus, .field textarea:focus, .field select:focus { border-color: var(--primary, #4CAF93); }
                .field input::placeholder, .field textarea::placeholder { color: rgba(255,255,255,0.2); }
                .form-actions { display: flex; justify-content: flex-end; gap: 0.75rem; }
                @media (max-width: 640px) { .form-layout { flex-direction: column; } }
            `}</style>
        </div>
    );
}
