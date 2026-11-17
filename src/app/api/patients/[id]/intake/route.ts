import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canAccessClinical } from "@/lib/permissions";
import { logPatientActivity } from "@/lib/audit";

// A patient may have several clinical assessments, one per injury or course
// of treatment, each a ClinicalIntake row. Screens number them by position in
// id order, so "Assessment 1" is the oldest. (TJ-067b)

// What the form posts. Every field is optional; an empty string clears it.
interface IntakeBody {
    intakeId?: number | string | null;
    injuryPlace?: string | null;
    patientSince?: string | null;
    enrollDate?: string | null; // sent by tabs opened before TJ-067a; see intakeData()
    medicalHistory?: string | null;
    assessment?: string | null;
    aggravators?: string | null;
    relievers?: string | null;
    diagnosis?: string | null;
    treatmentPlan?: string | null;
    recommendedSessions?: number | string | null;
    clinicExercises?: string | null;
    homeExercises?: string | null;
    nextSessionTreatment?: string | null;
}

// The editable fields, read the same way by POST and PUT.
function intakeData(body: IntakeBody) {
    // Free text since TJ-067a ("March 2024"). A tab opened before that deploy
    // still posts the old date field, so take it rather than blank the value.
    const since = body.patientSince ?? body.enrollDate;
    const sessions = body.recommendedSessions ? parseInt(String(body.recommendedSessions), 10) : NaN;
    return {
        injuryPlace: body.injuryPlace ?? null,
        patientSince: typeof since === "string" && since.trim() ? since.trim() : null,
        medicalHistory: body.medicalHistory ?? null,
        assessment: body.assessment ?? null,
        aggravators: body.aggravators ?? null,
        relievers: body.relievers ?? null,
        diagnosis: body.diagnosis ?? null,
        treatmentPlan: body.treatmentPlan ?? null,
        recommendedSessions: Number.isNaN(sessions) ? null : sessions,
        clinicExercises: body.clinicExercises ?? null,
        homeExercises: body.homeExercises ?? null,
        nextSessionTreatment: body.nextSessionTreatment ?? null,
    };
}

// "Assessment N" for the History tab: the row's position among this
// patient's assessments, oldest first.
async function assessmentLabel(patientId: number, intakeId: number) {
    const n = await prisma.clinicalIntake.count({ where: { patientId, id: { lte: intakeId } } });
    return `Assessment ${n}`;
}

// GET /api/patients/[id]/intake — every assessment for this patient, oldest first
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

    const intakes = await prisma.clinicalIntake.findMany({
        where: { patientId },
        orderBy: { id: "asc" },
    });

    return NextResponse.json(intakes);
}

// POST /api/patients/[id]/intake — start a new assessment for this patient
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Same predicate as GET, so read and write cannot drift apart.
    if (!canAccessClinical(session.user)) {
        return NextResponse.json({ error: "Secretaries cannot edit clinical intake" }, { status: 403 });
    }

    const { id } = await params;
    const patientId = parseInt(id, 10);
    if (isNaN(patientId)) {
        return NextResponse.json({ error: "Invalid patient ID" }, { status: 400 });
    }

    const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { id: true } });
    if (!patient) {
        return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    const body: IntakeBody = await req.json();
    const intake = await prisma.clinicalIntake.create({
        data: { patientId, ...intakeData(body), updatedById: session.user.id },
    });

    await logPatientActivity({
        patientId,
        userId: session.user.id,
        action: "CLINICAL_INTAKE_ADDED",
        summary: await assessmentLabel(patientId, intake.id),
    });

    return NextResponse.json(intake, { status: 201 });
}

// PUT /api/patients/[id]/intake — update one assessment, named by intakeId in
// the body. Without an intakeId it updates the latest, or creates the first:
// that is how this endpoint behaved before TJ-067b, and how a tab opened
// before that deploy still calls it.
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Same predicate as GET, so read and write cannot drift apart.
    if (!canAccessClinical(session.user)) {
        return NextResponse.json({ error: "Secretaries cannot edit clinical intake" }, { status: 403 });
    }

    const { id } = await params;
    const patientId = parseInt(id, 10);
    if (isNaN(patientId)) {
        return NextResponse.json({ error: "Invalid patient ID" }, { status: 400 });
    }

    const body: IntakeBody = await req.json();
    const data = { ...intakeData(body), updatedById: session.user.id };

    let targetId: number | null = null;
    if (body.intakeId != null && body.intakeId !== "") {
        const intakeId = Number(body.intakeId);
        if (!Number.isInteger(intakeId)) {
            return NextResponse.json({ error: "Invalid assessment ID" }, { status: 400 });
        }
        // Scoped to this patient, so one patient's URL cannot edit another's assessment.
        const target = await prisma.clinicalIntake.findFirst({
            where: { id: intakeId, patientId },
            select: { id: true },
        });
        if (!target) {
            return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
        }
        targetId = target.id;
    } else {
        const latest = await prisma.clinicalIntake.findFirst({
            where: { patientId },
            orderBy: { id: "desc" },
            select: { id: true },
        });
        targetId = latest?.id ?? null;
    }

    const intake = targetId !== null
        ? await prisma.clinicalIntake.update({ where: { id: targetId }, data })
        : await prisma.clinicalIntake.create({ data: { patientId, ...data } });

    await logPatientActivity({
        patientId,
        userId: session.user.id,
        action: "CLINICAL_INTAKE_UPDATED",
        summary: await assessmentLabel(patientId, intake.id),
    });

    return NextResponse.json(intake);
}
