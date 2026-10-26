import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { findUserIdsByUsername } from "@/lib/username";
import { removeUpload } from "@/lib/uploads";
import bcrypt from "bcryptjs";

// GET /api/employees/doctors/[id]
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const isAdmin = (session.user as { role?: string })?.role === "ADMIN";

    const { id } = await params;

    const doctor = await prisma.user.findFirst({
        where: { id, role: "DOCTOR" },
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            workingHours: true,
            status: true,
            color: true,
            pictureUrl: true,
            username: isAdmin,
            createdAt: true,
        },
    });

    if (!doctor) {
        return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
    }

    return NextResponse.json(doctor);
}

// PUT /api/employees/doctors/[id] — update doctor
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session || (session.user as { role: string }).role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { name, email, phone, workingHours, username, password, color, pictureUrl, status, adminPassword, canManageContent } = body;

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (workingHours !== undefined) updateData.workingHours = workingHours;
    if (username !== undefined) {
        const trimmed = typeof username === "string" ? username.trim() : "";
        if (!trimmed) {
            return NextResponse.json(
                { error: "Username is required" },
                { status: 400 }
            );
        }
        // Taken in any case by anyone else, the same rule as creating an
        // account, since sign-in ignores case. Their own id is excluded, so
        // changing only the case of their own username is allowed. (TJ-060)
        const takenByOther = (await findUserIdsByUsername(trimmed)).some((other) => other !== id);
        if (takenByOther) {
            return NextResponse.json(
                { error: "Username already taken" },
                { status: 409 }
            );
        }
        updateData.username = trimmed;
    }
    if (color !== undefined) {
        // Exclude the doctor being edited, or saving any other field would
        // reject the colour they already hold.
        if (color) {
            const clash = await prisma.user.findFirst({
                where: { role: "DOCTOR", status: "ACTIVE", color, id: { not: id } },
                select: { name: true },
            });
            if (clash) {
                return NextResponse.json(
                    { error: `That colour is already used by ${clash.name}` },
                    { status: 409 }
                );
            }
        }
        updateData.color = color;
    }
    // prisma.update returns the new row, not the old one, so the previous
    // picture has to be read before the write or it is unrecoverable. Read it
    // only when the picture is actually in play, so that renames and phone
    // edits cost no extra query.
    let previousPicture: string | null = null;
    if (pictureUrl !== undefined) {
        const before = await prisma.user.findUnique({
            where: { id },
            select: { pictureUrl: true },
        });
        previousPicture = before?.pictureUrl ?? null;
        updateData.pictureUrl = pictureUrl;
    }
    if (status !== undefined) updateData.status = status;
    // Only ADMIN reaches this handler at all — the guard at the top of PUT is
    // the gate, and the column is inert for an ADMIN anyway (permissions.ts
    // short-circuits on role), so no one can revoke their own access here.
    // Coerced rather than passed through: a JSON body could carry a string.
    if (canManageContent !== undefined) {
        updateData.canManageContent = canManageContent === true;
    }
    if (password) {
        if (password.length < 8) {
            return NextResponse.json(
                { error: "Password must be at least 8 characters" },
                { status: 400 }
            );
        }

        // Re-authenticate the acting admin before overwriting someone else's
        // credential. The id comes from the session, never from the body, and
        // auth.ts re-reads the account on every session read — so this cannot
        // be pointed at another user by tampering with the request.
        if (!adminPassword) {
            return NextResponse.json(
                { error: "Enter your own password to confirm this change" },
                { status: 400 }
            );
        }
        const actingAdminId = (session.user as { id?: string }).id;
        const actingAdmin = actingAdminId
            ? await prisma.user.findUnique({
                where: { id: actingAdminId },
                select: { passwordHash: true },
            })
            : null;
        if (!actingAdmin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const adminPasswordOk = await bcrypt.compare(adminPassword, actingAdmin.passwordHash);
        if (!adminPasswordOk) {
            return NextResponse.json(
                { error: "Your password is incorrect" },
                { status: 403 }
            );
        }

        updateData.passwordHash = await bcrypt.hash(password, 12);
    }

    const doctor = await prisma.user.update({
        where: { id },
        data: updateData,
    });

    // Only after the row is safely updated, and only when the value genuinely
    // changed. These forms re-post the current pictureUrl on every save, so
    // without the inequality check an ordinary rename would delete the photo
    // the row still points at. removeUpload never throws: a storage failure
    // leaks an object and logs, it does not fail this request.
    if (previousPicture && previousPicture !== pictureUrl) {
        await removeUpload(previousPicture);
    }

    return NextResponse.json({ id: doctor.id, name: doctor.name, message: "Doctor updated" });
}

// DELETE /api/employees/doctors/[id]
//   default        → soft delete (set status to RESIGNED)
//   ?hard=true     → permanent removal; reservations/notes survive with the
//                    doctor's name snapshotted, refused only if a public
//                    profile is still linked
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session || (session.user as { role: string }).role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const hard = req.nextUrl.searchParams.get("hard") === "true";

    if (!hard) {
        // Soft delete — set status to RESIGNED instead of permanent deletion
        await prisma.user.update({
            where: { id },
            data: { status: "RESIGNED" },
        });

        return NextResponse.json({ message: "Doctor marked as resigned" });
    }

    // Hard delete. Reservations and notes are clinical/scheduling records that
    // belong to the patient and the clinic, not to the doctor's employment —
    // deleting the doctor must not delete or reassign them. Reservation.doctorId
    // and Note.doctorId are nullable with onDelete: SetNull, and their name (and,
    // for reservations, calendar colour) is snapshotted onto every row just
    // before the doctor goes, so they keep reading correctly on the calendar and
    // notes list afterward. DoctorProfile.userId is still RESTRICT — a linked
    // public profile blocks this until it is hard-deleted separately (TJ-025).
    const doctor = await prisma.user.findFirst({
        where: { id, role: "DOCTOR" },
        select: {
            name: true,
            color: true,
            pictureUrl: true,
            doctorProfile: { select: { id: true } },
            files: { select: { filePath: true } },
        },
    });

    if (!doctor) {
        return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
    }

    if (doctor.doctorProfile) {
        return NextResponse.json(
            { error: `Cannot delete ${doctor.name}: they have a linked public profile. Delete that first.` },
            { status: 409 }
        );
    }

    await prisma.$transaction([
        prisma.reservation.updateMany({
            where: { doctorId: id },
            data: { doctorNameSnapshot: doctor.name, doctorColorSnapshot: doctor.color },
        }),
        prisma.note.updateMany({
            where: { doctorId: id },
            data: { doctorNameSnapshot: doctor.name },
        }),
        prisma.user.delete({ where: { id } }),
    ]);

    // Only after the row is safely gone. EmployeeFile rows have already
    // cascaded away in the transaction above — their storage objects have not,
    // which is exactly the leak this cleans up. removeUpload never throws.
    if (doctor.pictureUrl) {
        await removeUpload(doctor.pictureUrl);
    }
    for (const file of doctor.files) {
        await removeUpload(file.filePath, "clinical-files");
    }

    return NextResponse.json({ message: "Doctor deleted permanently" });
}
