"use client";

import { useState, useEffect, useCallback } from "react";
import { Inbox } from "lucide-react";
import StaffEmpty from "@/app/components/StaffEmpty";
import StaffSkeleton from "@/app/components/StaffSkeleton";

interface PendingChange {
    id: string;
    doctorId: string;
    doctor: { name: string };
    field: "NAME" | "TITLE" | "SPECIALTY" | "BIO" | "CONTACT" | "PHOTO";
    oldValue: string;
    newValue: string;
    submittedAt: string;
    submittedBy: string;
}

const FIELD_LABEL: Record<PendingChange["field"], string> = {
    NAME: "Name",
    TITLE: "Title",
    SPECIALTY: "Specialty",
    BIO: "Bio",
    CONTACT: "Contact",
    PHOTO: "Profile photo",
};

function relativeTime(iso: string) {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

export default function ApprovalsPage() {
    const [changes, setChanges] = useState<PendingChange[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<string | null>(null);

    const fetchChanges = useCallback(async () => {
        const res = await fetch("/api/pending-changes");
        const data = await res.json();
        setChanges(Array.isArray(data) ? data : []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchChanges(); }, [fetchChanges]);

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2200);
    };

    const decide = async (id: string, decision: "approve" | "reject") => {
        setChanges((prev) => prev.filter((c) => c.id !== id));
        await fetch(`/api/pending-changes/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ decision }),
        });
        showToast(decision === "approve" ? "Change approved and published" : "Change rejected");
    };

    return (
        <div>
            <div className="staff-page-header">
                <div>
                    <h1>Approvals</h1>
                    <p className="staff-page-sub">Profile edits and photo uploads submitted by doctors. Nothing reaches the public site until approved here.</p>
                </div>
            </div>

            {loading ? (
                <StaffSkeleton kind="cards" label="Loading approvals…" />
            ) : changes.length === 0 ? (
                <div className="staff-panel">
                    <StaffEmpty icon={Inbox} title="Nothing waiting for review" hint="Profile edits and photos that doctors send appear here." />
                </div>
            ) : (
                <div className="change-list">
                    {changes.map((c) => (
                        <div className="change-card" key={c.id}>
                            <div className="change-header">
                                <div className="change-who">
                                    <span className="doctor-name">{c.doctor.name}</span>
                                    <span className="field-chip">{FIELD_LABEL[c.field]}</span>
                                </div>
                                <span className="change-time">{relativeTime(c.submittedAt)}</span>
                            </div>

                            <div className="diff-row">
                                <div className="diff-panel diff-current">
                                    <span className="diff-label">Current</span>
                                    {c.field === "PHOTO" && c.oldValue ? (
                                        <img src={c.oldValue} alt="Current" className="diff-photo" />
                                    ) : (
                                        <span className="diff-value">{c.oldValue || "—"}</span>
                                    )}
                                </div>
                                <div className="diff-panel diff-proposed">
                                    <span className="diff-label">Proposed</span>
                                    {c.field === "PHOTO" && c.newValue ? (
                                        <img src={c.newValue} alt="Proposed" className="diff-photo" />
                                    ) : (
                                        <span className="diff-value">{c.newValue}</span>
                                    )}
                                </div>
                            </div>

                            <div className="change-actions">
                                <button className="staff-btn staff-btn-primary" onClick={() => decide(c.id, "approve")}>Approve</button>
                                <button className="staff-btn staff-btn-secondary" onClick={() => decide(c.id, "reject")}>Reject</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {toast && <div className="toast">✓ {toast}</div>}

            <style jsx>{`
                .staff-page-sub { max-width: 620px; }

                .change-list { display: flex; flex-direction: column; gap: 1rem; }
                .change-card {
                    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
                    border-radius: 10px; padding: 1.1rem 1.25rem;
                }
                .change-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.85rem; }
                .change-who { display: flex; align-items: center; gap: 0.6rem; }
                .doctor-name { font-size: var(--staff-size-md); font-weight: 700; }
                .field-chip {
                    background: rgba(245,158,11,0.15); color: #fcd34d; border-radius: 999px;
                    padding: 0.15rem 0.6rem; font-size: var(--staff-size-xs); font-weight: 600;
                }
                .change-time { font-size: var(--staff-size-sm); color: rgba(255,255,255,0.3); }

                .diff-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; margin-bottom: 1rem; }
                .diff-panel { border-radius: 8px; padding: 0.8rem; }
                .diff-current { background: rgba(255,255,255,0.03); }
                .diff-proposed { background: rgba(16,185,129,0.06); border: 1px solid rgba(16,185,129,0.18); }
                .diff-label { display: block; font-size: var(--staff-size-xs); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.4rem; }
                .diff-current .diff-label { color: rgba(255,255,255,0.3); }
                .diff-proposed .diff-label { color: #6ee7b7; }
                .diff-value { font-size: var(--staff-size-base); white-space: pre-wrap; }
                .diff-current .diff-value { color: rgba(255,255,255,0.55); }
                .diff-proposed .diff-value { color: rgba(255,255,255,0.85); }
                .diff-photo { width: 100%; max-width: 140px; aspect-ratio: 1; object-fit: cover; border-radius: 6px; }

                .change-actions { display: flex; gap: 0.6rem; }

                .toast {
                    position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 1300;
                    background: #06281f; color: #10b981; border-radius: 8px; padding: 0.8rem 1.2rem;
                    font-size: var(--staff-size-base); font-weight: 600; box-shadow: 0 12px 32px rgba(16,185,129,0.35);
                }

                @media (max-width: 700px) {
                    .diff-row { grid-template-columns: 1fr; }
                    .change-header { flex-wrap: wrap; gap: 0.4rem; }
                    .change-actions { flex-wrap: wrap; }
                    .toast { left: 1rem; right: 1rem; bottom: 1rem; text-align: center; }
                }
            `}</style>
        </div>
    );
}
