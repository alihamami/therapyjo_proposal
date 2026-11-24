"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Circle, CircleCheck, StickyNote } from "lucide-react";
import StaffEmpty from "@/app/components/StaffEmpty";
import { StaffSkeletonRows } from "@/app/components/StaffSkeleton";

interface Note {
    id: number;
    name: string;
    noteDate: string;
    doctorCheckNote: boolean;
    details: string | null;
    doctor: { id: string; name: string } | null;
}

export default function DoctorNotesPage() {
    const { data: session } = useSession();
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const doctorId = (session?.user as { id?: string })?.id;

    const fetchNotes = useCallback(async () => {
        if (!doctorId) return;
        setLoading(true);
        const params = new URLSearchParams({ page: String(page), limit: "20", doctorId });
        const res = await fetch(`/api/notes?${params}`);
        const data = await res.json();
        setNotes(data.notes || []);
        setTotalPages(data.totalPages || 1);
        setLoading(false);
    }, [page, doctorId]);

    useEffect(() => { fetchNotes(); }, [fetchNotes]);

    const toggleCheck = async (note: Note) => {
        await fetch(`/api/notes/${note.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ doctorCheckNote: !note.doctorCheckNote }),
        });
        fetchNotes();
    };

    const formatDate = (d: string) =>
        new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

    return (
        <div>
            <div className="staff-page-header">
                <h1>My Notes</h1>
            </div>

            <div className="staff-table-wrap">
                <table className="staff-table">
                    <thead>
                        <tr><th>Date</th><th>Name</th><th>Checked</th><th>Details</th></tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <StaffSkeletonRows columns={4} label="Loading notes…" />
                        ) : notes.length === 0 ? (
                            <tr className="staff-table-state"><td colSpan={4}>
                                <StaffEmpty icon={StickyNote} title="No notes yet" hint="Notes the clinic leaves for you appear here." />
                            </td></tr>
                        ) : notes.map((n) => (
                            <tr key={n.id}>
                                <td>{formatDate(n.noteDate)}</td>
                                <td style={{ fontWeight: 600 }}>{n.name}</td>
                                <td>
                                    <button className="check-btn" aria-label="Checked" aria-pressed={n.doctorCheckNote} onClick={() => toggleCheck(n)}>
                                        {n.doctorCheckNote ? <CircleCheck size={18} aria-hidden="true" /> : <Circle size={18} aria-hidden="true" />}
                                    </button>
                                </td>
                                <td className="note-details">{n.details || "—"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="staff-pagination">
                    <button className="staff-btn staff-btn-secondary staff-btn-sm" disabled={page === 1} onClick={() => setPage(page - 1)}>← Prev</button>
                    <span>Page {page} of {totalPages}</span>
                    <button className="staff-btn staff-btn-secondary staff-btn-sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next →</button>
                </div>
            )}

            <style jsx>{`
                .note-details { max-width: 350px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: rgba(255,255,255,0.5); }
                .check-btn { display: inline-flex; background: none; border: none; cursor: pointer; padding: 0.2rem; color: var(--staff-faint); }
                .check-btn[aria-pressed="true"] { color: var(--staff-ok); }
            `}</style>
        </div>
    );
}
