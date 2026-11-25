"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

// Sessions are JWTs that quietly stop being valid after 8 hours (see maxAge
// in src/lib/auth.config.ts) — there is no server push telling the client
// the moment that happens. Left alone, a staff member who is still typing
// into a form gets no warning at all: the app's many "if (!res.ok)" guards
// either now fail loudly and separately (once the 401 fix in auth.config.ts
// lands) or, worse, silently stall. Rather than let 38 different call sites
// each invent their own explanation, this single component owns telling the
// user their session ended and giving them the one useful next step: sign
// in again. It is mounted once in providers.tsx, inside <SessionProvider>,
// so it covers admin, secretary and doctor areas without being wired into
// each layout individually.
//
// It has no business anywhere else — the public site and /login never had a
// session to lose, so it renders nothing off the staff paths.
export default function SessionExpiryNotice() {
    const pathname = usePathname();
    const router = useRouter();
    const { status } = useSession();
    const [expired, setExpired] = useState(false);

    const isProtected =
        pathname.startsWith("/admin") ||
        pathname.startsWith("/secretary") ||
        pathname.startsWith("/doctor");

    // The common case: next-auth's own SessionProvider refetches
    // /api/auth/session on window focus (and on its update interval) and
    // notices the session is gone on its own — we just need to react to it.
    //
    // BUT status also flips to "unauthenticated" for an entirely voluntary
    // sign-out: signOut({ callbackUrl: "/login" }) (admin/layout.tsx,
    // doctor/layout.tsx, secretary/layout.tsx all call it this way) clears
    // the client session first and only THEN navigates to /login. For the
    // moment in between, this component is still mounted on /admin,
    // /doctor or /secretary with status === "unauthenticated" — indistinguishable,
    // by that flag alone, from a real 8-hour expiry. Setting `expired`
    // synchronously here would flash "Your session has ended" at someone who
    // just clicked Sign Out on purpose.
    //
    // The two cases resolve differently a moment later: a voluntary sign-out
    // unmounts this component (the redirect lands) well inside a couple of
    // render frames, while a genuine expiry navigates nowhere — the user is
    // still sitting on the same protected page. So wait out a short grace
    // period before declaring the session expired; the redirect's cleanup
    // cancels the timer before it ever fires. 1500ms is comfortably longer
    // than a client-side router.push/redirect takes to unmount this tree
    // (that's normally well under 100ms), while still being short enough
    // that someone who is genuinely locked out is told promptly. Do not
    // remove this delay to "simplify" the effect — that reintroduces the
    // false-alarm-on-sign-out bug.
    useEffect(() => {
        if (!isProtected || status !== "unauthenticated") return;
        const timer = setTimeout(() => setExpired(true), 1500);
        return () => clearTimeout(timer);
    }, [isProtected, status]);

    // Belt-and-braces for a tab that sits hidden past the 8-hour mark without
    // ever losing window focus (background tab, phone screen lock, etc.) —
    // check directly the moment it becomes visible again instead of waiting
    // on useSession()'s own refetch timing. Deliberately not polling on any
    // interval: this only runs on the one event that means "the user is
    // looking again", which is the moment a stale session actually matters.
    useEffect(() => {
        if (!isProtected) return;

        const onVisible = async () => {
            if (document.visibilityState !== "visible") return;
            try {
                const res = await fetch("/api/auth/session");
                const data = await res.json().catch(() => null);
                if (!data?.user) setExpired(true);
            } catch {
                // A network hiccup is not a signed-out session — ignore it.
            }
        };

        document.addEventListener("visibilitychange", onVisible);
        return () => document.removeEventListener("visibilitychange", onVisible);
    }, [isProtected]);

    if (!isProtected || !expired) return null;

    const signInAgain = () => {
        router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
    };

    // The staff popup look (.staff-modal-* in globals.css), with no close
    // button: signing in again is the only way on. .staff-session-overlay
    // lifts it above any popup or confirmation that was open at the time.
    return (
        <div className="staff-modal-overlay staff-session-overlay">
            <div
                className="staff-modal"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="session-ended-title"
                aria-describedby="session-ended-text"
            >
                <div className="staff-modal-head">
                    <h2 id="session-ended-title" className="staff-modal-title">Your session has ended</h2>
                </div>
                <div className="staff-modal-body">
                    <p id="session-ended-text" className="staff-modal-text">
                        You were signed out automatically after 8 hours of inactivity.
                        Sign in again to continue.
                    </p>
                </div>
                <div className="staff-modal-foot">
                    <button type="button" className="staff-btn staff-btn-primary" onClick={signInAgain} autoFocus>
                        Sign in again
                    </button>
                </div>
            </div>
        </div>
    );
}
