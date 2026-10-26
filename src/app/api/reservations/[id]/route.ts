import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canAccessClinical, canDeleteReservation, canViewPatientContact, canWriteSession, sessionsHiddenFrom } from "@/lib/permissions";
import { logPatientActivity } from "@/lib/audit";
import { checkClinicWindow } from "@/lib/clinicHours";

// Valid status transitions (state machine)
const VALID_TRANSITIONS: Record<string, string[]> = {
    SCHEDULED: ["CHECKED_IN", "WAITING", "CANCELLED", "NO_SHOW"],
    WAITING: ["CHECKED_IN", "CANCELLED"],
    CHECKED_IN: ["WITH_DOCTOR", "WAITING", "CANCELLED"],
    WITH_DOCTOR: ["CHECKED_OUT"],
    CHECKED_OUT: ["WITH_DOCTOR"], // revert only — undo a premature checkout
    CANCELLED: ["SCHEDULED"], // revert only — undo a cancellation
    NO_SHOW: ["SCHEDULED"], // revert only — undo a no-show
};

// GET /api/reservations/[id]
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const reservation = await prisma.reservation.findUnique({
        where: { id: parseInt(id, 10) },
        include: {
            patient: {
                // Numbers omitted for a doctor, like soapNote below for a
                // secretary. (TJ-054)
                select: {
                    id: true,
                    name: true,
                    phone1: canViewPatientContact(session.user),
                    phone2: canViewPatientContact(session.user),
                    archived: true,
                },
            },
            doctor: { select: { id: true, name: true, color: true } },
            soapNote: canAccessClinical(session.user),
        },
    });

    // A session on a day that has not opened yet is answered to a doctor as
    // missing, the same as one that does not exist. (TJ-064)
    const hiddenFrom = sessionsHiddenFrom(session.user);
    if (!reservation || (hiddenFrom && reservation.sessionDate >= hiddenFrom)) {
        return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    // Fetch previous session note for this patient
    const prevSession = await prisma.reservation.findFirst({
        where: {
            patientId: reservation.patientId,
            id: { not: reservation.id },
            sessionDate: { lt: reservation.sessionDate },
        },
        orderBy: { sessionDate: "desc" },
        select: { nextSessionNote: true, note: true, sessionDate: true },
    });

    return NextResponse.json({
        ...reservation,
        previousSessionNote: prevSession?.nextSessionNote || prevSession?.note || null,
        previousSessionDate: prevSession?.sessionDate || null,
    });
}

