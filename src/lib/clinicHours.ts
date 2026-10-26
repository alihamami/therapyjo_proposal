// The clinic's opening window. A session may start at 07:00 at the earliest
// and must end by 19:00 — so the latest one-hour start is 18:00 and the latest
// two-hour start is 17:00.
//
// Checked as plain numbers before any Date is constructed: sessionTime arrives
// as "HH:MM" and the server runs TZ=Asia/Amman while the browser does not, so
// parsing first would make this check disagree with itself for any staff
// member outside Amman. (TJ-042a; extracted here by TJ-047a so that every
// booking write path refuses in the same words.)
//
// Not to be confused with src/lib/workingHours.ts, which parses a *doctor's*
// personal hours from User.workingHours. This is the building's window and
// applies to every reservation, whoever it belongs to.
export const CLINIC_OPEN_HOUR = 7;
export const CLINIC_CLOSE_HOUR = 19;

export type ClinicWindowResult = { ok: true } | { ok: false; error: string };

/**
 * Checks an "HH:MM" start against the clinic window for a session of the given
 * length. Both failure messages are the ones POST /api/reservations already
 * returned before this helper existed, so no caller's wording changes.
 */
export function checkClinicWindow(
    sessionTime: unknown,
    isTwoHours: boolean
): ClinicWindowResult {
    const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(String(sessionTime));
    if (!timeMatch) {
        return { ok: false, error: "sessionTime must be in HH:MM format" };
    }
    const startMinutes = Number(timeMatch[1]) * 60 + Number(timeMatch[2]);
    const endMinutes = startMinutes + (isTwoHours ? 120 : 60);
    if (startMinutes < CLINIC_OPEN_HOUR * 60 || endMinutes > CLINIC_CLOSE_HOUR * 60) {
        return {
            ok: false,
            error: `The clinic is open ${CLINIC_OPEN_HOUR}:00–${CLINIC_CLOSE_HOUR}:00. A ${isTwoHours ? "two-hour" : "one-hour"} session must start between ${CLINIC_OPEN_HOUR}:00 and ${String(CLINIC_CLOSE_HOUR - (isTwoHours ? 2 : 1)).padStart(2, "0")}:00.`,
        };
    }
    return { ok: true };
}

// When each day's schedule opens to doctors, in Amman time. Before it a doctor
// sees every day up to yesterday; from it, today as well; no later day, ever.
// Admin and secretary see every day at any time (sessionsHiddenFrom in
// src/lib/permissions.ts). User decision, 2026-10-26: 09:30, although a
// session may start as early as CLINIC_OPEN_HOUR. (TJ-064)
export const SCHEDULE_OPEN_HOUR = 9;
export const SCHEDULE_OPEN_MINUTE = 30;
export const SCHEDULE_OPEN_LABEL = "9:30 AM";

/**
 * The first calendar day, as "YYYY-MM-DD", that a doctor may not see yet.
 *
 * Read in Asia/Amman explicitly rather than from the process timezone, as
 * src/instrumentation.ts asks of every new "today" boundary, so the server
 * and a doctor's browser agree wherever either one runs.
 */
export function firstHiddenScheduleDay(now: Date = new Date()): string {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Amman",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).formatToParts(now);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const opened =
        get("hour") * 60 + get("minute") >= SCHEDULE_OPEN_HOUR * 60 + SCHEDULE_OPEN_MINUTE;
    // Date.UTC rolls the 32nd into the next month, and December into January.
    const day = new Date(Date.UTC(get("year"), get("month") - 1, get("day") + (opened ? 1 : 0)));
    return day.toISOString().split("T")[0];
}
