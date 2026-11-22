"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isMissingPhone } from "@/lib/phone";

interface Doctor { id: string; name: string; color: string | null; }
interface PatientResult { id: number; name: string; phone1: string; }

function SecretaryNewReservationForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const dateParam = searchParams.get("date") || new Date().toISOString().split("T")[0];
    // Only accept a well-formed HH:MM; anything else falls back to the default
    // so a hand-edited URL cannot put the form into an invalid state.
    const timeParam = /^\d{2}:\d{2}$/.test(searchParams.get("time") || "")
        ? (searchParams.get("time") as string)
        : "09:00";

    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [patientSearch, setPatientSearch] = useState("");
    const [patientResults, setPatientResults] = useState<PatientResult[]>([]);
    const [selectedPatient, setSelectedPatient] = useState<PatientResult | null>(null);
    const [form, setForm] = useState({
        doctorId: "",
        sessionDate: dateParam,
        sessionTime: timeParam,
        note: "",
        showNoteOnCalendar: false,
        paymentType: "",
        isTwoHours: false,
    });
    const [error, setError] = useState("");
    const [showNewPatient, setShowNewPatient] = useState(false);
    const [newPatient, setNewPatient] = useState({ name: "", phone1: "", phone2: "" });
    const [creatingPatient, setCreatingPatient] = useState(false);
    const [newPatientError, setNewPatientError] = useState("");
    const [duplicateMatch, setDuplicateMatch] = useState<PatientResult | null>(null);
    const [saving, setSaving] = useState(false);

    const fetchDoctors = useCallback(async () => {
        const res = await fetch("/api/employees/doctors");
        const data = await res.json();
        const active = data.filter((d: Doctor & { status: string }) => d.status === "ACTIVE");
        setDoctors(active);
        if (active.length > 0 && !form.doctorId) setForm((f) => ({ ...f, doctorId: active[0].id }));
    }, []);

    useEffect(() => { fetchDoctors(); }, [fetchDoctors]);

    useEffect(() => {
        if (patientSearch.length < 2) { setPatientResults([]); return; }
        const timer = setTimeout(async () => {
            const res = await fetch(`/api/patients?search=${encodeURIComponent(patientSearch)}&limit=5`);
            const data = await res.json();
            setPatientResults(data.patients || []);
        }, 300);
        return () => clearTimeout(timer);
    }, [patientSearch]);

    const selectPatient = (p: PatientResult) => {
        setSelectedPatient(p);
        setPatientSearch("");
        setPatientResults([]);
        setShowNewPatient(false);
    };

    const openNewPatient = () => {
        const typed = patientSearch.trim();
        const looksLikePhone = /^[0-9+][0-9\s+-]*$/.test(typed);
        setNewPatient({
            name: looksLikePhone ? "" : typed,
            phone1: looksLikePhone ? typed : "",
            phone2: "",
        });
        setNewPatientError("");
        setDuplicateMatch(null);
        setShowNewPatient(true);
    };

    const handleCreatePatient = async () => {
        setNewPatientError("");
        setDuplicateMatch(null);
        if (!newPatient.name.trim() || !newPatient.phone1.trim()) {
            setNewPatientError("Name and phone are required");
            return;
        }
        setCreatingPatient(true);
        const res = await fetch("/api/patients", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: newPatient.name.trim(),
                phone1: newPatient.phone1.trim(),
                phone2: newPatient.phone2.trim() || null,
            }),
        });
        const data = await res.json();
        setCreatingPatient(false);
        if (!res.ok) {
            setNewPatientError(data.error || "Failed to create patient");
            if (data.duplicate) {
                setDuplicateMatch({
                    id: data.duplicate.id,
                    name: data.duplicate.name,
                    phone1: newPatient.phone1.trim(),
                });
            }
            return;
        }
        selectPatient({ id: data.id, name: data.name, phone1: newPatient.phone1.trim() });
    };

    const handleSubmit = async () => {
        setError("");
        if (!selectedPatient) { setError("Please select a patient"); return; }
        if (!form.doctorId) { setError("Please select a doctor"); return; }
        setSaving(true);
        const res = await fetch("/api/reservations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                patientId: selectedPatient.id,
                doctorId: form.doctorId,
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
            setError(data.error || "Failed to create reservation");
            setSaving(false);
            return;
        }
        router.push("/secretary");
    };

    const formatDate = () =>
        new Date(form.sessionDate + "T12:00:00").toLocaleDateString("en-US", {
            weekday: "long", month: "long", day: "numeric", year: "numeric",
        });

    return (
        <div className="page">
            <button className="back-btn" onClick={() => router.push("/secretary")}>← Back to Dashboard</button>
            <h1>New Reservation</h1>
            <p className="subtitle">{formatDate()}</p>

            {error && <div className="error-banner">{error}</div>}

            <div className="form-layout">
                <div className="main-column">
                    <div className="card">
                        <h2>Patient</h2>
                        <div className="field">
                            <label>Search by name or phone <span className="req">*</span></label>
                            <input placeholder="Type to search…" value={selectedPatient ? selectedPatient.name : patientSearch} onChange={(e) => { setPatientSearch(e.target.value); setSelectedPatient(null); }} />
                            {patientResults.length > 0 && !selectedPatient && (
                                <div className="search-dropdown">
                                    {patientResults.map((p) => (
                                        <button key={p.id} className="search-item" onClick={() => selectPatient(p)}>
                                            <span className="sr-name">{p.name}</span>
                                            <span className="sr-phone">{isMissingPhone(p.phone1) ? "No phone" : p.phone1}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {selectedPatient && (
                                <div className="selected-patient">
                                    <span>✓ {selectedPatient.name}{isMissingPhone(selectedPatient.phone1) ? "" : ` — ${selectedPatient.phone1}`}</span>
                                    <button className="clear-btn" onClick={() => setSelectedPatient(null)}>Change</button>
                                </div>
                            )}
                            {!selectedPatient && (
                                <button className="new-patient-btn" onClick={openNewPatient}>
                                    + Create a new patient
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="card">
                        <h2>Schedule</h2>
                        <div className="field-row">
                            <div className="field"><label>Date</label><input type="date" value={form.sessionDate} onChange={(e) => setForm({ ...form, sessionDate: e.target.value })} /></div>
                            <div className="field"><label>Time</label><input type="time" value={form.sessionTime} onChange={(e) => setForm({ ...form, sessionTime: e.target.value })} /></div>
                        </div>
                        <div className="field-row">
                            <div className="field">
                                <label>Doctor <span className="req">*</span></label>
                                <select value={form.doctorId} onChange={(e) => setForm({ ...form, doctorId: e.target.value })}>
                                    {doctors.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
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
                            <label className="checkbox-label"><input type="checkbox" checked={form.isTwoHours} onChange={(e) => setForm({ ...form, isTwoHours: e.target.checked })} /> 2-hour session</label>
                        </div>
                    </div>
                </div>

                <div className="side-column">
                    <div className="card">
                        <h2>Notes</h2>
                        <div className="field">
                            <label>Session Note</label>
                            <textarea rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Optional note…" />
                            <label className="checkbox-label"><input type="checkbox" checked={form.showNoteOnCalendar} onChange={(e) => setForm({ ...form, showNoteOnCalendar: e.target.checked })} /> Show on calendar</label>
                        </div>
                    </div>

                    <div className="form-actions">
                        <button className="staff-btn staff-btn-secondary" onClick={() => router.push("/secretary")}>Cancel</button>
                        <button className="staff-btn staff-btn-primary" aria-busy={saving} onClick={handleSubmit} disabled={saving}>{saving ? "Creating…" : "Create Reservation"}</button>
                    </div>
                </div>
            </div>

            {showNewPatient && (
                <div className="modal-overlay" onClick={() => setShowNewPatient(false)}>
                    <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                        <h2>New Patient</h2>
                        {newPatientError && (
                            <div className="modal-error">
                                {newPatientError}
                                {duplicateMatch && (
                                    <button className="use-existing" onClick={() => selectPatient(duplicateMatch)}>
                                        Use {duplicateMatch.name} instead
                                    </button>
                                )}
                            </div>
                        )}
                        <div className="modal-stack">
                            <div className="field">
                                <label>Patient Name <span className="req">*</span></label>
                                <input
                                    value={newPatient.name}
                                    onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                                    autoFocus
                                />
                            </div>
                            <div className="field">
                                <label>Phone 1 <span className="req">*</span></label>
                                <input
                                    value={newPatient.phone1}
                                    onChange={(e) => setNewPatient({ ...newPatient, phone1: e.target.value })}
                                    placeholder="e.g. 0791234567"
                                />
                            </div>
                            <div className="field">
                                <label>Phone 2</label>
                                <input
                                    value={newPatient.phone2}
                                    onChange={(e) => setNewPatient({ ...newPatient, phone2: e.target.value })}
                                    placeholder="Optional"
                                />
                            </div>
                        </div>
                        <div className="modal-actions">
                            <button className="staff-btn staff-btn-secondary" onClick={() => setShowNewPatient(false)}>Cancel</button>
                            <button className="staff-btn staff-btn-primary" aria-busy={creatingPatient} onClick={handleCreatePatient} disabled={creatingPatient}>
                                {creatingPatient ? "Creating…" : "Create & Select"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                .card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: var(--radius-md, 4px); padding: 1.5rem; }
                .card h2 { font-size: 1rem; font-weight: 600; margin: 0 0 1.25rem; color: rgba(255,255,255,0.85); }
                .field { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 1rem; position: relative; }
                .field:last-child { margin-bottom: 0; }
                .field label { font-size: 0.78rem; color: rgba(255,255,255,0.55); font-weight: 500; }
                .req { color: var(--primary, #4CAF93); }
                .field input, .field textarea, .field select { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius-sm, 2px); padding: 0.65rem 0.85rem; color: #fff; font-size: 0.9rem; outline: none; font-family: inherit; transition: border-color 0.15s; }
                .field textarea { resize: vertical; }
                .field select option { background: #1a2e35; }
                .field input:focus, .field textarea:focus, .field select:focus { border-color: var(--primary, #4CAF93); }
                .field input::placeholder, .field textarea::placeholder { color: rgba(255,255,255,0.2); }
                .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
                .search-dropdown { position: absolute; top: 100%; left: 0; right: 0; z-index: 50; background: #1e293b; border: 1px solid rgba(255,255,255,0.12); border-radius: var(--radius-sm, 2px); overflow: hidden; margin-top: 2px; }
                .search-item { width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0.85rem; border: none; background: none; color: #fff; cursor: pointer; font-size: 0.85rem; font-family: inherit; text-align: left; }
                .search-item:hover { background: rgba(76,175,147,0.12); }
                .sr-phone { color: rgba(255,255,255,0.4); font-size: 0.8rem; }
                .selected-patient { display: flex; justify-content: space-between; align-items: center; background: rgba(76,175,147,0.08); border: 1px solid rgba(76,175,147,0.2); padding: 0.5rem 0.75rem; border-radius: var(--radius-sm, 2px); font-size: 0.85rem; color: var(--primary, #4CAF93); margin-top: 0.25rem; }
                .clear-btn { background: none; border: none; color: rgba(255,255,255,0.4); font-size: 0.78rem; cursor: pointer; font-family: inherit; }
                .clear-btn:hover { color: #fff; }
                .new-patient-btn {
                    margin-top: 0.5rem; align-self: flex-start;
                    background: none; border: 1px dashed rgba(76,175,147,0.35);
                    color: var(--primary, #4CAF93); border-radius: var(--radius-sm, 2px);
                    padding: 0.4rem 0.75rem; font-size: 0.8rem; cursor: pointer;
                    font-family: inherit; transition: all 0.15s;
                }
                .new-patient-btn:hover { background: rgba(76,175,147,0.08); border-color: var(--primary, #4CAF93); }
                .modal-overlay {
                    position: fixed; inset: 0; background: rgba(0,0,0,0.6);
                    display: flex; align-items: center; justify-content: center;
                    z-index: 1000; backdrop-filter: blur(4px);
                }
                .modal-card {
                    background: var(--bg-dark-secondary, #243b44); border: 1px solid rgba(255,255,255,0.08);
                    border-radius: var(--radius-md, 4px); padding: 2rem; width: 100%; max-width: 440px;
                }
                .modal-card h2 { font-size: 1.2rem; margin-bottom: 1.25rem; font-weight: 600; }
                .modal-error {
                    background: rgba(220,38,38,0.1); border: 1px solid rgba(220,38,38,0.2);
                    color: #fca5a5; padding: 0.55rem 0.85rem; border-radius: var(--radius-sm, 2px);
                    font-size: 0.82rem; margin-bottom: 1rem;
                    display: flex; flex-direction: column; align-items: flex-start; gap: 0.4rem;
                }
                .use-existing {
                    background: rgba(76,175,147,0.12); border: none; color: var(--primary, #4CAF93);
                    padding: 0.3rem 0.65rem; border-radius: var(--radius-sm, 2px);
                    font-size: 0.78rem; font-weight: 600; cursor: pointer; font-family: inherit;
                }
                .use-existing:hover { background: rgba(76,175,147,0.22); }
                .modal-stack { display: flex; flex-direction: column; gap: 0.9rem; }
                .modal-actions { display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 1.5rem; }
                .checkbox-field { margin-top: 0.5rem; }
                .checkbox-label { display: flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; color: rgba(255,255,255,0.6); cursor: pointer; }
                .checkbox-label input[type="checkbox"] { width: auto; accent-color: var(--primary, #4CAF93); }
                .form-actions { display: flex; justify-content: flex-end; gap: 0.75rem; }
                @media (max-width: 640px) { .form-layout { flex-direction: column; } .field-row { grid-template-columns: 1fr; } }
            `}</style>
        </div>
    );
}

export default function SecretaryNewReservationPage() {
    return (
        <Suspense fallback={<div style={{ color: "rgba(255,255,255,0.4)", padding: "2rem" }}>Loading…</div>}>
            <SecretaryNewReservationForm />
        </Suspense>
    );
}
