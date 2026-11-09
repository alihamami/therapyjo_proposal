"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Calendar from "@/app/components/Calendar";
import DatePickerPopover from "@/app/components/DatePickerPopover";

interface Doctor {
    id: string;
    name: string;
    color: string | null;
}

interface Reservation {
    id: number;
    sessionTime: string;
    status: string;
    note: string | null;
    showNoteOnCalendar: boolean;
    isTwoHours: boolean;
    patient: { id: number; name: string; phone1: string; phone2: string | null };
    doctor: { id: string; name: string; color: string | null } | null;
    doctorNameSnapshot: string | null;
    doctorColorSnapshot: string | null;
}

interface PatientResult {
    id: number;
    name: string;
    phone1: string;
}

type ReservationDetail = Reservation & {
    nextSessionNote?: string | null;
    paymentType?: string | null;
    injuryPlace?: string | null;
    previousSessionNote?: string | null;
    previousSessionDate?: string | null;
    soapNote?: {
        subjective?: string | null;
        objective?: string | null;
        assessment?: string | null;
        plan?: string | null;
    } | null;
};

const today = () => new Date().toISOString().split("T")[0];

export default function AdminDashboard() {
    const router = useRouter();
    const [selectedDate, setSelectedDate] = useState(today());
    const [doctorFilter, setDoctorFilter] = useState("all");
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [dupCount, setDupCount] = useState(0);

    // Add Reservation modal
    const [showAdd, setShowAdd] = useState(false);
    const [patientSearch, setPatientSearch] = useState("");
    const [patientResults, setPatientResults] = useState<PatientResult[]>([]);
    const [selectedPatient, setSelectedPatient] = useState<PatientResult | null>(null);
    const [addForm, setAddForm] = useState({
        doctorId: "",
        sessionTime: "09:00",
        note: "",
        showNoteOnCalendar: false,
        nextSessionNote: "",
        paymentType: "",
        isTwoHours: false,
    });
    const [addError, setAddError] = useState("");
    const [statusError, setStatusError] = useState("");
    const [saving, setSaving] = useState(false);

    // Reservation detail modal
    const [detailId, setDetailId] = useState<number | null>(null);
    const [detail, setDetail] = useState<ReservationDetail | null>(null);

    // Duplicate modal
    const [dupId, setDupId] = useState<number | null>(null);
    const [dupDate, setDupDate] = useState("");
    const [dupTime, setDupTime] = useState("");

    const fetchDoctors = useCallback(async () => {
        const res = await fetch("/api/employees/doctors");
        const data = await res.json();
        setDoctors(data.filter((d: Doctor & { status: string }) => d.status === "ACTIVE"));
    }, []);

    const fetchDuplicateCount = useCallback(async () => {
        const res = await fetch("/api/patients/duplicates");
        const data = await res.json();
        setDupCount(data.total || 0);
    }, []);

    const fetchReservations = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams({ date: selectedDate });
        if (doctorFilter !== "all") params.set("doctorId", doctorFilter);
        const res = await fetch(`/api/reservations?${params}`);
        const data = await res.json();
        setReservations(Array.isArray(data) ? data : []);
        setLoading(false);
    }, [selectedDate, doctorFilter]);

    useEffect(() => { fetchDoctors(); }, [fetchDoctors]);
    useEffect(() => { fetchReservations(); }, [fetchReservations]);
    useEffect(() => { fetchDuplicateCount(); }, [fetchDuplicateCount]);

    // Patient search for add modal
    useEffect(() => {
        if (patientSearch.length < 2) { setPatientResults([]); return; }
        const timer = setTimeout(async () => {
            const res = await fetch(`/api/patients?search=${encodeURIComponent(patientSearch)}&limit=5`);
            const data = await res.json();
            setPatientResults(data.patients || []);
        }, 300);
        return () => clearTimeout(timer);
    }, [patientSearch]);

    const handleStatusChange = async (id: number, status: string) => {
        setStatusError("");
        const res = await fetch(`/api/reservations/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setStatusError(data.error || "Could not change the session status.");
            return;
        }
        fetchReservations();
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Delete this reservation?")) return;
        await fetch(`/api/reservations/${id}`, { method: "DELETE" });
        fetchReservations();
    };

    const handleDuplicate = (id: number) => {
        setDupId(id);
        setDupDate("");
        setDupTime("");
    };

    const submitDuplicate = async () => {
        if (!dupId || !dupDate) return;
        await fetch(`/api/reservations/${dupId}/duplicate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionDate: dupDate, sessionTime: dupTime || undefined }),
        });
        setDupId(null);
        fetchReservations();
    };

    // Mirrors the "+ Add Reservation" button, which navigates rather than
    // opening the in-file modal (that modal is unreachable — see TJ-045).
    // Carries the clicked hour so the form opens on the right time.
    const handleEmptyClick = (hour: number) => {
        const time = `${String(hour).padStart(2, "0")}:00`;
        window.location.href = `/admin/reservations/new?date=${selectedDate}&time=${time}`;
    };

    const handleEdit = (id: number) => {
        window.location.href = `/admin/reservations/${id}/edit`;
    };

    // The card body goes to the person, not the appointment — the file is where
    // the phone numbers, history and documents are. The appointment's own detail
    // view moved into the card menu as "Session Details". (TJ-048)
    const handleSlotClick = (id: number) => {
        const r = reservations.find((x) => x.id === id);
        if (!r) return;
        router.push(`/admin/patients/${r.patient.id}`);
    };

    const handleViewDetails = async (id: number) => {
        const res = await fetch(`/api/reservations/${id}`);
        const data = await res.json();
        setDetail(data);
        setDetailId(id);
    };

    const openAddModal = () => {
        setShowAdd(true);
        setSelectedPatient(null);
        setPatientSearch("");
        setAddError("");
        setAddForm({
            doctorId: doctors.length > 0 ? doctors[0].id : "",
            sessionTime: "09:00",
            note: "",
            showNoteOnCalendar: false,
            nextSessionNote: "",
            paymentType: "",
            isTwoHours: false,
        });
    };

    const submitAdd = async () => {
        if (!selectedPatient) { setAddError("Select a patient first"); return; }
        if (!addForm.doctorId) { setAddError("Select a doctor"); return; }
        setSaving(true);
        setAddError("");
        const res = await fetch("/api/reservations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                patientId: selectedPatient.id,
                doctorId: addForm.doctorId,
                sessionDate: selectedDate,
                sessionTime: addForm.sessionTime,
                note: addForm.note,
                showNoteOnCalendar: addForm.showNoteOnCalendar,
                nextSessionNote: addForm.nextSessionNote,
                paymentType: addForm.paymentType || null,
                isTwoHours: addForm.isTwoHours,
            }),
        });
        const data = await res.json();
        setSaving(false);
        if (res.ok) {
            setShowAdd(false);
            fetchReservations();
        } else {
            setAddError(data.error || "Failed to create reservation");
        }
    };

    const goDay = (offset: number) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + offset);
        setSelectedDate(d.toISOString().split("T")[0]);
    };

    const formatSelectedDate = () =>
        new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
        });

    return (
        <div className="dashboard">
            {statusError && (
                <div className="error-msg status-error" role="alert">
                    <span>{statusError}</span>
                    <button className="dismiss-error" onClick={() => setStatusError("")}>Dismiss</button>
                </div>
            )}
            {/* Controls */}
            <div className="controls">
                <div className="controls-left">
                    <h1>Dashboard</h1>
                    <div className="date-nav">
                        <button className="btn-nav" onClick={() => goDay(-1)}>← Yesterday</button>
                        <button className="btn-nav btn-today" onClick={() => setSelectedDate(today())}>Today</button>
                        <button className="btn-nav" onClick={() => goDay(1)}>Tomorrow →</button>
                    </div>
                </div>
                <div className="controls-right">
                    <select
                        className="doctor-select"
                        value={doctorFilter}
                        onChange={(e) => setDoctorFilter(e.target.value)}
                    >
                        <option value="all">All Doctors</option>
                        {doctors.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                    <button className="btn-add" onClick={() => { window.location.href = `/admin/reservations/new?date=${selectedDate}`; }}>+ Add Reservation</button>
                </div>
            </div>

            {/* Date & Legend */}
            <div className="sub-header">
                <div className="sub-header-start">
                    <DatePickerPopover
                        selectedDate={selectedDate}
                        onDateSelect={setSelectedDate}
                        doctorId={doctorFilter}
                        label={formatSelectedDate()}
                    />
                    <div className="summary-chips">
                        <span className="chip"><span className="chip-val">{reservations.length}</span> Total</span>
                        <span className="chip"><span className="chip-val">{reservations.filter((r) => r.status === "SCHEDULED").length}</span> Scheduled</span>
                        <span className="chip"><span className="chip-val">{reservations.filter((r) => r.status === "WAITING").length}</span> Waiting</span>
                        <span className="chip"><span className="chip-val">{reservations.filter((r) => r.status === "CHECKED_IN").length}</span> Checked In</span>
                        <span className="chip"><span className="chip-val">{reservations.filter((r) => r.status === "WITH_DOCTOR").length}</span> With Doctor</span>
                        <span className="chip"><span className="chip-val">{reservations.filter((r) => r.status === "CHECKED_OUT").length}</span> Checked Out</span>
                        {dupCount > 0 && (
                            <Link href="/admin/patients/duplicates" className="chip chip-warn">
                                <span className="chip-val">{dupCount}</span> Possible duplicate{dupCount === 1 ? "" : "s"} →
                            </Link>
                        )}
                    </div>
                </div>
                <div className="legend">
                    {doctors.map((d) => (
                        <span key={d.id} className="legend-item">
                            <span className="legend-dot" style={{ background: d.color || "#666" }} />
                            {d.name}
                        </span>
                    ))}
                </div>
            </div>

            {/* Main layout */}
            <div className="main-layout">
                <div className="calendar-col">
                    {loading ? (
                        <div style={{ color: "rgba(255,255,255,0.4)", padding: "2rem", textAlign: "center" }}>Loading…</div>
                    ) : (
                        <Calendar
                            reservations={reservations}
                            onStatusChange={handleStatusChange}
                            onDuplicate={handleDuplicate}
                            onDelete={handleDelete}
                            onSlotClick={handleSlotClick}
                            onEdit={handleEdit}
                            onViewDetails={handleViewDetails}
                            onEmptyClick={handleEmptyClick}
                            canDelete
                        />
                    )}
                </div>
            </div>

            {/* Add Reservation Modal */}
            {showAdd && (
                <div className="modal-overlay" onClick={() => setShowAdd(false)}>
                    <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                        <h2>Add Reservation</h2>
                        <p className="modal-date">{formatSelectedDate()}</p>
                        {addError && <div className="error-msg">{addError}</div>}

                        <div className="form-group">
                            <label>Patient (search by name or phone)</label>
                            <input
                                placeholder="Type to search..."
                                value={selectedPatient ? selectedPatient.name : patientSearch}
                                onChange={(e) => {
                                    setPatientSearch(e.target.value);
                                    setSelectedPatient(null);
                                }}
                            />
                            {patientResults.length > 0 && !selectedPatient && (
                                <div className="search-results">
                                    {patientResults.map((p) => (
                                        <button
                                            key={p.id}
                                            className="search-item"
                                            onClick={() => {
                                                setSelectedPatient(p);
                                                setPatientSearch("");
                                                setPatientResults([]);
                                            }}
                                        >
                                            <span>{p.name}</span>
                                            <span className="search-phone">{p.phone1}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Doctor</label>
                                <select value={addForm.doctorId} onChange={(e) => setAddForm({ ...addForm, doctorId: e.target.value })}>
                                    {doctors.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Time</label>
                                <input type="time" min="07:00" max="18:00" value={addForm.sessionTime} onChange={(e) => setAddForm({ ...addForm, sessionTime: e.target.value })} />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Payment</label>
                                <select value={addForm.paymentType} onChange={(e) => setAddForm({ ...addForm, paymentType: e.target.value })}>
                                    <option value="">—</option>
                                    <option value="CASH">Cash</option>
                                    <option value="INSURANCE">Insurance</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="checkbox-label">
                                    <input type="checkbox" checked={addForm.isTwoHours} onChange={(e) => setAddForm({ ...addForm, isTwoHours: e.target.checked })} />
                                    2-hour session
                                </label>
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Note</label>
                            <textarea rows={2} value={addForm.note} onChange={(e) => setAddForm({ ...addForm, note: e.target.value })} />
                            <label className="checkbox-label">
                                <input type="checkbox" checked={addForm.showNoteOnCalendar} onChange={(e) => setAddForm({ ...addForm, showNoteOnCalendar: e.target.checked })} />
                                Show note on calendar
                            </label>
                        </div>
                        <div className="form-group">
                            <label>Next session note</label>
                            <textarea rows={2} value={addForm.nextSessionNote} onChange={(e) => setAddForm({ ...addForm, nextSessionNote: e.target.value })} />
                        </div>
                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={() => setShowAdd(false)}>Cancel</button>
                            <button className="btn-save" onClick={submitAdd} disabled={saving}>
                                {saving ? "Saving…" : "Create Reservation"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Duplicate Modal */}
            {dupId !== null && (
                <div className="modal-overlay" onClick={() => setDupId(null)}>
                    <div className="modal-card modal-sm" onClick={(e) => e.stopPropagation()}>
                        <h2>Duplicate Reservation</h2>
                        <div className="form-group">
                            <label>New Date</label>
                            <input type="date" value={dupDate} onChange={(e) => setDupDate(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>New Time (optional)</label>
                            <input type="time" value={dupTime} onChange={(e) => setDupTime(e.target.value)} />
                        </div>
                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={() => setDupId(null)}>Cancel</button>
                            <button className="btn-save" onClick={submitDuplicate} disabled={!dupDate}>Duplicate</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reservation Detail Modal */}
            {detailId !== null && detail && (
                <div className="modal-overlay" onClick={() => { setDetailId(null); setDetail(null); }}>
                    <div className="modal-card modal-lg" onClick={(e) => e.stopPropagation()}>
                        <h2>{detail.patient.name}</h2>
                        <div className="detail-grid">
                            <div className="detail-item"><span className="detail-label">Phone</span><span>{detail.patient.phone1}</span></div>
                            <div className="detail-item"><span className="detail-label">Doctor</span><span>{detail.doctor?.name ?? detail.doctorNameSnapshot ?? "—"}</span></div>
                            <div className="detail-item"><span className="detail-label">Status</span><span>{detail.status.replace("_", " ")}</span></div>
                            <div className="detail-item"><span className="detail-label">Payment</span><span>{detail.paymentType || "—"}</span></div>
                            {detail.note && <div className="detail-item full"><span className="detail-label">Note</span><span>{detail.note}</span></div>}
                            {detail.nextSessionNote && <div className="detail-item full"><span className="detail-label">Next Session Note</span><span>{detail.nextSessionNote}</span></div>}
                            {detail.previousSessionNote && (
                                <div className="detail-item full prev-note">
                                    <span className="detail-label">From Previous Session {detail.previousSessionDate ? `(${new Date(detail.previousSessionDate).toLocaleDateString()})` : ""}</span>
                                    <span>{detail.previousSessionNote}</span>
                                </div>
                            )}
                        </div>
                        {/* Drawn whether or not the note has text, with a way into
                            its editor on the patient file. (TJ-065) */}
                        <div className="soap-section">
                            <h3>SOAP Note</h3>
                            {detail.soapNote && (detail.soapNote.subjective || detail.soapNote.objective || detail.soapNote.assessment || detail.soapNote.plan) ? (
                                <>
                                    {detail.soapNote.subjective && <div className="soap-field"><strong>S:</strong> {detail.soapNote.subjective}</div>}
                                    {detail.soapNote.objective && <div className="soap-field"><strong>O:</strong> {detail.soapNote.objective}</div>}
                                    {detail.soapNote.assessment && <div className="soap-field"><strong>A:</strong> {detail.soapNote.assessment}</div>}
                                    {detail.soapNote.plan && <div className="soap-field"><strong>P:</strong> {detail.soapNote.plan}</div>}
                                </>
                            ) : (
                                <div className="soap-field">No SOAP note yet.</div>
                            )}
                        </div>
                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={() => { setDetailId(null); setDetail(null); }}>Close</button>
                            <button className="btn-save" onClick={() => router.push(`/admin/patients/${detail.patient.id}?soap=${detail.id}`)}>Edit SOAP Note</button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .dashboard { display: flex; flex-direction: column; gap: 1rem; }
                .controls { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem; }
                .controls-left { display: flex; align-items: center; gap: 1.25rem; }
                .controls-left h1 { font-size: 1.5rem; font-weight: 600; }
                .date-nav { display: flex; gap: 0.35rem; }
                .btn-nav {
                    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
                    color: rgba(255,255,255,0.7); padding: 0.35rem 0.75rem; border-radius: var(--radius-sm, 2px);
                    font-size: 0.78rem; cursor: pointer; font-family: inherit;
                }
                .btn-nav:hover { background: rgba(255,255,255,0.1); color: #fff; }
                .btn-today { font-weight: 600; color: var(--primary, #4CAF93); border-color: var(--primary, #4CAF93); }
                .controls-right { display: flex; align-items: center; gap: 0.5rem; }
                .doctor-select {
                    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
                    color: #fff; padding: 0.4rem 0.75rem; border-radius: var(--radius-sm, 2px);
                    font-size: 0.82rem; font-family: inherit;
                }
                .doctor-select option { background: #1a2e35; }
                .btn-add {
                    background: var(--primary, #4CAF93); color: #fff; border: none;
                    padding: 0.45rem 1rem; border-radius: var(--radius-sm, 2px);
                    font-size: 0.82rem; font-weight: 600; cursor: pointer; font-family: inherit;
                }
                .btn-add:hover { opacity: 0.9; }
                .sub-header {
                    display: flex; align-items: center; justify-content: space-between;
                    flex-wrap: wrap; gap: 0.5rem;
                }
                .current-date { font-size: 1rem; font-weight: 500; color: rgba(255,255,255,0.7); }
                .legend { display: flex; gap: 1rem; flex-wrap: wrap; }
                .legend-item { display: flex; align-items: center; gap: 0.3rem; font-size: 0.76rem; color: rgba(255,255,255,0.5); }
                .legend-dot { width: 10px; height: 10px; border-radius: 2px; }
                .main-layout { display: block; }
                .calendar-col { min-width: 0; }
                .sub-header-start { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
                .summary-chips { display: flex; gap: 0.4rem; flex-wrap: wrap; }
                .chip {
                    display: inline-flex; align-items: center; gap: 0.3rem;
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: var(--radius-sm, 2px);
                    padding: 0.2rem 0.5rem;
                    font-size: 0.74rem; color: rgba(255,255,255,0.55);
                    white-space: nowrap;
                }
                .chip-val { font-weight: 700; color: #fff; font-variant-numeric: tabular-nums; }
                .chip-warn {
                    background: rgba(251,191,36,0.08); border-color: rgba(251,191,36,0.2);
                    color: #fbbf24; text-decoration: none;
                }
                .chip-warn .chip-val { color: #fbbf24; }
                .chip-warn:hover { background: rgba(251,191,36,0.14); }
                .modal-overlay {
                    position: fixed; inset: 0; background: rgba(0,0,0,0.6);
                    display: flex; align-items: center; justify-content: center;
                    z-index: 1000; backdrop-filter: blur(4px);
                }
                .modal-card {
                    background: var(--bg-dark-secondary, #243b44); border: 1px solid rgba(255,255,255,0.08);
                    border-radius: var(--radius-md, 4px); padding: 2rem; width: 100%; max-width: 520px;
                    max-height: 90vh; overflow-y: auto;
                }
                .modal-sm { max-width: 360px; }
                .modal-lg { max-width: 600px; }
                .modal-card h2 { font-size: 1.15rem; margin-bottom: 0.5rem; font-weight: 600; }
                .modal-date { font-size: 0.82rem; color: rgba(255,255,255,0.45); margin-bottom: 1rem; }
                .error-msg {
                    background: rgba(220,38,38,0.1); border: 1px solid rgba(220,38,38,0.2);
                    color: #fca5a5; padding: 0.5rem 0.75rem; border-radius: var(--radius-sm, 2px);
                    font-size: 0.82rem; margin-bottom: 0.75rem;
                }
                .status-error {
                    display: flex; align-items: center; justify-content: space-between;
                    gap: 0.75rem; margin-bottom: 1rem;
                }
                .dismiss-error {
                    background: none; border: none; color: #fca5a5; text-decoration: underline;
                    font-size: 0.78rem; cursor: pointer; font-family: inherit; flex-shrink: 0;
                }
                .dismiss-error:hover { color: #fff; }
                .form-group { margin-bottom: 0.75rem; display: flex; flex-direction: column; gap: 0.25rem; }
                .form-row { display: flex; gap: 0.75rem; }
                .form-row .form-group { flex: 1; }
                .form-group label { font-size: 0.76rem; color: rgba(255,255,255,0.5); font-weight: 500; }
                .form-group input, .form-group textarea, .form-group select {
                    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
                    border-radius: var(--radius-sm, 2px); padding: 0.5rem 0.7rem; color: #fff;
                    font-size: 0.85rem; outline: none; font-family: inherit; resize: vertical;
                }
                .form-group select option { background: #1a2e35; }
                .form-group input:focus, .form-group textarea:focus, .form-group select:focus {
                    border-color: var(--primary, #4CAF93);
                }
                .checkbox-label {
                    flex-direction: row !important; display: flex; align-items: center; gap: 0.4rem;
                    font-size: 0.8rem !important; cursor: pointer; margin-top: 0.25rem;
                }
                .checkbox-label input[type="checkbox"] { width: auto; }
                .search-results {
                    background: var(--bg-dark-secondary, #243b44); border: 1px solid rgba(255,255,255,0.1);
                    border-radius: var(--radius-sm, 2px); margin-top: 2px; max-height: 180px; overflow-y: auto;
                }
                .search-item {
                    display: flex; justify-content: space-between; width: 100%;
                    background: none; border: none; color: #fff; padding: 0.5rem 0.7rem;
                    font-size: 0.82rem; cursor: pointer; font-family: inherit;
                    border-bottom: 1px solid rgba(255,255,255,0.04);
                }
                .search-item:hover { background: rgba(255,255,255,0.06); }
                .search-phone { color: rgba(255,255,255,0.35); font-size: 0.76rem; }
                .modal-actions { display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 1.25rem; }
                .btn-cancel {
                    background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.6);
                    border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius-sm, 2px);
                    padding: 0.5rem 1rem; font-size: 0.85rem; cursor: pointer; font-family: inherit;
                }
                .btn-save {
                    background: var(--primary, #4CAF93); color: #fff; border: none;
                    border-radius: var(--radius-sm, 2px); padding: 0.5rem 1.2rem;
                    font-size: 0.85rem; font-weight: 600; cursor: pointer; font-family: inherit;
                }
                .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
                .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem 1rem; margin-top: 0.75rem; }
                .detail-item { display: flex; flex-direction: column; gap: 0.15rem; }
                .detail-item.full { grid-column: 1 / -1; }
                .detail-label { font-size: 0.7rem; color: rgba(255,255,255,0.4); font-weight: 500; text-transform: uppercase; letter-spacing: 0.03em; }
                .detail-item span:not(.detail-label) { font-size: 0.88rem; color: rgba(255,255,255,0.85); }
                .prev-note { background: rgba(255,255,255,0.03); padding: 0.5rem 0.65rem; border-radius: var(--radius-sm, 2px); border-left: 2px solid rgba(255,255,255,0.1); }
                .soap-section { margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.06); }
                .soap-section h3 { font-size: 0.85rem; font-weight: 600; margin-bottom: 0.5rem; }
                .soap-field { font-size: 0.82rem; color: rgba(255,255,255,0.7); margin-bottom: 0.3rem; white-space: pre-wrap; }

                @media (max-width: 768px) {
                    .calendar-col { width: 100%; }
                    .sub-header-start { align-items: flex-start; }
                    .controls { flex-direction: column; align-items: flex-start; }
                    .form-row { flex-direction: column; gap: 0; }
                }

                @media (max-width: 640px) {
                    .controls-left { flex-direction: column; align-items: flex-start; gap: 0.6rem; width: 100%; }
                    .date-nav { width: 100%; }
                    .btn-nav { flex: 1; text-align: center; }
                    .controls-right { width: 100%; }
                    .doctor-select { flex: 1; }
                    .btn-add { flex-shrink: 0; }
                    .modal-overlay { padding: 1rem; align-items: flex-end; }
                    .modal-card { padding: 1.25rem; max-height: 85vh; }
                    .detail-grid { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    );
}
