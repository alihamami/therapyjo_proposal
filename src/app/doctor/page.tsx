"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Calendar from "@/app/components/Calendar";
import DatePickerPopover from "@/app/components/DatePickerPopover";
import { sessionsHiddenFrom } from "@/lib/permissions";
import { SCHEDULE_OPEN_LABEL } from "@/lib/clinicHours";

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

export default function DoctorDashboard() {
    const { data: session } = useSession();
    const router = useRouter();
    const [selectedDate, setSelectedDate] = useState(today());
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [doctors, setDoctors] = useState<Doctor[]>([]);

    const doctorId = (session?.user as { id?: string })?.id;
    // Only this doctor's own cards offer actions; a colleague's are read-only.
    // An admin may open this page too and keeps every action. Until the
    // session loads, no card offers anything. (TJ-062)
    const ownerId = session?.user?.role === "ADMIN" ? undefined : (doctorId ?? "");

    // A day that has not opened yet shows a notice, not an empty calendar: the
    // server sends a doctor nothing for it, and "0 sessions" would read as a
    // free day. selectedDate parses as UTC midnight, the instant the server
    // compares against. An admin sees every day. (TJ-064)
    const hiddenFrom = session ? sessionsHiddenFrom(session.user) : null;
    const dayLocked = hiddenFrom !== null && new Date(selectedDate) >= hiddenFrom;

    // Opens on the whole clinic's schedule, the same as admin and secretary.
    // The select below narrows it to the doctor's own, or to one colleague's.
    // (TJ-058)
    const [doctorFilter, setDoctorFilter] = useState("all");

    const fetchDoctors = useCallback(async () => {
        const res = await fetch("/api/employees/doctors");
        const data = await res.json();
        setDoctors(Array.isArray(data) ? data.filter((d: Doctor & { status: string }) => d.status === "ACTIVE") : []);
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
        await fetch(`/api/reservations/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
        });
        fetchReservations();
    };

    const handleSlotClick = (id: number) => {
        router.push(`/doctor/session/${id}`);
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Delete this session?")) return;
        await fetch(`/api/reservations/${id}`, { method: "DELETE" });
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
            <div className="controls">
                <h1>My Schedule</h1>
                <div className="date-nav">
                    <button className="btn-nav" onClick={() => goDay(-1)}>← Yesterday</button>
                    <button className="btn-nav btn-today" onClick={() => setSelectedDate(today())}>Today</button>
                    <button className="btn-nav" onClick={() => goDay(1)}>Tomorrow →</button>
                </div>
                <select className="doctor-select" value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)}>
                    <option value="all">All Doctors</option>
                    {doctorId && <option value={doctorId}>My Schedule</option>}
                    {doctors.filter((d) => d.id !== doctorId).map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                </select>
            </div>
            <div className="date-trigger-row">
                <DatePickerPopover
                    selectedDate={selectedDate}
                    onDateSelect={setSelectedDate}
                    doctorId={doctorFilter}
                    label={formatDate()}
                />
                {!dayLocked && (
                    <span className="session-count">{reservations.length} session{reservations.length !== 1 ? "s" : ""}</span>
                )}
            </div>

            <div className="main-layout">
                <div className="calendar-col">
                    {dayLocked ? (
                        <div style={{ color: "rgba(255,255,255,0.4)", padding: "2rem", textAlign: "center" }}>
                            {`This day's schedule opens at ${SCHEDULE_OPEN_LABEL} on ${formatDate()}.`}
                        </div>
                    ) : loading ? (
                        <div style={{ color: "rgba(255,255,255,0.4)", padding: "2rem", textAlign: "center" }}>Loading…</div>
                    ) : (
                        <Calendar
                            reservations={reservations}
                            onStatusChange={handleStatusChange}
                            onDelete={handleDelete}
                            onSlotClick={handleSlotClick}
                            ownerId={ownerId}
                        />
                    )}
                </div>
            </div>

            <style jsx>{`
                .controls { display: flex; align-items: center; gap: 1.25rem; margin-bottom: 0.5rem; }
                .controls h1 { font-size: 1.5rem; font-weight: 600; }
                .date-nav { display: flex; gap: 0.35rem; }
                .btn-nav { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.7); padding: 0.35rem 0.75rem; border-radius: var(--radius-sm, 2px); font-size: 0.78rem; cursor: pointer; font-family: inherit; }
                .btn-nav:hover { background: rgba(255,255,255,0.1); color: #fff; }
                .btn-today { font-weight: 600; color: var(--primary, #4CAF93); border-color: var(--primary, #4CAF93); }
                .doctor-select { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 0.4rem 0.75rem; border-radius: var(--radius-sm, 2px); font-size: 0.82rem; font-family: inherit; margin-left: auto; }
                .doctor-select option { background: #1a2e35; }
                .date-trigger-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
                .session-count { color: rgba(255,255,255,0.5); font-size: 0.9rem; }
                .main-layout { display: block; }
                .calendar-col { min-width: 0; }
            `}</style>
        </div>
    );
}
