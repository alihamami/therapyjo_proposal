"use client";

// In-app confirmation, design 1A (TJ-069b1). Replaces window.confirm() in the
// staff portal. <ConfirmProvider> wraps each staff layout's page content; a
// page calls `const confirm = useConfirm();` and then
// `if (!(await confirm({ title, message, confirmLabel, tone }))) return;`.
// Escape, Cancel and a click on the backdrop all answer "no". Focus starts on
// the confirm button, or on Cancel when tone is "danger", cycles between the
// two buttons on Tab, and returns where it was afterwards. The styles are
// global (globals.css, staff section) because the dialog renders into <body>.

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { createPortal } from "react-dom";

export interface ConfirmOptions {
    title: string;
    message?: string;
    /** The button that says yes. Default "Confirm". */
    confirmLabel?: string;
    /** The button that says no. Default "Cancel". */
    cancelLabel?: string;
    /** "danger" when something is deleted for good or unsaved work is lost: red button, focus on Cancel. */
    tone?: "default" | "danger";
}

type Ask = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Ask | null>(null);

/** Ask before acting. Outside a ConfirmProvider it falls back to the browser's box, so nothing proceeds unasked. */
export function useConfirm(): Ask {
    const ask = useContext(ConfirmContext);
    return useCallback<Ask>(
        (options) => (ask
            ? ask(options)
            : Promise.resolve(window.confirm(options.message ? `${options.title}\n\n${options.message}` : options.title))),
        [ask]
    );
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
    const [pending, setPending] = useState<ConfirmOptions | null>(null);
    const resolver = useRef<((answer: boolean) => void) | null>(null);
    const returnFocus = useRef<HTMLElement | null>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const titleId = useId();
    const messageId = useId();

    const ask = useCallback<Ask>((options) => new Promise<boolean>((resolve) => {
        resolver.current?.(false); // a newer question replaces an unanswered one
        resolver.current = resolve;
        returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setPending(options);
    }), []);

    const answer = useCallback((value: boolean) => {
        resolver.current?.(value);
        resolver.current = null;
        setPending(null);
        const el = returnFocus.current;
        returnFocus.current = null;
        if (el && document.contains(el)) el.focus();
    }, []);

    // Starting focus: Cancel for anything dangerous, the confirm button otherwise.
    useEffect(() => {
        if (!pending) return;
        const selector = pending.tone === "danger" ? "[data-confirm-cancel]" : "[data-confirm-ok]";
        dialogRef.current?.querySelector<HTMLButtonElement>(selector)?.focus();
    }, [pending]);

    // Escape answers no, wherever focus is.
    useEffect(() => {
        if (!pending) return;
        const onKey = (e: globalThis.KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                answer(false);
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [pending, answer]);

    // Tab stays on the dialog's two buttons.
    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== "Tab") return;
        const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
        if (buttons.length === 0) return;
        const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = e.shiftKey ? (i <= 0 ? buttons.length - 1 : i - 1) : (i === buttons.length - 1 ? 0 : i + 1);
        e.preventDefault();
        buttons[next].focus();
    };

    return (
        <ConfirmContext.Provider value={ask}>
            {children}
            {pending && createPortal(
                <div
                    className="staff-confirm-overlay"
                    onMouseDown={(e) => { if (e.target === e.currentTarget) answer(false); }}
                >
                    <div
                        ref={dialogRef}
                        className="staff-confirm"
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby={titleId}
                        aria-describedby={pending.message ? messageId : undefined}
                        onKeyDown={onKeyDown}
                    >
                        <h2 id={titleId} className="staff-confirm-title">{pending.title}</h2>
                        {pending.message && <p id={messageId} className="staff-confirm-message">{pending.message}</p>}
                        <div className="staff-confirm-actions">
                            <button type="button" data-confirm-cancel className="staff-btn staff-btn-secondary" onClick={() => answer(false)}>
                                {pending.cancelLabel ?? "Cancel"}
                            </button>
                            <button
                                type="button"
                                data-confirm-ok
                                className={pending.tone === "danger" ? "staff-btn staff-btn-danger" : "staff-btn staff-btn-primary"}
                                onClick={() => answer(true)}
                            >
                                {pending.confirmLabel ?? "Confirm"}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </ConfirmContext.Provider>
    );
}
