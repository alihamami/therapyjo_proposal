import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canViewPatientContact, sessionsHiddenFrom } from "@/lib/permissions";
import { logPatientActivity } from "@/lib/audit";
import { checkClinicWindow } from "@/lib/clinicHours";

// GET /api/reservations?date=YYYY-MM-DD&doctorId=xxx
export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get("date");
    const doctorId = searchParams.get("doctorId");
    const patientId = searchParams.get("patientId");
    // For DatePicker: get counts for a full month
    const monthStr = searchParams.get("month"); // YYYY-MM format
    // A doctor's schedule and session history carry the patient's name but
    // not their numbers. (TJ-054)
    const contact = canViewPatientContact(session.user);
    // A doctor is sent no session on a day that has not opened yet. All three
    // modes below cap sessionDate here, so the day view, the patient history
    // and the date picker's counts agree. null for admin and secretary. (TJ-064)
    const hiddenFrom = sessionsHiddenFrom(session.user);

    // Month counts mode: returns { "2026-02-01": 3, "2026-02-02": 1, ... }
    if (monthStr) {
        const [year, month] = monthStr.split("-").map(Number);
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

        const reservations = await prisma.reservation.findMany({
            where: {
                sessionDate: { gte: startOfMonth, lte: endOfMonth, ...(hiddenFrom && { lt: hiddenFrom }) },
                ...(doctorId && { doctorId }),
            },
            select: { sessionDate: true },
        });

        const counts: Record<string, number> = {};
        for (const r of reservations) {
            const key = r.sessionDate.toISOString().split("T")[0];
            counts[key] = (counts[key] || 0) + 1;
        }

        return NextResponse.json({ counts });
    }

    // Patient-only mode: all sessions for a patient (no date filter)
    if (!dateStr && patientId) {
        const reservations = await prisma.reservation.findMany({
            where: { patientId: parseInt(patientId, 10), ...(hiddenFrom && { sessionDate: { lt: hiddenFrom } }) },
            include: {
                patient: { select: { id: true, name: true, phone1: contact, phone2: contact } },
                doctor: { select: { id: true, name: true, color: true } },
            },
            orderBy: { sessionDate: "desc" },
        });
        return NextResponse.json(reservations);
    }

    // Day view mode
    if (!dateStr) {
        return NextResponse.json({ error: "date, month, or patientId parameter required" }, { status: 400 });
    }

    const date = new Date(dateStr + "T00:00:00");
    const nextDay = new Date(dateStr + "T23:59:59.999");

    const where = {
        sessionDate: { gte: date, lte: nextDay, ...(hiddenFrom && { lt: hiddenFrom }) },
        ...(doctorId && doctorId !== "all" && { doctorId }),
        ...(patientId && { patientId: parseInt(patientId, 10) }),
    };

    const reservations = await prisma.reservation.findMany({
        where,
        include: {
            patient: { select: { id: true, name: true, phone1: contact, phone2: contact } },
            doctor: { select: { id: true, name: true, color: true } },
        },
        orderBy: { sessionTime: "asc" },
    });

    return NextResponse.json(reservations);
}

// POST /api/reservations — create reservation (existing patient only)
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as { role?: string })?.role;
    if (role === "DOCTOR") {
        return NextResponse.json({ error: "Doctors cannot create reservations" }, { status: 403 });
    }

    const body = await req.json();
    const {
        patientId,
        doctorId,
        sessionDate,
        sessionTime,
        note,
        showNoteOnCalendar,
        nextSessionNote,
        paymentType,
        isTwoHours,
    } = body;

    if (!patientId || !doctorId || !sessionDate || !sessionTime) {
        return NextResponse.json(
            { error: "patientId, doctorId, sessionDate, and sessionTime are required" },
            { status: 400 }
        );
    }

    const windowCheck = checkClinicWindow(sessionTime, Boolean(isTwoHours));
    // `=== false` and not `!ok`: this project compiles with "strict": false,
    // where TypeScript does not narrow a discriminated union through
    // truthiness on the discriminant. Verified both ways. (TJ-047a)
    if (windowCheck.ok === false) {
        return NextResponse.json({ error: windowCheck.error }, { status: 400 });
    }

    // Verify patient exists
    const patient = await prisma.patient.findUnique({ where: { id: parseInt(patientId, 10) } });
    if (!patient) {
        return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    const reservation = await prisma.reservation.create({
        data: {
            patientId: parseInt(patientId, 10),
            doctorId,
            sessionDate: new Date(sessionDate),
            sessionTime: new Date(`${sessionDate}T${sessionTime}`),
            note: note || null,
            showNoteOnCalendar: Boolean(showNoteOnCalendar),
            nextSessionNote: nextSessionNote || null,
            paymentType: paymentType || null,
            isTwoHours: Boolean(isTwoHours),
        },
        include: {
            patient: { select: { id: true, name: true, phone1: true } },
            doctor: { select: { id: true, name: true, color: true } },
        },
    });

    await logPatientActivity({
        patientId: reservation.patientId,
        userId: session.user.id,
        action: "SESSION_CREATED",
        summary: `Booked with ${reservation.doctor?.name ?? "a doctor"} on ${sessionDate}`,
    });

    return NextResponse.json(reservation, { status: 201 });
}
