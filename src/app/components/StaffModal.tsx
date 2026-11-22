"use client";

// Popup, design 2B (TJ-069d1). A header bar with the title and a close button,
// a body that scrolls on its own, and an optional footer bar for the actions.
// Escape and a click on the backdrop close it, except while a confirmation is
// open on top (the confirmation answers first) or while closing is disabled
// (saving). Focus moves into the popup when it opens (to an autoFocus field if
// there is one) and goes back where it was when it closes. It renders into
// <body>, so the styles are global: .staff-modal-* in globals.css.

import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface StaffModalProps {
    title: ReactNode;
    onClose: () => void;
    /** The popup's body. */
    children: ReactNode;
    /** The action buttons, shown in the footer bar. */
    footer?: ReactNode;
    /** 560px wide instead of 440px, for long forms and detail views. */
    wide?: boolean;
    /** While saving: the close button, Escape and the backdrop do nothing. */
    closeDisabled?: boolean;
}

export default function StaffModal({ title, onClose, children, footer, wide, closeDisabled }: StaffModalProps) {
    const titleId = useId();
    const dialogRef = useRef<HTMLDivElement>(null);
    // Latest values for the listener registered once below.
    const onCloseRef = useRef(onClose);
    const disabledRef = useRef(closeDisabled);
    useEffect(() => {
        onCloseRef.current = onClose;
        disabledRef.current = closeDisabled;
    });

    useEffect(() => {
        const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const dialog = dialogRef.current;
        if (dialog && !dialog.contains(document.activeElement)) dialog.focus({ preventScroll: true });
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape" || disabledRef.current) return;
            if (document.querySelector(".staff-confirm-overlay")) return;
            onCloseRef.current();
        };
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("keydown", onKey);
            if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
        };
    }, []);

    return createPortal(
        <div
            className="staff-modal-overlay"
            onMouseDown={(e) => { if (e.target === e.currentTarget && !closeDisabled) onClose(); }}
        >
            <div
                ref={dialogRef}
                className={wide ? "staff-modal staff-modal-wide" : "staff-modal"}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
            >
                <div className="staff-modal-head">
                    <h2 id={titleId} className="staff-modal-title">{title}</h2>
                    <button type="button" className="staff-modal-close" aria-label="Close" onClick={onClose} disabled={closeDisabled}>
                        <X size={16} aria-hidden="true" />
                    </button>
                </div>
                <div className="staff-modal-body">{children}</div>
                {footer && <div className="staff-modal-foot">{footer}</div>}
            </div>
        </div>,
        document.body
    );
}
