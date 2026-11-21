"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

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
            <div className="page-header">
                <h1>Duplicate Check <span className="count">({total} groups)</span></h1>
                <Link href="/admin/patients" className="btn-back">← Back to Patients</Link>
            </div>

            {loading ? (
                <div className="loading-text">Scanning for duplicates…</div>
            ) : duplicates.length === 0 ? (
                <div className="empty-card">
                    <span className="empty-icon">✓</span>
                    <p>No duplicate patients found</p>
                </div>
            ) : (
                <div className="groups">
                    {duplicates.map((group) => (
                        <div key={group.phone} className="dupe-group">
                            <div className="group-header">
                                <div className="group-header-left">
                                    <span className="phone-label">📞 {group.phoneDisplay}</span>
                                    <span className={`match-badge match-${group.nameMatch}`}>
                                        {NAME_MATCH_LABEL[group.nameMatch]}
                                    </span>
                                </div>
                                <span className="dupe-count">{group.patients.length} matches</span>
                            </div>
                            <div className="table-scroll">
                                <table className="data-table">
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
                                                <td style={{ color: "rgba(255,255,255,0.3)" }}>{p.id}</td>
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
                .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; }
                .page-header h1 { font-size: 1.5rem; font-weight: 600; }
                .count { color: rgba(255,255,255,0.35); font-weight: 400; font-size: 1.1rem; }
                :global(.btn-back) {
                    color: rgba(255,255,255,0.5); text-decoration: none; font-size: 0.85rem;
                    transition: color 0.15s;
                }
                :global(.btn-back:hover) { color: #fff; }
                .loading-text { color: rgba(255,255,255,0.4); padding: 2rem; text-align: center; }
                .empty-card {
                    background: rgba(76,175,147,0.06); border: 1px solid rgba(76,175,147,0.12);
                    border-radius: var(--radius-md, 4px); padding: 3rem;
                    text-align: center; color: #6ee7b7;
                }
                .empty-icon { font-size: 2rem; display: block; margin-bottom: 0.5rem; }
                .empty-card p { font-size: 0.95rem; }
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
                .phone-label { font-weight: 600; font-size: 0.9rem; }
                .dupe-count {
                    background: rgba(239,68,68,0.12); color: #fca5a5;
                    padding: 0.15rem 0.55rem; border-radius: 20px; font-size: 0.72rem; font-weight: 600;
                }
                .match-badge {
                    padding: 0.15rem 0.55rem; border-radius: 20px; font-size: 0.68rem; font-weight: 600;
                    text-transform: uppercase; letter-spacing: 0.03em;
                }
                .match-same { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.5); }
                .match-variant { background: rgba(251,191,36,0.15); color: #fbbf24; }
                .match-different { background: rgba(239,68,68,0.15); color: #fca5a5; }
                .row-archived { opacity: 0.55; }
                .archived-tag {
                    margin-left: 0.5rem; font-size: 0.65rem; font-weight: 600;
                    background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.5);
                    padding: 0.1rem 0.4rem; border-radius: 20px;
                    text-transform: uppercase; letter-spacing: 0.03em;
                }
                .table-scroll { overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; }
                .data-table { width: 100%; min-width: 640px; border-collapse: collapse; }
                .data-table th {
                    text-align: left; padding: 0.6rem 1rem; font-size: 0.74rem;
                    text-transform: uppercase; letter-spacing: 0.05em;
                    color: rgba(255,255,255,0.35); border-bottom: 1px solid rgba(255,255,255,0.04);
                    font-weight: 600;
                }
                .data-table td {
                    padding: 0.6rem 1rem; font-size: 0.85rem;
                    border-bottom: 1px solid rgba(255,255,255,0.03);
                    color: rgba(255,255,255,0.8);
                }
                .data-table tr:hover { background: rgba(255,255,255,0.02); }
                :global(.btn-sm) {
                    padding: 0.25rem 0.6rem; border-radius: var(--radius-sm, 2px); font-size: 0.76rem;
                    border: none; cursor: pointer; font-weight: 500; font-family: inherit;
                    text-decoration: none; display: inline-block;
                }
                :global(.btn-view) { background: rgba(76,175,147,0.12); color: #6ee7b7; }
                :global(.btn-view:hover) { background: rgba(76,175,147,0.22); }

                @media (max-width: 560px) {
                    .page-header { flex-direction: column; align-items: stretch; gap: 0.75rem; }
                    :global(.btn-sm) { padding: 0.42rem 0.75rem; }
                }
            `}</style>
        </div>
    );
}
