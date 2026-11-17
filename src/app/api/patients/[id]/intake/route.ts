import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canAccessClinical } from "@/lib/permissions";
import { logPatientActivity } from "@/lib/audit";

// GET /api/patients/[id]/intake — get clinical intake
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canAccessClinical(session.user)) {
        return NextResponse.json({ error: "Not permitted to view clinical records" }, { status: 403 });
    }

    const { id } = await params;
    const patientId = parseInt(id, 10);
    if (isNaN(patientId)) {
        return NextResponse.json({ error: "Invalid patient ID" }, { status: 400 });
    }

    const intake = await prisma.clinicalIntake.findUnique({
        where: { patientId },
    });

    return NextResponse.json(intake || {});
}

// PUT /api/patients/[id]/intake — create or update clinical intake
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Same predicate as the GET above, so read and write cannot drift apart.
    if (!canAccessClinical(session.user)) {
        return NextResponse.json({ error: "Secretaries cannot edit clinical intake" }, { status: 403 });
    }

    const { id } = await params;
    const patientId = parseInt(id, 10);
    if (isNaN(patientId)) {
        return NextResponse.json({ error: "Invalid patient ID" }, { status: 400 });
    }

    const body = await req.json();
    // Free text since TJ-067a ("March 2024"). A tab opened before that deploy
    // still posts the old date field, so take it rather than blank the value.
    const since = body.patientSince ?? body.enrollDate;
    const data = {
        injuryPlace: body.injuryPlace ?? null,
        patientSince: typeof since === "string" && since.trim() ? since.trim() : null,
        medicalHistory: body.medicalHistory ?? null,
        assessment: body.assessment ?? null,
        aggravators: body.aggravators ?? null,
        relievers: body.relievers ?? null,
        diagnosis: body.diagnosis ?? null,
        treatmentPlan: body.treatmentPlan ?? null,
        recommendedSessions: body.recommendedSessions ? parseInt(body.recommendedSessions, 10) : null,
        clinicExercises: body.clinicExercises ?? null,
        homeExercises: body.homeExercises ?? null,
        nextSessionTreatment: body.nextSessionTreatment ?? null,
    };

    const intake = await prisma.clinicalIntake.upsert({
        where: { patientId },
        update: { ...data, updatedById: session.user.id },
        create: { patientId, ...data, updatedById: session.user.id },
    });

    await logPatientActivity({
        patientId,
        userId: session.user.id,
        action: "CLINICAL_INTAKE_UPDATED",
    });

    return NextResponse.json(intake);
}
