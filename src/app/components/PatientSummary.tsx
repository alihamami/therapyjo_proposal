// The patient file's summary line (TJ-072c, decisions P4-3 and P4-5): the
// next session, the last visit, and how many sessions are done. The styles
// are global (.staff-summary-* in globals.css).
//
// "Done" counts Checked Out sessions from the day the latest assessment was
// written, out of that assessment's Recommended Sessions. A secretary never
// sees the assessment, so their line counts every Checked Out session and
// gives no "of". A doctor sees no day after today (TJ-064), so their line
// names today's session or none.

import { CalendarClock, CircleCheck, History } from "lucide-react";

export interface LatestAssessment {
    createdAt: string;
    recommendedSessions: number | null;
}

interface SummaryReservation {
    sessionDate: string;
    sessionTime: string;
    status: string;
    doctor: { name: string; color: string | null } | null;
    doctorNameSnapshot: string | null;
    doctorColorSnapshot: string | null;
}

interface PatientSummaryProps {
    reservations: SummaryReservation[];
    lastVisitDate: string | null;
    /** True for the roles that see the Clinical Assessment. */
    clinical: boolean;
    /** The latest assessment: undefined while it loads, null when there is none. */
    latest?: LatestAssessment | null;
    /** False for a doctor, who sees no day after today. */
    seesFuture: boolean;
}

const OPEN_STATUSES = new Set(["SCHEDULED", "WAITING", "CHECKED_IN", "WITH_DOCTOR"]);

// A moment's calendar day in Amman, as YYYY-MM-DD. sessionDate is stored as
// UTC midnight of its day, so its first ten characters are already that day.
const ammanDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Amman" });

const formatDay = (sessionDate: string) =>
    new Date(sessionDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const formatTime = (sessionTime: string) =>
    new Date(sessionTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

export default function PatientSummary({ reservations, lastVisitDate, clinical, latest, seesFuture }: PatientSummaryProps) {
    const today = ammanDay(new Date());
    const next = reservations
        .filter((r) => OPEN_STATUSES.has(r.status) && r.sessionDate.slice(0, 10) >= today)
        .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate) || a.sessionTime.localeCompare(b.sessionTime))[0];
    const nextIsToday = !!next && next.sessionDate.slice(0, 10) === today;

    const checkedOut = reservations.filter((r) => r.status === "CHECKED_OUT");
    const since = clinical && latest ? ammanDay(new Date(latest.createdAt)) : null;
    const done = since ? checkedOut.filter((r) => r.sessionDate.slice(0, 10) >= since).length : checkedOut.length;
    const of = clinical && latest ? latest.recommendedSessions : null;
    const showSessions = !clinical || latest !== undefined;

    return (
        <div className="staff-summary">
            {(seesFuture || nextIsToday) && (
                <div className="staff-summary-fact">
                    <CalendarClock size={16} aria-hidden="true" className="staff-summary-icon" />
                    <div>
                        <div className="staff-summary-label">{seesFuture ? "Next session" : "Today"}</div>
                        {next ? (
                            <div className="staff-summary-value">
                                {seesFuture && <>{nextIsToday ? "Today" : formatDay(next.sessionDate)} · </>}
                                {formatTime(next.sessionTime)} ·
                                <span className="staff-summary-dot" aria-hidden="true" style={{ background: next.doctor?.color ?? next.doctorColorSnapshot ?? undefined }} />
                                {next.doctor?.name ?? next.doctorNameSnapshot ?? "—"}
                            </div>
                        ) : (
                            <div className="staff-summary-value staff-summary-none">No session booked</div>
                        )}
                    </div>
                </div>
            )}
            <div className="staff-summary-fact">
                <History size={16} aria-hidden="true" className="staff-summary-icon" />
                <div>
                    <div className="staff-summary-label">Last visit</div>
                    <div className={`staff-summary-value${lastVisitDate ? "" : " staff-summary-none"}`}>
                        {lastVisitDate ? formatDate(lastVisitDate) : "No visits yet"}
                    </div>
                </div>
            </div>
            {showSessions && (
                <div className="staff-summary-fact">
                    <CircleCheck size={16} aria-hidden="true" className="staff-summary-icon" />
                    <div>
                        <div className="staff-summary-label">{since ? "Sessions, this assessment" : "Sessions"}</div>
                        <div className="staff-summary-value">
                            {of ? `${done} of ${of} done` : `${done} done`}
                            {!!of && (
                                <span className="staff-summary-bar" aria-hidden="true">
                                    <span
                                        className={`staff-summary-fill${done > of ? " over" : ""}`}
                                        style={{ width: `${Math.min(100, Math.round((done / of) * 100))}%` }}
                                    />
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
