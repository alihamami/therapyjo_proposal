import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canAccessClinical, canWriteSession, sessionsHiddenFrom } from "@/lib/permissions";
import { logPatientActivity } from "@/lib/audit";

// GET /api/reservations/[id]/soap — get SOAP note for a reservation
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canAccessClinical(session.user)) {
        return NextResponse.json({ error: "Not permitted to view clinical records" }, { status: 403 });
    }

    const { id } = await params;

    // A doctor cannot read the note of a session they cannot see. Admin skips
    // the lookup and keeps the old answer for a missing id. (TJ-064)
    const hiddenFrom = sessionsHiddenFrom(session.user);
    if (hiddenFrom) {
        const reservation = await prisma.reservation.findUnique({
            where: { id: parseInt(id, 10) },
            select: { sessionDate: true },
        });
        if (!reservation || reservation.sessionDate >= hiddenFrom) {
            return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
        }
    }

    const soap = await prisma.sOAPNote.findUnique({
        where: { reservationId: parseInt(id, 10) },
    });

    return NextResponse.json(soap || {});
}

// PUT /api/reservations/[id]/soap — create or update SOAP note
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Same predicate as the GET above, so read and write cannot drift apart.
    if (!canAccessClinical(session.user)) {
        return NextResponse.json({ error: "Secretaries cannot edit SOAP notes" }, { status: 403 });
    }

    const { id } = await params;
    const reservationId = parseInt(id, 10);
    const body = await req.json();

    const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
        select: { patientId: true, doctorId: true, sessionDate: true },
    });
    // Nor write one, as in GET. (TJ-064)
    const hiddenFrom = sessionsHiddenFrom(session.user);
    if (!reservation || (hiddenFrom && reservation.sessionDate >= hiddenFrom)) {
        return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }
    // A doctor may read a colleague's SOAP note but not write it. (TJ-062)
    if (!canWriteSession(session.user, reservation.doctorId)) {
        return NextResponse.json({ error: "Doctors can only change their own sessions" }, { status: 403 });
    }

    const data = {
        subjective: body.subjective ?? null,
        objective: body.objective ?? null,
        assessment: body.assessment ?? null,
        plan: body.plan ?? null,
        injuryPlace: body.injuryPlace ?? null,
    };

    const soap = await prisma.sOAPNote.upsert({
        where: { reservationId },
        update: data,
        create: { reservationId, ...data },
    });

    await logPatientActivity({
        patientId: reservation.patientId,
        userId: session.user.id,
        action: "SOAP_NOTE_UPDATED",
    });

    return NextResponse.json(soap);
}
