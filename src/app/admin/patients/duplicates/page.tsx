"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { CircleCheck, Phone } from "lucide-react";
import StaffEmpty from "@/app/components/StaffEmpty";

interface DuplicateGroup {
    phone: string;
    phoneDisplay: string;
    nameMatch: "same" | "variant" | "different";
    patients: {
        id: number;
        name: string;
        phone1: string;
        phone2: string | null;
        archived: boolean;
        createdAt: string;
        lastVisitDate: string | null;
        reservationCount: number;
    }[];
}

const NAME_MATCH_LABEL: Record<DuplicateGroup["nameMatch"], string> = {
    same: "Same name",
    variant: "Name variant",
    different: "Different names",
};

export default function DuplicatePatientsPage() {
    const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);

    const fetchDuplicates = useCallback(async () => {
        setLoading(true);
        const res = await fetch("/api/patients/duplicates");
        const data = await res.json();
        setDuplicates(data.duplicates || []);
        setTotal(data.total || 0);
        setLoading(false);
    }, []);

    useEffect(() => { fetchDuplicates(); }, [fetchDuplicates]);

    const formatDate = (d: string) =>
        new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

    return (
        <div>
            <div className="staff-page-header">
                <h1>Duplicate Check <span className="staff-page-count">({total} groups)</span></h1>
                <Link href="/admin/patients" className="btn-back">← Back to Patients</Link>
            </div>

            {loading ? (
                <p className="staff-loading staff-panel" role="status">Scanning for duplicates…</p>
            ) : duplicates.length === 0 ? (
                <div className="staff-panel">
                    <StaffEmpty icon={CircleCheck} title="No duplicate patients" hint="No two patients share a phone number." />
                </div>
            ) : (
                <div className="groups">
                    {duplicates.map((group) => (
                        <div key={group.phone} className="dupe-group">
                            <div className="group-header">
                                <div className="group-header-left">
                                    <span className="phone-label staff-inline-icon"><Phone size={13} aria-hidden="true" />{group.phoneDisplay}</span>
                                    <span className={`match-badge match-${group.nameMatch}`}>
                                        {NAME_MATCH_LABEL[group.nameMatch]}
                                    </span>
                                </div>
                                <span className="dupe-count">{group.patients.length} matches</span>
                            </div>
                            <div className="table-scroll">
                                <table className="staff-table staff-table-compact">
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Name</th>
                                            <th>Phone 2</th>
                                            <th>Sessions</th>
                                            <th>Created</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {group.patients.map((p) => (
                                            <tr key={p.id} className={p.archived ? "row-archived" : undefined}>
                                                <td className="staff-cell-id">{p.id}</td>
                                                <td>
                                                    {p.name}
                                                    {p.archived && <span className="archived-tag">Archived</span>}
                                                </td>
                                                <td>{p.phone2 || "—"}</td>
                                                <td>{p.reservationCount}</td>
                                                <td>{formatDate(p.createdAt)}</td>
                                                <td>
                                                    <Link href={`/admin/patients/${p.id}`} className="btn-sm btn-view">View</Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <style jsx>{`
                .staff-page-header :global(.btn-back) {
                    color: rgba(255,255,255,0.5); text-decoration: none; font-size: var(--staff-size-base);
                    transition: color 0.15s;
                }
                .staff-page-header :global(.btn-back:hover) { color: #fff; }
                .groups { display: flex; flex-direction: column; gap: 1rem; }
                .dupe-group {
                    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
                    border-radius: var(--radius-md, 4px); overflow: hidden;
                }
                .group-header {
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 0.75rem 1rem; background: rgba(239,68,68,0.06);
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    flex-wrap: wrap; gap: 0.5rem;
                }
                .group-header-left { display: flex; align-items: center; gap: 0.6rem; }
                .phone-label { font-weight: 600; font-size: var(--staff-size-base); }
                .dupe-count {
                    background: rgba(239,68,68,0.12); color: #fca5a5;
                    padding: 0.15rem 0.55rem; border-radius: 20px; font-size: var(--staff-size-xs); font-weight: 600;
                }
                .match-badge {
                    padding: 0.15rem 0.55rem; border-radius: 20px; font-size: var(--staff-size-xs); font-weight: 600;
                    text-transform: uppercase; letter-spacing: 0.03em;
                }
                .match-same { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.5); }
                .match-variant { background: rgba(251,191,36,0.15); color: #fbbf24; }
                .match-different { background: rgba(239,68,68,0.15); color: #fca5a5; }
                .row-archived { opacity: 0.55; }
                .archived-tag {
                    margin-left: 0.5rem; font-size: var(--staff-size-xs); font-weight: 600;
                    background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.5);
                    padding: 0.1rem 0.4rem; border-radius: 20px;
                    text-transform: uppercase; letter-spacing: 0.03em;
                }
                .table-scroll { overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; }
                .staff-table { min-width: 640px; }
                .groups :global(.btn-sm) {
                    padding: 0.25rem 0.6rem; border-radius: var(--radius-sm, 2px); font-size: var(--staff-size-sm);
                    border: none; cursor: pointer; font-weight: 500; font-family: inherit;
                    text-decoration: none; display: inline-block;
                }
                .groups :global(.btn-view) { background: rgba(76,175,147,0.12); color: #6ee7b7; }
                .groups :global(.btn-view:hover) { background: rgba(76,175,147,0.22); }

                @media (max-width: 560px) {
                    .groups :global(.btn-sm) { padding: 0.42rem 0.75rem; }
                }
            `}</style>
        </div>
    );
}
