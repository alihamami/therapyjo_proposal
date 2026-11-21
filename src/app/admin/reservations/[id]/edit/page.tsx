"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { isMissingPhone } from "@/lib/phone";

interface Doctor { id: string; name: string; color: string | null; }

export default function EditReservationPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();

    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [form, setForm] = useState({
        doctorId: "",
        sessionDate: "",
        sessionTime: "",
        note: "",
        showNoteOnCalendar: false,
        nextSessionNote: "",
        paymentType: "",
        isTwoHours: false,
    });
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [patientName, setPatientName] = useState("");
    const [patientPhone, setPatientPhone] = useState("");
    const [patientId, setPatientId] = useState<number | null>(null);

    const fetchDoctors = useCallback(async () => {
        const res = await fetch("/api/employees/doctors");
        const data = await res.json();
        const active = data.filter((d: Doctor & { status: string }) => d.status === "ACTIVE");
        setDoctors(active);
    }, []);

    useEffect(() => { fetchDoctors(); }, [fetchDoctors]);

    const fetchReservation = useCallback(async () => {
        const res = await fetch(`/api/reservations/${id}`);
        if (!res.ok) {
            setError("Could not load this reservation.");
            setLoading(false);
            return;
        }
        const r = await res.json();
        setPatientName(r.patient?.name ?? "");
        setPatientPhone(r.patient?.phone1 ?? "");
        setPatientId(r.patient?.id ?? null);
        // sessionDate was stored from a "YYYY-MM-DD" string and comes back as
        // UTC midnight, so slice the ISO string rather than formatting it —
        // toLocaleDateString would shift the day for anyone west of UTC.
        const datePart = String(r.sessionDate).split("T")[0];
        // sessionTime was stored server-local and Calendar.tsx reads it back
        // with the browser's own getHours/getMinutes, so read it the same way
        // here or this form disagrees with the card the user just clicked.
        const t = new Date(r.sessionTime);
        const timePart = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
        setForm({
            doctorId: r.doctor?.id ?? "",
            sessionDate: datePart,
            sessionTime: timePart,
            note: r.note ?? "",
            showNoteOnCalendar: Boolean(r.showNoteOnCalendar),
            nextSessionNote: r.nextSessionNote ?? "",
            paymentType: r.paymentType ?? "",
            isTwoHours: Boolean(r.isTwoHours),
        });
        setLoading(false);
    }, [id]);

    useEffect(() => { fetchReservation(); }, [fetchReservation]);

    const handleSubmit = async () => {
        setError("");
        if (!form.doctorId) { setError("Please select a doctor"); return; }
        setSaving(true);
        const res = await fetch(`/api/reservations/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                doctorId: form.doctorId,
                // Always both — PUT refuses a half-move (TJ-047a).
                sessionDate: form.sessionDate,
                sessionTime: form.sessionTime,
                note: form.note,
                showNoteOnCalendar: form.showNoteOnCalendar,
                nextSessionNote: form.nextSessionNote,
                paymentType: form.paymentType || null,
                isTwoHours: form.isTwoHours,
            }),
        });
        const data = await res.json();
        if (!res.ok) {
            setError(data.error || "Failed to save changes");
            setSaving(false);
            return;
        }
        router.push("/admin");
    };

    const formatDate = () =>
        new Date(form.sessionDate + "T12:00:00").toLocaleDateString("en-US", {
            weekday: "long", month: "long", day: "numeric", year: "numeric",
        });

    if (loading) {
        return (
            <div className="page">
                <p className="subtitle">Loading…</p>
            </div>
        );
    }

    return (
        <div className="page">
            <button className="back-btn" onClick={() => router.push("/admin")}>← Back to Dashboard</button>
            <h1>Edit Reservation</h1>
            <p className="subtitle">{formatDate()}</p>

            {error && <div className="error-banner">{error}</div>}

            <div className="form-layout">
                {/* Left: Patient + Schedule */}
                <div className="main-column">
                    <div className="card">
                        <h2>Patient</h2>
                        <div className="patient-readonly">
                            <span className="pr-name">{patientName || "—"}</span>
                            <span className="pr-phone">{isMissingPhone(patientPhone) ? "No phone" : patientPhone}</span>
                        </div>
                        {patientId !== null && (
                            <button className="pr-link" onClick={() => router.push(`/admin/patients/${patientId}`)}>
                                Open patient file →
                            </button>
                        )}
                    </div>

                    <div className="card">
                        <h2>Schedule</h2>
                        <div className="field-row">
                            <div className="field">
                                <label>Date</label>
                                <input type="date" value={form.sessionDate} onChange={(e) => setForm({ ...form, sessionDate: e.target.value })} />
                            </div>
                            <div className="field">
                                <label>Time</label>
                                <input type="time" min="07:00" max="18:00" value={form.sessionTime} onChange={(e) => setForm({ ...form, sessionTime: e.target.value })} />
                            </div>
                        </div>
                        <div className="field-row">
                            <div className="field">
                                <label>Doctor <span className="req">*</span></label>
                                <select value={form.doctorId} onChange={(e) => setForm({ ...form, doctorId: e.target.value })}>
                                    {doctors.map((d) => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="field">
                                <label>Payment</label>
                                <select value={form.paymentType} onChange={(e) => setForm({ ...form, paymentType: e.target.value })}>
                                    <option value="">— None —</option>
                                    <option value="CASH">Cash</option>
                                    <option value="INSURANCE">Insurance</option>
                                </select>
                            </div>
                        </div>
                        <div className="checkbox-field">
                            <label className="checkbox-label">
                                <input type="checkbox" checked={form.isTwoHours} onChange={(e) => setForm({ ...form, isTwoHours: e.target.checked })} />
                                2-hour session
                            </label>
                        </div>
                    </div>
                </div>

                {/* Right: Notes */}
                <div className="side-column">
                    <div className="card">
                        <h2>Notes</h2>
                        <div className="field">
                            <label>Session Note</label>
                            <textarea rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Optional note for this session…" />
                            <label className="checkbox-label">
                                <input type="checkbox" checked={form.showNoteOnCalendar} onChange={(e) => setForm({ ...form, showNoteOnCalendar: e.target.checked })} />
                                Show on calendar
                            </label>
                        </div>
                        <div className="field">
                            <label>Next Session Note</label>
                            <textarea rows={3} value={form.nextSessionNote} onChange={(e) => setForm({ ...form, nextSessionNote: e.target.value })} placeholder="Note for follow-up…" />
                        </div>
                    </div>

                    <div className="form-actions">
                        <button className="btn-cancel" onClick={() => router.push("/admin")}>Cancel</button>
                        <button className="btn-save" onClick={handleSubmit} disabled={saving}>
                            {saving ? "Saving…" : "Save Changes"}
                        </button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .page { max-width: 900px; }
                .back-btn { background: none; border: none; color: rgba(255,255,255,0.45); font-size: 0.85rem; cursor: pointer; padding: 0; margin-bottom: 1rem; font-family: inherit; }
                .back-btn:hover { color: #fff; }
                h1 { font-size: 1.6rem; font-weight: 700; margin: 0 0 0.25rem; }
                .subtitle { color: rgba(255,255,255,0.4); font-size: 0.9rem; margin-bottom: 1.5rem; }
                .error-banner { background: rgba(220,38,38,0.1); border: 1px solid rgba(220,38,38,0.25); color: #fca5a5; padding: 0.65rem 1rem; border-radius: var(--radius-sm, 2px); font-size: 0.85rem; margin-bottom: 1.25rem; }

                .form-layout { display: flex; gap: 1.5rem; align-items: flex-start; }
                .main-column { flex: 1.2; min-width: 0; display: flex; flex-direction: column; gap: 1rem; }
                .side-column { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1rem; }

                .card {
                    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
                    border-radius: var(--radius-md, 4px); padding: 1.5rem;
                }
                .card h2 { font-size: 1rem; font-weight: 600; margin: 0 0 1.25rem; color: rgba(255,255,255,0.85); }

                .patient-readonly { display: flex; align-items: baseline; gap: 0.6rem; }
                .pr-name { font-size: 0.95rem; font-weight: 600; color: #fff; }
                .pr-phone { font-size: 0.85rem; color: rgba(255,255,255,0.45); }
                .pr-link {
                    margin-top: 0.75rem; background: none; border: none; padding: 0;
                    color: var(--primary, #4CAF93); font-size: 0.82rem; cursor: pointer;
                    font-family: inherit;
                }
                .pr-link:hover { text-decoration: underline; }

                .field { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 1rem; position: relative; }
                .field:last-child { margin-bottom: 0; }
                .field label { font-size: 0.78rem; color: rgba(255,255,255,0.55); font-weight: 500; }
                .req { color: var(--primary, #4CAF93); }
                .field input, .field textarea, .field select {
                    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
                    border-radius: var(--radius-sm, 2px); padding: 0.65rem 0.85rem; color: #fff;
                    font-size: 0.9rem; outline: none; font-family: inherit; transition: border-color 0.15s;
                }
                .field textarea { resize: vertical; }
                .field select option { background: #1a2e35; }
                .field input:focus, .field textarea:focus, .field select:focus { border-color: var(--primary, #4CAF93); }
                .field input::placeholder, .field textarea::placeholder { color: rgba(255,255,255,0.2); }
                .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

                .checkbox-field { margin-top: 0.5rem; }
                .checkbox-label {
                    display: flex; align-items: center; gap: 0.4rem;
                    font-size: 0.82rem; color: rgba(255,255,255,0.6); cursor: pointer;
                }
                .checkbox-label input[type="checkbox"] { width: auto; accent-color: var(--primary, #4CAF93); }

                .form-actions { display: flex; justify-content: flex-end; gap: 0.75rem; }
                .btn-cancel {
                    background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.6);
                    border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius-sm, 2px);
                    padding: 0.55rem 1.2rem; font-size: 0.88rem; cursor: pointer; font-family: inherit;
                }
                .btn-cancel:hover { background: rgba(255,255,255,0.1); color: #fff; }
                .btn-save {
                    background: var(--primary, #4CAF93); color: #fff; border: none;
                    border-radius: var(--radius-sm, 2px); padding: 0.55rem 1.5rem; font-size: 0.88rem;
                    font-weight: 600; cursor: pointer; font-family: inherit;
                }
                .btn-save:hover { background: var(--primary-dark, #3a8f77); }
                .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }

                @media (max-width: 640px) {
                    .form-layout { flex-direction: column; }
                    .field-row { grid-template-columns: 1fr; }
                    .form-actions { flex-direction: column-reverse; }
                    .form-actions .btn-cancel, .form-actions .btn-save { width: 100%; }
                }
            `}</style>
        </div>
    );
}
