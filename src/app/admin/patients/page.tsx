"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { joinPhones } from "@/lib/phone";
import { Archive, ChevronRight, Plus } from "lucide-react";
import RowMenu from "@/app/components/RowMenu";
import { shouldOpenRow } from "@/lib/rowLink";
import { useConfirm } from "@/app/components/ConfirmDialog";

interface Patient {
    id: number;
    name: string;
    phone1: string;
    phone2: string | null;
    pictureUrl: string | null;
    archived: boolean;
    lastVisitDate: string | null;
    createdAt: string;
}

export default function PatientsPage() {
    const confirm = useConfirm();
    const router = useRouter();
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const fetchPatients = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams({
            page: page.toString(),
            limit: "20",
            ...(search && { search }),
        });
        const res = await fetch(`/api/patients?${params}`);
        const data = await res.json();
        setPatients(data.patients);
        setTotalPages(data.totalPages);
        setTotal(data.total);
        setLoading(false);
    }, [page, search]);

    useEffect(() => { fetchPatients(); }, [fetchPatients]);

    // Debounced search
    const [searchInput, setSearchInput] = useState("");
    useEffect(() => {
        const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
        return () => clearTimeout(t);
    }, [searchInput]);

    const handleArchive = async (id: number) => {
        const name = patients.find((p) => p.id === id)?.name;
        if (!(await confirm({
            title: `Archive ${name ?? "this patient"}?`,
            message: "They move to Archived Patients. Their file stays, and you can restore them any time.",
            confirmLabel: "Archive",
        }))) return;
        await fetch(`/api/patients/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ archived: true }),
        });
        fetchPatients();
    };

    const formatDate = (d: string | null) => {
        if (!d) return "—";
        return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    };

    return (
        <div>
            <div className="page-header">
                <h1>Patients <span className="count">({total})</span></h1>
                <button className="staff-btn staff-btn-primary" onClick={() => router.push("/admin/patients/new")}><Plus size={15} aria-hidden="true" />Add Patient</button>
            </div>

            <div className="search-bar">
                <input
                    type="text"
                    placeholder="Search by name or phone…"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                />
            </div>

            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Phone</th>
                            <th>Last Visit</th>
                            <th>Created</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", padding: "2rem" }}>Loading…</td></tr>
                        ) : patients.length === 0 ? (
                            <tr><td colSpan={6} style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", padding: "2rem" }}>No patients found</td></tr>
                        ) : patients.map((p) => (
                            <tr key={p.id} className="staff-row-link" onClick={(e) => { if (shouldOpenRow(e)) router.push(`/admin/patients/${p.id}`); }}>
                                <td className="id-cell">{p.id}</td>
                                <td className="name-cell"><Link href={`/admin/patients/${p.id}`} className="staff-row-name">{p.name}</Link></td>
                                <td>{joinPhones(p.phone1, p.phone2) ?? <span className="no-phone">No phone</span>}</td>
                                <td>{formatDate(p.lastVisitDate)}</td>
                                <td>{formatDate(p.createdAt)}</td>
                                <td>
                                    <div className="staff-row-end">
                                        <RowMenu
                                            label={`More actions for ${p.name}`}
                                            items={[{ label: "Archive", icon: Archive, onSelect: () => handleArchive(p.id) }]}
                                        />
                                        <ChevronRight size={16} className="staff-row-chevron" aria-hidden="true" />
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="pagination">
                    <button disabled={page === 1} onClick={() => setPage(page - 1)}>← Prev</button>
                    <span>Page {page} of {totalPages}</span>
                    <button disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next →</button>
                </div>
            )}

            <style jsx>{`
                .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; }
                .page-header h1 { font-size: 1.5rem; font-weight: 600; }
                .count { color: rgba(255,255,255,0.35); font-weight: 400; font-size: 1.1rem; }
                .search-bar { margin-bottom: 1rem; }
                .search-bar input {
                    width: 100%; max-width: 400px;
                    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
                    border-radius: var(--radius-sm, 2px); padding: 0.6rem 0.9rem;
                    color: #fff; font-size: 0.88rem; outline: none; font-family: inherit;
                }
                .search-bar input:focus { border-color: var(--primary, #4CAF93); }
                .search-bar input::placeholder { color: rgba(255,255,255,0.25); }
                .table-container {
                    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
                    border-radius: var(--radius-md, 4px); overflow-x: auto; overflow-y: hidden;
                    -webkit-overflow-scrolling: touch;
                }
                .data-table { width: 100%; min-width: 680px; border-collapse: collapse; }
                .data-table th {
                    text-align: left; padding: 0.85rem 1rem; font-size: 0.76rem;
                    text-transform: uppercase; letter-spacing: 0.05em;
                    color: rgba(255,255,255,0.4); border-bottom: 1px solid rgba(255,255,255,0.06);
                    font-weight: 600;
                }
                .data-table td {
                    padding: 0.75rem 1rem; font-size: 0.88rem;
                    border-bottom: 1px solid rgba(255,255,255,0.04);
                    color: rgba(255,255,255,0.8);
                }
                .data-table tr:hover { background: rgba(255,255,255,0.02); }
                .id-cell { color: rgba(255,255,255,0.35); font-variant-numeric: tabular-nums; }
                .name-cell { font-weight: 500; color: #fff; }
                .pagination {
                    display: flex; align-items: center; justify-content: center; gap: 1rem;
                    margin-top: 1.25rem; color: rgba(255,255,255,0.5); font-size: 0.85rem;
                }
                .pagination button {
                    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
                    color: #fff; padding: 0.4rem 0.9rem; border-radius: var(--radius-sm, 2px);
                    cursor: pointer; font-size: 0.82rem; font-family: inherit;
                }
                .pagination button:disabled { opacity: 0.3; cursor: not-allowed; }

                @media (max-width: 560px) {
                    .page-header { flex-direction: column; align-items: stretch; gap: 0.75rem; }
                    .page-header .staff-btn { width: 100%; }
                    .search-bar input { max-width: 100%; }
                }
            `}</style>
        </div>
    );
}
