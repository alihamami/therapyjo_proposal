"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Archive, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import RowMenu from "@/app/components/RowMenu";
import { shouldOpenRow } from "@/lib/rowLink";
import StaffModal from "@/app/components/StaffModal";

interface BlogPost {
    id: string;
    title: string;
    lang: "EN" | "AR";
    category: string;
    status: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";
    updatedAt: string;
    publishAt: string | null;
    linked: { id: string; lang: string } | null;
}

const FILTERS = ["All", "Published", "Scheduled", "Drafts", "Archived"] as const;

function statusFor(filter: (typeof FILTERS)[number]) {
    switch (filter) {
        case "Published": return "PUBLISHED";
        case "Scheduled": return "SCHEDULED";
        case "Drafts": return "DRAFT";
        case "Archived": return "ARCHIVED";
        default: return null;
    }
}

export default function BlogListPage() {
    const router = useRouter();
    const [posts, setPosts] = useState<BlogPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
    const [deleteTarget, setDeleteTarget] = useState<BlogPost | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState("");
    const [deleteError, setDeleteError] = useState("");
    const [deleting, setDeleting] = useState(false);

    const fetchPosts = useCallback(async () => {
        const res = await fetch("/api/blog");
        const data = await res.json();
        setPosts(Array.isArray(data) ? data : []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchPosts(); }, [fetchPosts]);

    const counts = useMemo(() => ({
        All: posts.filter((p) => p.status !== "ARCHIVED").length,
        Published: posts.filter((p) => p.status === "PUBLISHED").length,
        Scheduled: posts.filter((p) => p.status === "SCHEDULED").length,
        Drafts: posts.filter((p) => p.status === "DRAFT").length,
        Archived: posts.filter((p) => p.status === "ARCHIVED").length,
    }), [posts]);

    const visible = useMemo(() => {
        const want = statusFor(filter);
        if (filter === "All") return posts.filter((p) => p.status !== "ARCHIVED");
        return posts.filter((p) => p.status === want);
    }, [posts, filter]);

    const archive = async (id: string) => {
        await fetch(`/api/blog/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "ARCHIVED" }),
        });
        fetchPosts();
    };

    const restore = async (id: string) => {
        await fetch(`/api/blog/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "DRAFT" }),
        });
        fetchPosts();
    };

    const openDelete = (post: BlogPost) => {
        setDeleteTarget(post);
        setDeleteConfirm("");
        setDeleteError("");
    };

    const handleHardDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        setDeleteError("");
        const res = await fetch(`/api/blog/${deleteTarget.id}`, { method: "DELETE" });
        setDeleting(false);
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setDeleteError(data.error || "Could not delete this post.");
            return;
        }
        setDeleteTarget(null);
        fetchPosts();
    };

    if (loading) {
        return <div style={{ color: "rgba(255,255,255,0.5)", padding: "2rem" }}>Loading…</div>;
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>Blog Posts</h1>
                    <p className="subtitle">The clinic&apos;s voice — posts have no author byline on the public site.</p>
                </div>
                <button className="staff-btn staff-btn-primary" onClick={() => router.push("/admin/blog/new")}><Plus size={15} aria-hidden="true" />New Post</button>
            </div>

            <div className="filter-row">
                {FILTERS.map((f) => (
                    <button
                        key={f}
                        className={`chip ${filter === f ? "active" : ""}`}
                        onClick={() => setFilter(f)}
                    >
                        {f} <span className="chip-count">{counts[f]}</span>
                    </button>
                ))}
            </div>

            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Lang</th>
                            <th>Category</th>
                            <th>Status</th>
                            <th>Date</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map((post) => (
                            <tr key={post.id} className="staff-row-link" onClick={(e) => { if (shouldOpenRow(e)) router.push(`/admin/blog/${post.id}`); }}>
                                <td>
                                    <div className="title-cell"><Link href={`/admin/blog/${post.id}`} className="staff-row-name">{post.title || "(untitled)"}</Link></div>
                                    <div className="sub-line">
                                        {post.linked
                                            ? `${post.linked.lang === "AR" ? "Arabic" : "English"} version linked`
                                            : "No translation"}
                                    </div>
                                </td>
                                <td><span className="lang-chip">{post.lang}</span></td>
                                <td>{post.category}</td>
                                <td><span className={`status-pill status-${post.status.toLowerCase()}`}>{post.status}</span></td>
                                <td>{new Date(post.updatedAt).toLocaleDateString()}</td>
                                <td>
                                    <div className="staff-row-end">
                                        {post.status === "ARCHIVED" && (
                                            <button className="btn-sm btn-restore" onClick={() => restore(post.id)}>Restore</button>
                                        )}
                                        <RowMenu
                                            label={`More actions for ${post.title || "this post"}`}
                                            items={post.status !== "ARCHIVED" ? [
                                                { label: "Edit", icon: Pencil, onSelect: () => router.push(`/admin/blog/${post.id}`) },
                                                { label: "Archive", icon: Archive, onSelect: () => archive(post.id) },
                                            ] : [
                                                { label: "Edit", icon: Pencil, onSelect: () => router.push(`/admin/blog/${post.id}`) },
                                                { label: "Delete permanently", icon: Trash2, onSelect: () => openDelete(post), destructive: true },
                                            ]}
                                        />
                                        <ChevronRight size={16} className="staff-row-chevron" aria-hidden="true" />
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {visible.length === 0 && (
                            <tr><td colSpan={6} className="empty-state">Nothing here yet.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {deleteTarget && (
                <StaffModal
                    title={`Delete this post?`}
                    onClose={() => setDeleteTarget(null)}
                    closeDisabled={deleting}
                    footer={<>
                        <button className="staff-btn staff-btn-secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
                        <button
                            className="staff-btn staff-btn-danger"
                            aria-busy={deleting}
                            onClick={handleHardDelete}
                            disabled={deleting || deleteConfirm !== "DELETE"}
                        >
                            {deleting ? "Deleting…" : "Delete permanently"}
                        </button>
                    </>}
                >
                    <p className="staff-modal-text">
                        <strong>{deleteTarget.title || "(untitled)"}</strong> will be removed permanently.
                        This cannot be undone.
                    </p>
                    {deleteTarget.linked && (
                        <p className="staff-modal-text">
                            Its {deleteTarget.linked.lang === "AR" ? "Arabic" : "English"} translation is
                            <strong> kept</strong>, and keeps its own status — but the two stop being linked,
                            and that cannot be undone either.
                        </p>
                    )}
                    {deleteError && <div className="staff-form-error" role="alert">{deleteError}</div>}
                    <div className="staff-field">
                        <label htmlFor="delete-confirm">Type <strong>DELETE</strong> to confirm</label>
                        <input
                            id="delete-confirm"
                            value={deleteConfirm}
                            onChange={(e) => setDeleteConfirm(e.target.value)}
                            autoComplete="off"
                            autoFocus
                        />
                    </div>
                </StaffModal>
            )}

            <style jsx>{`
                .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1.25rem; gap: 1rem; flex-wrap: wrap; }
                .page-header h1 { font-size: 1.5rem; font-weight: 600; margin: 0 0 0.25rem; }
                .subtitle { color: rgba(255,255,255,0.4); font-size: 0.85rem; margin: 0; }

                .filter-row { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
                .chip {
                    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
                    color: rgba(255,255,255,0.65); padding: 0.4rem 0.9rem; border-radius: 999px;
                    font-size: 0.8rem; font-weight: 600; cursor: pointer; font-family: inherit;
                    display: inline-flex; align-items: center; gap: 0.4rem; transition: all 0.15s;
                }
                .chip:hover { background: rgba(255,255,255,0.08); }
                .chip.active { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.3); color: #fff; }
                .chip-count { color: rgba(255,255,255,0.4); font-weight: 500; }
                .chip.active .chip-count { color: rgba(255,255,255,0.7); }

                .table-container {
                    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
                    border-radius: 10px; overflow: hidden; overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                }
                .data-table { width: 100%; border-collapse: collapse; min-width: 680px; }
                .data-table th {
                    text-align: left; padding: 0.9rem 1rem; font-size: 0.72rem; text-transform: uppercase;
                    letter-spacing: 0.05em; color: rgba(255,255,255,0.4); border-bottom: 1px solid rgba(255,255,255,0.06);
                    font-weight: 600; white-space: nowrap;
                }
                .data-table td {
                    padding: 0.8rem 1rem; font-size: 0.88rem; border-bottom: 1px solid rgba(255,255,255,0.04);
                    color: rgba(255,255,255,0.85); vertical-align: top;
                }
                .data-table tr:hover { background: rgba(255,255,255,0.02); }
                .title-cell { font-weight: 500; }
                .sub-line { font-size: 0.74rem; color: rgba(255,255,255,0.35); margin-top: 0.15rem; }
                .lang-chip {
                    border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 0.15rem 0.45rem;
                    font-size: 0.72rem; font-weight: 700; color: rgba(255,255,255,0.7);
                }
                .status-pill { padding: 0.25rem 0.6rem; border-radius: 999px; font-size: 0.74rem; font-weight: 600; white-space: nowrap; }
                .status-published { background: rgba(16,185,129,0.15); color: #6ee7b7; }
                .status-scheduled { background: rgba(96,165,250,0.15); color: #93c5fd; }
                .status-archived { background: rgba(245,158,11,0.13); color: #fcd34d; }
                .status-draft { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.5); }
                .btn-sm { padding: 0.3rem 0.7rem; border-radius: 6px; font-size: 0.8rem; border: none; cursor: pointer; font-weight: 500; font-family: inherit; }
                .btn-restore { background: rgba(16,185,129,0.15); color: #6ee7b7; }
                .btn-restore:hover { background: rgba(16,185,129,0.25); }
                .empty-state { text-align: center; color: rgba(255,255,255,0.35); padding: 2rem !important; }

                @media (max-width: 560px) {
                    .page-header { flex-direction: column; align-items: stretch; }
                    .page-header .staff-btn { width: 100%; }
                }
            `}</style>
        </div>
    );
}
