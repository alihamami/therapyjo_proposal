import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { findUserIdsByUsername } from "@/lib/username";
import { removeUpload } from "@/lib/uploads";
import bcrypt from "bcryptjs";

// GET /api/employees/secretaries/[id]
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

    const secretary = await prisma.user.findFirst({
        where: { id, role: "SECRETARY" },
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            workingHours: true,
            status: true,
            pictureUrl: true,
            username: isAdmin,
            createdAt: true,
        },
    });

    if (!secretary) {
        return NextResponse.json({ error: "Secretary not found" }, { status: 404 });
    }

    return NextResponse.json(secretary);
}

// PUT /api/employees/secretaries/[id]
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
    const { name, email, phone, workingHours, username, password, pictureUrl, status, adminPassword, canManageContent } = body;

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

    const secretary = await prisma.user.update({
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

    return NextResponse.json({ id: secretary.id, name: secretary.name, message: "Secretary updated" });
}

// DELETE /api/employees/secretaries/[id]
//   default        → soft delete (set status to RESIGNED)
//   ?hard=true     → permanent removal, refused only if a public profile is
//                    still linked
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

        return NextResponse.json({ message: "Secretary marked as resigned" });
    }

    // Hard delete. The foreign keys that point at User are not role-aware, so a
    // secretary can in principle hold reservations or notes even though no UI
    // flow creates them that way — check rather than assume. Reservations and
    // notes are now nullable/SET NULL (see the doctor route for why), so they
    // are no longer blockers for anyone; DoctorProfile.userId is still RESTRICT
    // and would leave a live public profile silently unlinked, so that is
    // refused. EmployeeFile cascades in the DB — its storage objects do not,
    // which is what the removeUpload calls below clean up.
    const secretary = await prisma.user.findFirst({
        where: { id, role: "SECRETARY" },
        select: {
            name: true,
            pictureUrl: true,
            doctorProfile: { select: { id: true } },
            files: { select: { filePath: true } },
        },
    });

    if (!secretary) {
        return NextResponse.json({ error: "Secretary not found" }, { status: 404 });
    }

    if (secretary.doctorProfile) {
        return NextResponse.json(
            { error: `Cannot delete ${secretary.name}: they have a linked public profile. Delete that first.` },
            { status: 409 }
        );
    }

    await prisma.user.delete({ where: { id } });

    if (secretary.pictureUrl) {
        await removeUpload(secretary.pictureUrl);
    }
    for (const file of secretary.files) {
        await removeUpload(file.filePath, "clinical-files");
    }

    return NextResponse.json({ message: "Secretary deleted permanently" });
}
