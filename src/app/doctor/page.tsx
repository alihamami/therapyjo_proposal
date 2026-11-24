"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Calendar from "@/app/components/Calendar";
import DayHeader, { formatDay, todayISO } from "@/app/components/DayHeader";
import { sessionsHiddenFrom } from "@/lib/permissions";
import { SCHEDULE_OPEN_LABEL } from "@/lib/clinicHours";
import { useConfirm } from "@/app/components/ConfirmDialog";
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

export default function DoctorDashboard() {
    const confirm = useConfirm();
    const { data: session } = useSession();
    const router = useRouter();
    const [selectedDate, setSelectedDate] = useState(todayISO());
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
        const patientName = reservations.find((r) => r.id === id)?.patient.name;
        if (!(await confirm({
            title: "Delete this session?",
            message: `${patientName ? `${patientName}'s session` : "The session"} is removed from the calendar for good. This can't be undone.`,
            confirmLabel: "Delete",
            tone: "danger",
        }))) return;
        await fetch(`/api/reservations/${id}`, { method: "DELETE" });
        fetchReservations();
    };

    return (
        <div>
            <DayHeader
                title="My Schedule"
                date={selectedDate}
                onDateChange={setSelectedDate}
                doctorFilter={doctorFilter}
                onDoctorFilterChange={setDoctorFilter}
                doctorOptions={[
                    ...(doctorId ? [{ value: doctorId, label: "My Schedule" }] : []),
                    ...doctors.filter((d) => d.id !== doctorId).map((d) => ({ value: d.id, label: d.name })),
                ]}
                statuses={dayLocked ? null : reservations.map((r) => r.status)}
                doctors={doctors}
            />

            <div className="main-layout">
                <div className="calendar-col">
                    {dayLocked ? (
                        <div style={{ color: "rgba(255,255,255,0.4)", padding: "2rem", textAlign: "center" }}>
                            {`This day's schedule opens at ${SCHEDULE_OPEN_LABEL} on ${formatDay(selectedDate)}.`}
                        </div>
                    ) : loading ? (
                        <StaffSkeleton kind="calendar" label="Loading the schedule…" />
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
                .main-layout { display: block; }
                .calendar-col { min-width: 0; }
            `}</style>
        </div>
    );
}