// PUT /api/reservations/[id] — update reservation details
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    // A doctor may change only a session booked under them. (TJ-062)
    const target = await prisma.reservation.findUnique({
        where: { id: parseInt(id, 10) },
        select: { doctorId: true, sessionDate: true },
    });
    // Nor may a doctor change a session they cannot see, as in GET. (TJ-064)
    const hiddenFrom = sessionsHiddenFrom(session.user);
    if (!target || (hiddenFrom && target.sessionDate >= hiddenFrom)) {
        return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }
    if (!canWriteSession(session.user, target.doctorId)) {
        return NextResponse.json({ error: "Doctors can only change their own sessions" }, { status: 403 });
    }

    // Doctors can update everything else about a session (injury place, note,
    // payment) but not when it happens or who it belongs to — only admin and
    // secretary reschedule or reassign.
    if (
        session.user.role === "DOCTOR" &&
        (body.sessionDate !== undefined || body.sessionTime !== undefined || body.doctorId !== undefined)
    ) {
        return NextResponse.json(
            { error: "Doctors cannot change a session's time or reassign it to another doctor" },
            { status: 403 }
        );
    }

    // The schedule lives in two columns and either half can arrive alone, so
    // refuse a half-move rather than guessing the other half: the old code
    // defaulted a missing date to "2000-01-01", and a missing time left
    // sessionTime carrying the previous date. Both wrote a row whose two
    // columns disagreed.
    const changesSchedule = body.sessionDate !== undefined || body.sessionTime !== undefined;
    if (changesSchedule && (body.sessionDate === undefined || body.sessionTime === undefined)) {
        return NextResponse.json(
            { error: "sessionDate and sessionTime must be sent together" },
            { status: 400 }
        );
    }

    // Any change to when the session starts, or to how long it runs, is
    // re-checked against the clinic window — against the values the row will
    // HAVE, not the ones it had. Flipping an 18:00 session to two hours pushes
    // its end to 20:00 and must be refused even though its start did not move.
    if (changesSchedule || body.isTwoHours !== undefined) {
        const existing = await prisma.reservation.findUnique({
            where: { id: parseInt(id, 10) },
            select: { sessionTime: true, isTwoHours: true },
        });
        if (!existing) {
            return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
        }
        const effectiveIsTwoHours =
            body.isTwoHours !== undefined ? Boolean(body.isTwoHours) : existing.isTwoHours;
        // Reading the stored start back with getHours/getMinutes is the exact
        // inverse of how POST wrote it (server-local, TZ=Asia/Amman per
        // next.config.mjs), so it round-trips whatever was stored without
        // reopening the browser/server timezone question.
        const storedStart = `${String(existing.sessionTime.getHours()).padStart(2, "0")}:${String(existing.sessionTime.getMinutes()).padStart(2, "0")}`;
        const windowCheck = checkClinicWindow(
            changesSchedule ? body.sessionTime : storedStart,
            effectiveIsTwoHours
        );
        // `=== false` and not `!ok`: this project compiles with "strict": false,
        // where TypeScript does not narrow a discriminated union through
        // truthiness on the discriminant. Verified both ways. (TJ-047a)
        if (windowCheck.ok === false) {
            return NextResponse.json({ error: windowCheck.error }, { status: 400 });
        }
    }

    const data: Record<string, unknown> = {};
    if (body.doctorId !== undefined) data.doctorId = body.doctorId;
    if (changesSchedule) {
        data.sessionDate = new Date(body.sessionDate);
        data.sessionTime = new Date(`${body.sessionDate}T${body.sessionTime}`);
    }
    if (body.note !== undefined) data.note = body.note;
    if (body.showNoteOnCalendar !== undefined) data.showNoteOnCalendar = Boolean(body.showNoteOnCalendar);
    if (body.nextSessionNote !== undefined) data.nextSessionNote = body.nextSessionNote;
    if (body.paymentType !== undefined) data.paymentType = body.paymentType;
    if (body.isTwoHours !== undefined) data.isTwoHours = Boolean(body.isTwoHours);
    if (body.isNote !== undefined) data.isNote = Boolean(body.isNote);
    if (body.injuryPlace !== undefined) data.injuryPlace = body.injuryPlace;

    const reservation = await prisma.reservation.update({
        where: { id: parseInt(id, 10) },
        data,
        include: {
            patient: { select: { id: true, name: true, phone1: canViewPatientContact(session.user) } },
            doctor: { select: { id: true, name: true, color: true } },
        },
    });

    await logPatientActivity({
        patientId: reservation.patientId,
        userId: session.user.id,
        action: "SESSION_UPDATED",
        summary: `Session with ${reservation.doctor?.name ?? reservation.doctorNameSnapshot ?? "a deleted doctor"} edited`,
    });

    return NextResponse.json(reservation);
}

