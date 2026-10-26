import "server-only";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import { findUserIdsByUsername } from "@/lib/username";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export const { handlers, signIn, signOut, auth } = NextAuth({
    ...authConfig,
    callbacks: {
        ...authConfig.callbacks,
        // Re-check the account on every server-side session read. authorize()
        // only runs at sign-in, so without this a user marked RESIGNED keeps a
        // valid session until the token expires — up to 8 hours of access after
        // being removed. Returning null revokes the session and clears the
        // cookie (see @auth/core session action), so they are signed out rather
        // than merely denied.
        //
        // This lives here and not in auth.config.ts on purpose: that file is
        // imported by Edge middleware and must stay free of Prisma.
        async jwt({ token, user }) {
            if (user) {
                // Sign-in. authorize() has already proved the account is ACTIVE.
                token.role = (user as { role: string }).role;
                token.canManageContent = (user as { canManageContent?: boolean }).canManageContent === true;
                token.id = user.id;
                return token;
            }

            const userId = (token.id as string | undefined) ?? token.sub;
            if (!userId) return null;

            // A failed lookup is not a revoked account. Letting it throw
            // signs the user out: @auth/core's session action catches the
            // error and clears the session cookie, exactly as it does for
            // a null return. So a full pooler or a database blip would sign
            // out every staff member whose tab refetches the session, and
            // they could not sign back in for the same reason. Keep the
            // session instead; the next read that reaches the database
            // re-checks it. Every route that serves clinic data needs that
            // same database, so a resigned user gains nothing meanwhile.
            // (TJ-063a)
            let current: { status: string } | null;
            try {
                current = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { status: true },
                });
            } catch (err) {
                console.error("[auth] status check failed; keeping the session:", err);
                return token;
            }
            if (!current || current.status !== "ACTIVE") return null;

            return token;
        },
    },
    providers: [
        Credentials({
            name: "credentials",
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.username || !credentials?.password) {
                    return null;
                }

                // A username signs in in any case: a phone that capitalises
                // the first letter must not shut anyone out. Should two
                // accounts ever differ only by case, only the exact spelling
                // signs in — never a guess between two people. (TJ-060)
                const typed = credentials.username as string;
                const ids = await findUserIdsByUsername(typed);
                const user = ids.length === 1
                    ? await prisma.user.findUnique({ where: { id: ids[0] } })
                    : await prisma.user.findUnique({ where: { username: typed } });

                if (!user) return null;
                if (user.status !== "ACTIVE") return null;

                // Locked out from too many recent bad passwords. Rejected the same
                // way as a wrong password — the login page shows one generic
                // message either way, so a lockout isn't distinguishable to
                // whoever is trying. (TJ-024)
                if (user.lockedUntil && user.lockedUntil > new Date()) {
                    return null;
                }

                const passwordMatch = await bcrypt.compare(
                    credentials.password as string,
                    user.passwordHash
                );

                if (!passwordMatch) {
                    const attempts = user.failedLoginAttempts + 1;
                    const lockingOut = attempts >= MAX_LOGIN_ATTEMPTS;
                    await prisma.user.update({
                        where: { id: user.id },
                        data: {
                            failedLoginAttempts: lockingOut ? 0 : attempts,
                            lockedUntil: lockingOut
                                ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
                                : null,
                        },
                    });
                    return null;
                }

                if (user.failedLoginAttempts > 0 || user.lockedUntil) {
                    await prisma.user.update({
                        where: { id: user.id },
                        data: { failedLoginAttempts: 0, lockedUntil: null },
                    });
                }

                return {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    canManageContent: user.canManageContent,
                };
            },
        }),
    ],
});
