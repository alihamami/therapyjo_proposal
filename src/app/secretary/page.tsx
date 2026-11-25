"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Calendar from "@/app/components/Calendar";
import DayHeader, { todayISO } from "@/app/components/DayHeader";
import { CalendarPlus, Plus } from "lucide-react";
import { useConfirm } from "@/app/components/ConfirmDialog";
import StaffModal from "@/app/components/StaffModal";
import StaffSkeleton from "@/app/components/StaffSkeleton";

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

export default function SecretaryDashboard() {
    const confirm = useConfirm();
    const router = useRouter();
    const [selectedDate, setSelectedDate] = useState(todayISO());
    const [doctorFilter, setDoctorFilter] = useState("all");
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [loading, setLoading] = useState(true);

    const [statusError, setStatusError] = useState("");
    // Duplicate popup (TJ-069c). It replaces a browser prompt that asked for
    // a typed YYYY-MM-DD date and ignored a failed request.
    const [dupId, setDupId] = useState<number | null>(null);
    const [dupDate, setDupDate] = useState("");
    const [dupTime, setDupTime] = useState("");
    const [dupSaving, setDupSaving] = useState(false);
    const [dupError, setDupError] = useState("");

    const fetchDoctors = useCallback(async () => {
        const res = await fetch("/api/employees/doctors");
        const data = await res.json();
        setDoctors(data.filter((d: Doctor & { status: string }) => d.status === "ACTIVE"));
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

    // Matches the admin dashboard: the card body opens the patient's file.
    // The secretary has no session-detail view, so no onViewDetails is passed
    // and no "Session Details" item appears in the menu. (TJ-048)
    const handleSlotClick = (id: number) => {
        const r = reservations.find((x) => x.id === id);
        if (!r) return;
        router.push(`/secretary/patients/${r.patient.id}`);
    };

    // Mirrors the "+ Add Reservation" button: both go to the booking page.
    // (The old in-file booking modal was removed in TJ-068a.)
    const handleEmptyClick = (hour: number) => {
        const time = `${String(hour).padStart(2, "0")}:00`;
        window.location.href = `/secretary/reservations/new?date=${selectedDate}&time=${time}`;
    };

    const handleEdit = (id: number) => {
        window.location.href = `/secretary/reservations/${id}/edit`;
    };

    const handleDelete = async (id: number) => {
        const patientName = reservations.find((r) => r.id === id)?.patient.name;
        if (!(await confirm({
            title: "Delete this reservation?",
            message: `${patientName ? `${patientName}'s session` : "The session"} is removed from the calendar for good. This can't be undone.`,
            confirmLabel: "Delete",
            tone: "danger",
        }))) return;
        setStatusError("");
        const res = await fetch(`/api/reservations/${id}`, { method: "DELETE" });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setStatusError(data.error || "Could not delete the reservation.");
            return;
        }
        fetchReservations();
    };

    const handleDuplicate = (id: number) => {
        setDupId(id);
        setDupDate("");
        setDupTime("");
        setDupError("");
    };

    const submitDuplicate = async () => {
        if (dupId === null || !dupDate) return;
        setDupSaving(true);
        setDupError("");
        let res: Response;
        try {
            res = await fetch(`/api/reservations/${dupId}/duplicate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionDate: dupDate, sessionTime: dupTime || undefined }),
            });
        } catch {
            setDupSaving(false);
            setDupError("Could not reach the server. Check the connection and try again.");
            return;
        }
        setDupSaving(false);
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setDupError(data.error || "Could not duplicate the session. Try again.");
            return;
        }
        setDupId(null);
        fetchReservations();
    };

    const dupReservation = dupId !== null ? reservations.find((r) => r.id === dupId) : undefined;

    return (
        <div>
            {statusError && (
                <div className="error-msg status-error" role="alert">
                    <span>{statusError}</span>
                    <button className="dismiss-error" onClick={() => setStatusError("")}>Dismiss</button>
                </div>
            )}
            <DayHeader
                title="Dashboard"
                date={selectedDate}
                onDateChange={setSelectedDate}
                doctorFilter={doctorFilter}
                onDoctorFilterChange={setDoctorFilter}
                doctorOptions={doctors.map((d) => ({ value: d.id, label: d.name }))}
                action={<button className="staff-btn staff-btn-primary" onClick={() => { window.location.href = `/secretary/reservations/new?date=${selectedDate}`; }}><Plus size={15} aria-hidden="true" />Add Reservation</button>}
                statuses={reservations.map((r) => r.status)}
                doctors={doctors}
            />

            <div className="main-layout">
                <div className="calendar-col">
                    {loading ? (
                        <StaffSkeleton kind="calendar" label="Loading the schedule…" />
                    ) : (
                        <Calendar
                            reservations={reservations}
                            onStatusChange={handleStatusChange}
                            onDuplicate={handleDuplicate}
                            onDelete={handleDelete}
                            onSlotClick={handleSlotClick}
                            onEdit={handleEdit}
                            onEmptyClick={handleEmptyClick}
                            canDelete
                        />
                    )}
                </div>
            </div>

            {/* Duplicate popup (TJ-069c; on the shared component since TJ-069d1) */}
            {dupId !== null && (
                <StaffModal
                    title="Duplicate session"
                    onClose={() => setDupId(null)}
                    closeDisabled={dupSaving}
                    footer={<>
                        <button type="button" className="staff-btn staff-btn-secondary" onClick={() => setDupId(null)} disabled={dupSaving}>Cancel</button>
                        <button type="button" className="staff-btn staff-btn-primary" aria-busy={dupSaving} onClick={submitDuplicate} disabled={!dupDate || dupSaving}>
                            {!dupSaving && <CalendarPlus size={15} aria-hidden="true" />}
                            {dupSaving ? "Duplicating…" : "Duplicate"}
                        </button>
                    </>}
                >
                    {dupReservation && (
                        <p className="staff-modal-text">
                            {dupReservation.patient.name} with {dupReservation.doctor?.name ?? dupReservation.doctorNameSnapshot ?? "no doctor"}
                        </p>
                    )}
                    {dupError && <div className="staff-form-error" role="alert">{dupError}</div>}
                    <div className="staff-field-row">
                        <div className="staff-field">
                            <label htmlFor="dup-date">New date</label>
                            <input id="dup-date" type="date" value={dupDate} onChange={(e) => setDupDate(e.target.value)} autoFocus />
                        </div>
                        <div className="staff-field">
                            <label htmlFor="dup-time">New time</label>
                            <input id="dup-time" type="time" value={dupTime} onChange={(e) => setDupTime(e.target.value)} />
                            <span className="staff-field-hint">Leave empty to keep the same time</span>
                        </div>
                    </div>
                </StaffModal>
            )}

            <style jsx>{`
                .main-layout { display: block; }
                .calendar-col { min-width: 0; }
                .error-msg { background: rgba(220,38,38,0.1); border: 1px solid rgba(220,38,38,0.2); color: #fca5a5; padding: 0.5rem; border-radius: var(--radius-sm, 2px); font-size: var(--staff-size-base); margin-bottom: 0.75rem; }
                .status-error {
                    display: flex; align-items: center; justify-content: space-between;
                    gap: 0.75rem; margin-bottom: 1rem;
                }
                .dismiss-error {
                    background: none; border: none; color: #fca5a5; text-decoration: underline;
                    font-size: var(--staff-size-sm); cursor: pointer; font-family: inherit; flex-shrink: 0;
                }
                .dismiss-error:hover { color: #fff; }
            `}</style>
        </div>
    );
}
