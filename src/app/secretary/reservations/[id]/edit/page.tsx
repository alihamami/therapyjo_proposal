"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { isMissingPhone } from "@/lib/phone";

interface Doctor { id: string; name: string; color: string | null; }

export default function SecretaryEditReservationPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();

    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [form, setForm] = useState({
        doctorId: "",
        sessionDate: "",
        sessionTime: "",
        note: "",
        showNoteOnCalendar: false,
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
        router.push("/secretary");
    };

    const formatDate = () =>
        new Date(form.sessionDate + "T12:00:00").toLocaleDateString("en-US", {
            weekday: "long", month: "long", day: "numeric", year: "numeric",
        });

    if (loading) {
        return (
            <div className="page">
                <p className="staff-loading" role="status">Loading…</p>
            </div>
        );
    }

    return (
        <div className="page">
            <button className="staff-back" onClick={() => router.push("/secretary")}>← Back to Dashboard</button>
            <h1>Edit Reservation</h1>
            <p className="subtitle">{formatDate()}</p>

            {error && <div className="staff-form-error" role="alert">{error}</div>}

            <div className="form-layout">
                {/* Left: Patient + Schedule */}
                <div className="main-column">
                    <div className="staff-form-card">
                        <h2 className="staff-form-card-title">Patient</h2>
                        <div className="patient-readonly">
                            <span className="pr-name">{patientName || "—"}</span>
                            <span className="pr-phone">{isMissingPhone(patientPhone) ? "No phone" : patientPhone}</span>
                        </div>
                        {patientId !== null && (
                            <button className="pr-link" onClick={() => router.push(`/secretary/patients/${patientId}`)}>
                                Open patient file →
                            </button>
                        )}
                    </div>

                    <div className="staff-form-card">
                        <h2 className="staff-form-card-title">Schedule</h2>
                        <div className="staff-field-row">
                            <div className="staff-field">
                                <label htmlFor="res-date">Date</label>
                                <input id="res-date" type="date" value={form.sessionDate} onChange={(e) => setForm({ ...form, sessionDate: e.target.value })} />
                            </div>
                            <div className="staff-field">
                                <label htmlFor="res-time">Time</label>
                                <input id="res-time" type="time" min="07:00" max="18:00" value={form.sessionTime} onChange={(e) => setForm({ ...form, sessionTime: e.target.value })} />
                            </div>
                        </div>
                        <div className="staff-field-row">
                            <div className="staff-field">
                                <label htmlFor="res-doctor">Doctor <span className="staff-field-req">*</span></label>
                                <select id="res-doctor" value={form.doctorId} onChange={(e) => setForm({ ...form, doctorId: e.target.value })}>
                                    {doctors.map((d) => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="staff-field">
                                <label htmlFor="res-payment">Payment</label>
                                <select id="res-payment" value={form.paymentType} onChange={(e) => setForm({ ...form, paymentType: e.target.value })}>
                                    <option value="">— None —</option>
                                    <option value="CASH">Cash</option>
                                    <option value="INSURANCE">Insurance</option>
                                </select>
                            </div>
                        </div>
                        <label className="staff-check">
                            <input type="checkbox" checked={form.isTwoHours} onChange={(e) => setForm({ ...form, isTwoHours: e.target.checked })} />
                            2-hour session
                        </label>
                    </div>
                </div>

                {/* Right: Notes */}
                <div className="side-column">
                    <div className="staff-form-card">
                        <h2 className="staff-form-card-title">Notes</h2>
                        <div className="note-group">
                            <div className="staff-field">
                                <label htmlFor="res-note">Session Note</label>
                                <textarea id="res-note" rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Optional note for this session…" />
                            </div>
                            <label className="staff-check">
                                <input type="checkbox" checked={form.showNoteOnCalendar} onChange={(e) => setForm({ ...form, showNoteOnCalendar: e.target.checked })} />
                                Show on calendar
                            </label>
                        </div>
                    </div>

                    <div className="staff-form-actions">
                        <button className="staff-btn staff-btn-secondary" onClick={() => router.push("/secretary")}>Cancel</button>
                        <button className="staff-btn staff-btn-primary" aria-busy={saving} onClick={handleSubmit} disabled={saving}>
                            {saving ? "Saving…" : "Save Changes"}
                        </button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .page { max-width: 900px; }
                h1 { font-size: var(--staff-size-xl); font-weight: 700; margin: 0 0 0.25rem; }
                .subtitle { color: rgba(255,255,255,0.4); font-size: var(--staff-size-base); margin-bottom: 1.5rem; }
                .page > .staff-form-error { margin-bottom: 1.25rem; }
                .form-layout { display: flex; gap: 1.5rem; align-items: flex-start; }
                .main-column { flex: 1.2; min-width: 0; display: flex; flex-direction: column; gap: 1rem; }
                .side-column { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1rem; }
                .note-group { display: flex; flex-direction: column; gap: 0.5rem; }
                .patient-readonly { display: flex; align-items: baseline; gap: 0.6rem; }
                .pr-name { font-size: var(--staff-size-md); font-weight: 600; color: #fff; }
                .pr-phone { font-size: var(--staff-size-base); color: rgba(255,255,255,0.45); }
                .pr-link {
                    align-self: flex-start; background: none; border: none; padding: 0;
                    color: var(--primary, #4CAF93); font-size: var(--staff-size-base); cursor: pointer;
                    font-family: inherit;
                }
                .pr-link:hover { text-decoration: underline; }
                @media (max-width: 640px) { .form-layout { flex-direction: column; align-items: stretch; } }
            `}</style>
        </div>
    );
}
