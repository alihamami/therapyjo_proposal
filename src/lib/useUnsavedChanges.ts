"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useConfirm, type ConfirmOptions } from "@/app/components/ConfirmDialog";

/**
 * Guards unsaved form text against being thrown away.
 *
 * `dirty` is computed by the caller — this hook does not know what a form is.
 * While it is true, the hook:
 * - warns on browser close/reload (the browser's own dialog);
 * - asks before an in-app link leaves the page (the menu bar, the brand, a
 *   link in the page), in the staff portal's dialog with the `leave` wording.
 *   App Router navigation fires no beforeunload, so a click on a <Link> used
 *   to throw the text away without a word (TJ-075);
 * - hands back an async `confirmDiscard()` the caller must await before any
 *   other action that would overwrite the form (a refetch) or leave the page.
 *
 * There is no autosave, by decision: a warning was judged enough. (TJ-022)
 * Not covered: the browser's own Back and Forward buttons, and Sign Out.
 */
export function useUnsavedChanges(dirty: boolean, leave?: ConfirmOptions) {
    // Kept in refs so the listeners are registered once and still read the
    // current values; re-binding on every keystroke would be wasteful.
    const dirtyRef = useRef(dirty);
    const leaveRef = useRef(leave);
    // Written in an effect, not during render: assigning to a ref while
    // rendering is what react-hooks/refs flags, and the rule is right —
    // a ref write does not re-render, so anything derived from it can go
    // stale. The listeners below read them, and only ever after paint.
    useEffect(() => {
        dirtyRef.current = dirty;
        leaveRef.current = leave;
    });

    useEffect(() => {
        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            if (!dirtyRef.current) return;
            // The browser shows its own generic wording; a custom message has
            // been ignored by every major browser for years. Both lines are
            // required for cross-browser coverage.
            e.preventDefault();
            e.returnValue = "";
        };
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, []);

    // Asks in the staff portal's own dialog (TJ-069b1); resolves true when
    // there is nothing to lose or the user chose to discard.
    const confirm = useConfirm();
    const confirmDiscard = useCallback(
        async (options: ConfirmOptions) =>
            !dirtyRef.current || confirm({ confirmLabel: "Discard changes", tone: "danger", ...options }),
        [confirm]
    );

    // In-app links (TJ-075). The listener sits on document in the capture
    // phase, so it runs before React's own click handling and can stop a
    // <Link> from navigating; after a yes, the router goes there instead.
    const router = useRouter();
    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (!dirtyRef.current || e.defaultPrevented || e.button !== 0) return;
            // A modified click opens a new tab or window: nothing is lost here.
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            const link = e.target instanceof Element ? e.target.closest("a[href]") : null;
            if (!(link instanceof HTMLAnchorElement)) return;
            if ((link.target && link.target !== "_self") || link.hasAttribute("download")) return;
            const url = new URL(link.href);
            // Another site unloads the page, so beforeunload already asks.
            if (url.origin !== window.location.origin) return;
            // A link to a spot on this same page loses nothing.
            if (url.pathname === window.location.pathname && url.search === window.location.search) return;
            e.preventDefault();
            // Also keeps a second guard on the same page from asking twice.
            e.stopImmediatePropagation();
            void confirm({
                title: "Leave without saving?",
                message: "Your unsaved changes will be lost.",
                confirmLabel: "Discard changes",
                tone: "danger",
                ...leaveRef.current,
            }).then((ok) => {
                if (ok) router.push(url.pathname + url.search + url.hash);
            });
        };
        document.addEventListener("click", onClick, true);
        return () => document.removeEventListener("click", onClick, true);
    }, [confirm, router]);

    return { confirmDiscard };
}
