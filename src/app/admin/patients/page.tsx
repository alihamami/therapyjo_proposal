"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { joinPhones } from "@/lib/phone";
import { Archive, ChevronRight, Plus, Search, Users } from "lucide-react";
import RowMenu from "@/app/components/RowMenu";
import { shouldOpenRow } from "@/lib/rowLink";
import { useConfirm } from "@/app/components/ConfirmDialog";
import StaffEmpty from "@/app/components/StaffEmpty";
import { StaffSkeletonRows } from "@/app/components/StaffSkeleton";

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

    // Only the newest request may fill the list: an older, slower answer is
    // dropped instead of overwriting a newer one. (TJ-069h)
    const latest = useRef(0);
    const fetchPatients = useCallback(async () => {
        const req = ++latest.current;
        setLoading(true);
        const params = new URLSearchParams({
            page: page.toString(),
            limit: "20",
            ...(search && { search }),
        });
        const res = await fetch(`/api/patients?${params}`);
        const data = await res.json();
        if (req !== latest.current) return;
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
            <div className="staff-page-header">
                <h1>Patients <span className="staff-page-count">({total})</span></h1>
                <button className="staff-btn staff-btn-primary" onClick={() => router.push("/admin/patients/new")}><Plus size={15} aria-hidden="true" />Add Patient</button>
            </div>

            <div className="staff-search">
                <Search size={15} aria-hidden="true" />
                <input
                    type="text"
                    aria-label="Search patients"
                    placeholder="Search by name or phone…"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                />
            </div>

            <div className="staff-table-wrap">
                <table className="staff-table">
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
                            <StaffSkeletonRows columns={6} label="Loading patients…" />
                        ) : patients.length === 0 ? (
                            <tr className="staff-table-state"><td colSpan={6}>
                                {search ? (
                                    <StaffEmpty icon={Search} title="No patients match your search" hint="Try part of the name, or a phone number." />
                                ) : (
                                    <StaffEmpty
                                        icon={Users}
                                        title="No patients yet"
                                        hint="Patients you add appear here."
                                        action={<button className="staff-btn staff-btn-primary staff-btn-sm" onClick={() => router.push("/admin/patients/new")}><Plus size={15} aria-hidden="true" />Add Patient</button>}
                                    />
                                )}
                            </td></tr>
                        ) : patients.map((p) => (
                            <tr key={p.id} className="staff-row-link" onClick={(e) => { if (shouldOpenRow(e)) router.push(`/admin/patients/${p.id}`); }}>
                                <td className="staff-cell-id">{p.id}</td>
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
                <div className="staff-pagination">
                    <button className="staff-btn staff-btn-secondary staff-btn-sm" disabled={page === 1} onClick={() => setPage(page - 1)}>← Prev</button>
                    <span>Page {page} of {totalPages}</span>
                    <button className="staff-btn staff-btn-secondary staff-btn-sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next →</button>
                </div>
            )}

            <style jsx>{`
                .staff-table { min-width: 680px; }
                .name-cell { font-weight: 500; color: #fff; }
            `}</style>
        </div>
    );
}
