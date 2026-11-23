"use client";

// The top of the three dashboards (TJ-071): the title, the day steps, the
// doctor filter and the page's own button on the first line; the date
// picker, the day's summary and the doctor colour key on the second. The
// summary counts every session and names only the statuses that occur, so
// a quiet morning reads "3 sessions, 3 Scheduled" instead of a row of zeros.
// Its styles are the .staff-day-* rules in the globals.css staff section.

import DatePickerPopover from "@/app/components/DatePickerPopover";
import { STATUS_COLORS, STATUS_LABELS, STATUS_ORDER } from "@/lib/reservationStatus";

/** The day the dashboards open on, as before: today's date in UTC. */
export const todayISO = () => new Date().toISOString().split("T")[0];

/** A YYYY-MM-DD day moved by whole days, as the dashboards did. */
export function shiftDay(date: string, offset: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + offset);
    return d.toISOString().split("T")[0];
}

/** "Monday, November 24, 2026". */
export function formatDay(date: string) {
    return new Date(date + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
    });
}

export default function DayHeader({
    title,
    date,
    onDateChange,
    doctorFilter,
    onDoctorFilterChange,
    doctorOptions,
    action,
    statuses,
    extra,
    doctors,
}: {
    title: string;
    date: string;
    onDateChange: (date: string) => void;
    doctorFilter: string;
    onDoctorFilterChange: (value: string) => void;
    /** The filter's choices after "All Doctors". */
    doctorOptions: { value: string; label: string }[];
    /** The page's own button, such as Add Reservation. */
    action?: React.ReactNode;
    /** The day's session statuses; null hides the summary. */
    statuses: string[] | null;
    /** Shown after the summary, such as the duplicates link. */
    extra?: React.ReactNode;
    /** The doctors whose colours the calendar uses, for the colour key. */
    doctors: { id: string; name: string; color: string | null }[];
}) {
    const counts = new Map<string, number>();
    for (const s of statuses ?? []) counts.set(s, (counts.get(s) ?? 0) + 1);
    const total = statuses?.length ?? 0;

    return (
        <div className="staff-day-header">
            <div className="staff-day-top">
                <div className="staff-day-title">
                    <h1>{title}</h1>
                    <div className="staff-day-steps">
                        <button type="button" className="staff-day-step" onClick={() => onDateChange(shiftDay(date, -1))}>← Yesterday</button>
                        <button type="button" className="staff-day-step staff-day-today" onClick={() => onDateChange(todayISO())}>Today</button>
                        <button type="button" className="staff-day-step" onClick={() => onDateChange(shiftDay(date, 1))}>Tomorrow →</button>
                    </div>
                </div>
                <div className="staff-day-tools">
                    <select
                        className="staff-day-select"
                        aria-label="Doctor"
                        value={doctorFilter}
                        onChange={(e) => onDoctorFilterChange(e.target.value)}
                    >
                        <option value="all">All Doctors</option>
                        {doctorOptions.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                    {action}
                </div>
            </div>

            <div className="staff-day-sub">
                <div className="staff-day-info">
                    <DatePickerPopover
                        selectedDate={date}
                        onDateSelect={onDateChange}
                        doctorId={doctorFilter}
                        label={formatDay(date)}
                    />
                    {(statuses || extra) && (
                        <div className="staff-day-summary">
                            {statuses && (
                                <>
                                    <span className="staff-day-chip"><b>{total}</b> session{total === 1 ? "" : "s"}</span>
                                    {STATUS_ORDER.filter((s) => counts.has(s)).map((s) => (
                                        <span key={s} className="staff-day-chip">
                                            <span className="staff-day-dot" style={{ background: STATUS_COLORS[s] }} aria-hidden="true" />
                                            <b>{counts.get(s)}</b> {STATUS_LABELS[s]}
                                        </span>
                                    ))}
                                </>
                            )}
                            {extra}
                        </div>
                    )}
                </div>
                {doctors.length > 0 && (
                    <div className="staff-day-legend">
                        {doctors.map((d) => (
                            <span key={d.id} className="staff-day-legend-item">
                                <span className="staff-day-legend-dot" style={{ background: d.color || "#666" }} aria-hidden="true" />
                                {d.name}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