// PATCH /api/reservations/[id] — status transition (state machine)
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { status: newStatus } = body;

    if (!newStatus) {
        return NextResponse.json({ error: "status is required" }, { status: 400 });
    }

    const reservation = await prisma.reservation.findUnique({
        where: { id: parseInt(id, 10) },
        select: { id: true, status: true, patientId: true, doctorId: true, sessionDate: true },
    });

    // Nor move one they cannot see, as in GET. (TJ-064)
    const hiddenFrom = sessionsHiddenFrom(session.user);
    if (!reservation || (hiddenFrom && reservation.sessionDate >= hiddenFrom)) {
        return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    // A doctor may move only a session booked under them. (TJ-062)
    if (!canWriteSession(session.user, reservation.doctorId)) {
        return NextResponse.json({ error: "Doctors can only change their own sessions" }, { status: 403 });
    }

    const allowedNext = VALID_TRANSITIONS[reservation.status] || [];
    if (!allowedNext.includes(newStatus)) {
        return NextResponse.json(
            { error: `Cannot transition from ${reservation.status} to ${newStatus}. Allowed: ${allowedNext.join(", ") || "none"}` },
            { status: 400 }
        );
    }

    // Set timestamps for status changes
    const timestamps: Record<string, unknown> = {};
    if (newStatus === "CHECKED_IN") timestamps.checkedInAt = new Date();
    // Guarded: reverting a checkout also lands on WITH_DOCTOR, and the session
    // really did start when it started — do not rewrite it with the undo time.
    if (newStatus === "WITH_DOCTOR" && reservation.status !== "CHECKED_OUT") {
        timestamps.withDoctorAt = new Date();
    }
    if (newStatus === "CHECKED_OUT") {
        timestamps.checkedOutAt = new Date();
        // Auto-update patient's lastVisitDate
        await prisma.patient.update({
            where: { id: reservation.patientId },
            data: { lastVisitDate: new Date() },
        });
    }

    // Undoing a checkout: drop the checkout stamp, then recompute the patient's
    // lastVisitDate from the sessions still checked out. Clearing it outright
    // would erase an earlier, legitimate visit.
    if (reservation.status === "CHECKED_OUT" && newStatus === "WITH_DOCTOR") {
        timestamps.checkedOutAt = null;
        const priorVisit = await prisma.reservation.findFirst({
            where: {
                patientId: reservation.patientId,
                status: "CHECKED_OUT",
                id: { not: reservation.id },
                checkedOutAt: { not: null },
            },
            orderBy: { checkedOutAt: "desc" },
            select: { checkedOutAt: true },
        });
        await prisma.patient.update({
            where: { id: reservation.patientId },
            data: { lastVisitDate: priorVisit?.checkedOutAt ?? null },
        });
    }

    // Returning to SCHEDULED means the session has not happened yet, so any
    // stamps left over from a check-in before the cancellation are now stale.
    if (newStatus === "SCHEDULED") {
        timestamps.checkedInAt = null;
        timestamps.withDoctorAt = null;
        timestamps.checkedOutAt = null;
    }

    const updated = await prisma.reservation.update({
        where: { id: parseInt(id, 10) },
        data: { status: newStatus, ...timestamps },
        include: {
            patient: { select: { id: true, name: true, phone1: canViewPatientContact(session.user) } },
            doctor: { select: { id: true, name: true, color: true } },
        },
    });

    await logPatientActivity({
        patientId: updated.patientId,
        userId: session.user.id,
        action: "SESSION_STATUS_CHANGED",
        summary: `${reservation.status} → ${newStatus}`,
    });

    return NextResponse.json(updated);
}

// DELETE /api/reservations/[id] — permanent removal (admin and secretary; use PATCH status=CANCELLED otherwise)
export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canDeleteReservation(session.user)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;

    const deleted = await prisma.reservation.delete({
        where: { id: parseInt(id, 10) },
        include: { doctor: { select: { name: true } } },
    });

    await logPatientActivity({
        patientId: deleted.patientId,
        userId: session.user.id,
        action: "SESSION_DELETED",
        summary: `Session with ${deleted.doctor?.name ?? deleted.doctorNameSnapshot ?? "a deleted doctor"} on ${deleted.sessionDate.toISOString().split("T")[0]}`,
    });

    return NextResponse.json({ message: "Reservation deleted" });
}
