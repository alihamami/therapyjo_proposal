import type { Session } from "next-auth";
import { firstHiddenScheduleDay } from "@/lib/clinicHours";

/**
 * May this user manage public content — Blog posts, public Doctor profiles,
 * and the Approvals queue?
 *
 * The rule lives here rather than inline at each handler so it can be granted
 * without a code change at every call site. ADMIN always holds it; anyone else
 * holds it only if their User.canManageContent column is set (TJ-005b1).
 */
export function canManageContent(
    user: Session["user"] | undefined | null
): boolean {
    if (!user) return false;
    return user.role === "ADMIN" || user.canManageContent === true;
}

/**
 * May this user see and edit clinical records — the ClinicalIntake (diagnosis,
 * assessment, medical history, treatment plan) and per-session SOAP notes?
 *
 * ADMIN and DOCTOR may; SECRETARY may not. Front-desk staff book, register and
 * file for patients, and that does not require reading their diagnosis.
 *
 * This covers reading as well as writing, and the reading half is the point:
 * the two PUT handlers have refused secretaries since they were written, but
 * the GET handlers served the same records to anyone signed in, so the data
 * reached the browser and only the UI declined to draw it. (TJ-023)
 */
export function canAccessClinical(
    user: Session["user"] | undefined | null
): boolean {
    if (!user) return false;
    return user.role === "ADMIN" || user.role === "DOCTOR";
}

/**
 * May this user permanently delete a reservation?
 *
 * ADMIN and SECRETARY may; DOCTOR may not. Front-desk staff own the booking
 * calendar and must be able to remove a session booked in error without
 * finding an admin. Doctors record what happened in a session and do not
 * decide whether it exists — they cancel via PATCH status=CANCELLED.
 *
 * Deletion is permanent and is recorded against the patient's audit log with
 * the acting user's id, so "who removed this" stays answerable. (TJ-040)
 */
export function canDeleteReservation(
    user: Session["user"] | undefined | null
): boolean {
    if (!user) return false;
    return user.role === "ADMIN" || user.role === "SECRETARY";
}

/**
 * May this user change a patient's record — register a new patient, edit
 * their details (name, phones, photo), archive or restore them, or remove a
 * file from them?
 *
 * ADMIN and SECRETARY may; DOCTOR may not. A doctor's writes to a patient are
 * the Clinical Assessment (see canAccessClinical) and attaching files, and
 * nothing else. User decision, 2026-09-28. Like the WRITE_ROLES lists this
 * replaces, it names the roles that may, so a role added later is refused
 * until someone decides otherwise. (TJ-054)
 */
export function canManagePatients(
    user: Session["user"] | undefined | null
): boolean {
    if (!user) return false;
    return user.role === "ADMIN" || user.role === "SECRETARY";
}

/**
 * May this user be sent a patient's phone numbers?
 *
 * ADMIN and SECRETARY may; DOCTOR may not. The front desk books, confirms and
 * chases patients by phone; a doctor treats the patient in the room and does
 * not need to hold their number. User decision, 2026-09-28.
 *
 * Enforced where the data leaves the server, not in the UI, for the same
 * reason as canAccessClinical: a number that reaches the browser is one
 * devtools tab away whether or not a screen draws it. A doctor may still
 * SEARCH by a number they already hold — the match returns the patient's
 * name, never the number back. (TJ-054)
 */
export function canViewPatientContact(
    user: Session["user"] | undefined | null
): boolean {
    if (!user) return false;
    return user.role === "ADMIN" || user.role === "SECRETARY";
}

/**
 * May this user change this session — its status, its details, or its SOAP
 * note?
 *
 * ADMIN and SECRETARY may change any session, as before. A DOCTOR may change
 * only a session booked under them: a colleague's session, and one whose
 * doctor was hard-deleted (doctorId null), are read-only to every doctor.
 * Reading is not restricted here — a doctor may still read a colleague's
 * session and SOAP note — and a secretary still may not touch a SOAP note
 * (canAccessClinical, checked separately). User decision, 2026-10-12. (TJ-062)
 */
export function canWriteSession(
    user: Session["user"] | undefined | null,
    sessionDoctorId: string | null
): boolean {
    if (!user) return false;
    if (user.role === "ADMIN" || user.role === "SECRETARY") return true;
    return user.role === "DOCTOR" && sessionDoctorId !== null && sessionDoctorId === user.id;
}

/**
 * From which instant are sessions hidden from this user? null means none are.
 *
 * ADMIN and SECRETARY see every day: they book and run the calendar. Anyone
 * else, which today means DOCTOR, sees a day only once it has opened: every
 * past day, today from SCHEDULE_OPEN_HOUR:SCHEDULE_OPEN_MINUTE Amman time, and
 * no later day at all (src/lib/clinicHours.ts). Like the helpers above, it
 * names the roles that may, so a role added later is held back until someone
 * decides otherwise.
 *
 * Compare it against Reservation.sessionDate with `lt`. Every write path
 * stores that column as `new Date("YYYY-MM-DD")`, UTC midnight of its day, and
 * this returns UTC midnight of the first hidden day. User decision,
 * 2026-10-26. (TJ-064)
 */
export function sessionsHiddenFrom(
    user: Session["user"] | undefined | null,
    now: Date = new Date()
): Date | null {
    if (user && (user.role === "ADMIN" || user.role === "SECRETARY")) return null;
    return new Date(firstHiddenScheduleDay(now));
}
