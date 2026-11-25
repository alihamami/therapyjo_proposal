"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Archive, ChevronRight, Newspaper, Pencil, Plus, Trash2 } from "lucide-react";
import RowMenu from "@/app/components/RowMenu";
import { shouldOpenRow } from "@/lib/rowLink";
import StaffModal from "@/app/components/StaffModal";
import StaffEmpty from "@/app/components/StaffEmpty";
import { StaffSkeletonRows } from "@/app/components/StaffSkeleton";

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

// What each tab says when it has no posts (design 3B, TJ-069e3).
const EMPTY: Record<(typeof FILTERS)[number], { title: string; hint: string }> = {
    All: { title: "No posts yet", hint: "Posts you write appear here, and on the public blog once published." },
    Published: { title: "No published posts", hint: "Published posts appear here and on the public blog." },
    Scheduled: { title: "No scheduled posts", hint: "Posts set to publish later appear here." },
    Drafts: { title: "No drafts", hint: "Posts you save without publishing appear here." },
    Archived: { title: "No archived posts", hint: "Posts you archive move here. You can restore them any time." },
};

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

    return (
        <div>
            <div className="staff-page-header">
                <div>
                    <h1>Blog Posts</h1>
                    <p className="staff-page-sub">The clinic&apos;s voice — posts have no author byline on the public site.</p>
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

            <div className="staff-table-wrap">
                <table className="staff-table">
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
                        {loading ? <StaffSkeletonRows columns={6} label="Loading posts…" /> : visible.length === 0 && (
                            <tr className="staff-table-state"><td colSpan={6}>
                                <StaffEmpty
                                    icon={Newspaper}
                                    title={EMPTY[filter].title}
                                    hint={EMPTY[filter].hint}
                                    action={filter === "All" ? <button className="staff-btn staff-btn-primary staff-btn-sm" onClick={() => router.push("/admin/blog/new")}><Plus size={15} aria-hidden="true" />New Post</button> : undefined}
                                />
                            </td></tr>
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

                .filter-row { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
                .chip {
                    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
                    color: rgba(255,255,255,0.65); padding: 0.4rem 0.9rem; border-radius: 999px;
                    font-size: var(--staff-size-sm); font-weight: 600; cursor: pointer; font-family: inherit;
                    display: inline-flex; align-items: center; gap: 0.4rem; transition: all 0.15s;
                }
                .chip:hover { background: rgba(255,255,255,0.08); }
                .chip.active { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.3); color: #fff; }
                .chip-count { color: rgba(255,255,255,0.4); font-weight: 500; }
                .chip.active .chip-count { color: rgba(255,255,255,0.7); }

                .staff-table { min-width: 680px; }
                .staff-table td { vertical-align: top; }
                .title-cell { font-weight: 500; }
                .sub-line { font-size: var(--staff-size-xs); color: rgba(255,255,255,0.35); margin-top: 0.15rem; }
                .lang-chip {
                    border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 0.15rem 0.45rem;
                    font-size: var(--staff-size-xs); font-weight: 700; color: rgba(255,255,255,0.7);
                }
                .status-pill { padding: 0.25rem 0.6rem; border-radius: 999px; font-size: var(--staff-size-xs); font-weight: 600; white-space: nowrap; }
                .status-published { background: rgba(16,185,129,0.15); color: #6ee7b7; }
                .status-scheduled { background: rgba(96,165,250,0.15); color: #93c5fd; }
                .status-archived { background: rgba(245,158,11,0.13); color: #fcd34d; }
                .status-draft { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.5); }
                .btn-sm { padding: 0.3rem 0.7rem; border-radius: 6px; font-size: var(--staff-size-sm); border: none; cursor: pointer; font-weight: 500; font-family: inherit; }
                .btn-restore { background: rgba(16,185,129,0.15); color: #6ee7b7; }
                .btn-restore:hover { background: rgba(16,185,129,0.25); }
            `}</style>
        </div>
    );
}
