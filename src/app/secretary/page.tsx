"use client";

import { useState, useEffect, useCallback } from "react";
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

const today = () => new Date().toISOString().split("T")[0];

export default function SecretaryDashboard() {
    const router = useRouter();
    const [selectedDate, setSelectedDate] = useState(today());
    const [doctorFilter, setDoctorFilter] = useState("all");
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [loading, setLoading] = useState(true);

    const [statusError, setStatusError] = useState("");

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
        if (!confirm("Delete this reservation?")) return;
        setStatusError("");
        const res = await fetch(`/api/reservations/${id}`, { method: "DELETE" });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setStatusError(data.error || "Could not delete the reservation.");
            return;
        }
        fetchReservations();
    };

    const handleDuplicate = async (id: number) => {
        const date = prompt("Duplicate to which date? (YYYY-MM-DD)");
        if (!date) return;
        await fetch(`/api/reservations/${id}/duplicate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionDate: date }),
        });
        fetchReservations();
    };

    const goDay = (offset: number) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + offset);
        setSelectedDate(d.toISOString().split("T")[0]);
    };

    const formatDate = () =>
        new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
            weekday: "long", month: "long", day: "numeric", year: "numeric",
        });

    return (
        <div>
            {statusError && (
                <div className="error-msg status-error" role="alert">
                    <span>{statusError}</span>
                    <button className="dismiss-error" onClick={() => setStatusError("")}>Dismiss</button>
                </div>
            )}
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
                    <select className="doctor-select" value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)}>
                        <option value="all">All Doctors</option>
                        {doctors.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
                    </select>
                    <button className="btn-add" onClick={() => { window.location.href = `/secretary/reservations/new?date=${selectedDate}`; }}>+ Add Reservation</button>
                </div>
            </div>

            <div className="date-trigger-row">
                <DatePickerPopover
                    selectedDate={selectedDate}
                    onDateSelect={setSelectedDate}
                    doctorId={doctorFilter}
                    label={formatDate()}
                />
            </div>

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
                            onEmptyClick={handleEmptyClick}
                            canDelete
                        />
                    )}
                </div>
            </div>

            <style jsx>{`
                .controls { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 0.5rem; }
                .controls-left { display: flex; align-items: center; gap: 1.25rem; }
                .controls-left h1 { font-size: 1.5rem; font-weight: 600; }
                .date-nav { display: flex; gap: 0.35rem; }
                .btn-nav { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.7); padding: 0.35rem 0.75rem; border-radius: var(--radius-sm, 2px); font-size: 0.78rem; cursor: pointer; font-family: inherit; }
                .btn-nav:hover { background: rgba(255,255,255,0.1); color: #fff; }
                .btn-today { font-weight: 600; color: var(--primary, #4CAF93); border-color: var(--primary, #4CAF93); }
                .controls-right { display: flex; align-items: center; gap: 0.5rem; }
                .doctor-select { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 0.4rem 0.75rem; border-radius: var(--radius-sm, 2px); font-size: 0.82rem; font-family: inherit; }
                .doctor-select option { background: #1a2e35; }
                .btn-add { background: var(--primary, #4CAF93); color: #fff; border: none; padding: 0.45rem 1rem; border-radius: var(--radius-sm, 2px); font-size: 0.82rem; font-weight: 600; cursor: pointer; font-family: inherit; }
                .date-trigger-row { margin-bottom: 1rem; }
                .main-layout { display: block; }
                .calendar-col { min-width: 0; }
                .error-msg { background: rgba(220,38,38,0.1); border: 1px solid rgba(220,38,38,0.2); color: #fca5a5; padding: 0.5rem; border-radius: var(--radius-sm, 2px); font-size: 0.82rem; margin-bottom: 0.75rem; }
                .status-error {
                    display: flex; align-items: center; justify-content: space-between;
                    gap: 0.75rem; margin-bottom: 1rem;
                }
                .dismiss-error {
                    background: none; border: none; color: #fca5a5; text-decoration: underline;
                    font-size: 0.78rem; cursor: pointer; font-family: inherit; flex-shrink: 0;
                }
                .dismiss-error:hover { color: #fff; }
                @media (max-width: 768px) { .controls { flex-direction: column; align-items: flex-start; } }
            `}</style>
        </div>
    );
}
