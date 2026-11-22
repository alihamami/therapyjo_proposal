"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { parseWorkingHours, formatWorkingHours, isLegacyWorkingHours } from "@/lib/workingHours";
import { clinicalFileUrl } from "@/lib/storageUrl";
import { Archive, ChevronRight, Contact, Pencil, Plus, RotateCcw, Trash2, UserX } from "lucide-react";
import RowMenu from "@/app/components/RowMenu";
import { shouldOpenRow } from "@/lib/rowLink";
import { useConfirm } from "@/app/components/ConfirmDialog";
import StaffModal from "@/app/components/StaffModal";
import StaffEmpty from "@/app/components/StaffEmpty";

interface Secretary {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    workingHours: string | null;
    status: "ACTIVE" | "RESIGNED";
    pictureUrl: string | null;
    username: string;
    canManageContent: boolean;
}

interface SecretaryForm {
    name: string;
    email: string;
    phone: string;
    workingHours: string;
    username: string;
    password: string;
    confirmPassword: string;
    adminPassword: string;
    canManageContent: boolean;
}

interface EmployeeDoc {
    id: number;
    fileName: string;
    filePath: string;
    fileType: string;
    fileSize: number;
    uploadedAt: string;
}

const FILTERS = ["Active", "Archived"] as const;

function statusFor(filter: (typeof FILTERS)[number]) {
    return filter === "Archived" ? "RESIGNED" : "ACTIVE";
}

export default function SecretariesPage() {
    const confirm = useConfirm();
    const router = useRouter();
    const [secretaries, setSecretaries] = useState<Secretary[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<Secretary | null>(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState<SecretaryForm>({
        name: "", email: "", phone: "", workingHours: "", username: "", password: "", confirmPassword: "", adminPassword: "",
        canManageContent: false,
    });
    const [showPassword, setShowPassword] = useState(false);
    const [formError, setFormError] = useState("");
    const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Active");
    const [hoursFrom, setHoursFrom] = useState("");
    const [hoursTo, setHoursTo] = useState("");
    const [legacyHours, setLegacyHours] = useState("");
    const [docs, setDocs] = useState<EmployeeDoc[]>([]);
    const [docsLoading, setDocsLoading] = useState(false);
    const [uploadingName, setUploadingName] = useState("");
    const [removingId, setRemovingId] = useState<number | null>(null);
    const [docError, setDocError] = useState("");
    const [deleteTarget, setDeleteTarget] = useState<Secretary | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState("");
    const [deleteError, setDeleteError] = useState("");
    const [deleting, setDeleting] = useState(false);

    const fetchSecretaries = useCallback(async () => {
        try {
            const res = await fetch("/api/employees/secretaries");
            const data = await res.json();
            // A signed-out request now comes back as a 401 (see auth.config.ts),
            // but res.json() on any non-array body — that 401's own JSON included
            // — would otherwise poison the table with something to .map() over.
            setSecretaries(Array.isArray(data) ? data : []);
        } catch {
            // A thrown res.json() (dropped connection, non-JSON body) is not
            // recoverable here — fail quietly with an empty list rather than
            // letting the rejection escape uncaught from this effect.
            setSecretaries([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchSecretaries(); }, [fetchSecretaries]);

    const loadDocs = useCallback(async (userId: string) => {
        setDocsLoading(true);
        setDocError("");
        try {
            const res = await fetch(`/api/employees/files?userId=${userId}`);
            if (!res.ok) {
                setDocs([]);
                setDocError("Could not load documents.");
                return;
            }
            setDocs(await res.json());
        } catch {
            // res.json() throwing (malformed body) is the same failure to the
            // user as a non-OK response — surface the same message instead of
            // leaving docsLoading stuck true with an uncaught rejection.
            setDocs([]);
            setDocError("Could not load documents.");
        } finally {
            setDocsLoading(false);
        }
    }, []);

    const counts = useMemo(() => ({
        Active: secretaries.filter((sec) => sec.status === "ACTIVE").length,
        Archived: secretaries.filter((sec) => sec.status === "RESIGNED").length,
    }), [secretaries]);

    const visible = useMemo(
        () => secretaries.filter((sec) => sec.status === statusFor(filter)),
        [secretaries, filter]
    );

    const openEdit = (sec: Secretary) => {
        setEditing(sec);
        setForm({
            name: sec.name, email: sec.email || "", phone: sec.phone || "",
            workingHours: sec.workingHours || "", username: sec.username, password: "",
            confirmPassword: "", adminPassword: "", canManageContent: sec.canManageContent,
        });
        setShowPassword(false);
        setFormError("");
        const parsed = parseWorkingHours(sec.workingHours);
        setHoursFrom(parsed?.from ?? "");
        setHoursTo(parsed?.to ?? "");
        setLegacyHours(isLegacyWorkingHours(sec.workingHours) ? (sec.workingHours ?? "") : "");
        setDocs([]);
        setDocError("");
        setUploadingName("");
        loadDocs(sec.id);
    };

    const handleSave = async () => {
        if (!editing) return;
        setFormError("");

        if (form.password) {
            if (form.password.length < 8) {
                setFormError("Password must be at least 8 characters");
                return;
            }
            if (form.password !== form.confirmPassword) {
                setFormError("Passwords do not match");
                return;
            }
            if (!form.adminPassword) {
                setFormError("Enter your own password to confirm this change");
                return;
            }
        }

        setSaving(true);
        const body: Record<string, string | boolean> = {
            name: form.name, email: form.email, phone: form.phone,
            workingHours: form.workingHours,
            canManageContent: form.canManageContent,
        };
        if (form.username.trim() !== editing.username) {
            body.username = form.username.trim();
        }
        if (form.password) {
            body.password = form.password;
            body.adminPassword = form.adminPassword;
        }

        const res = await fetch(`/api/employees/secretaries/${editing.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        setSaving(false);

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setFormError(data.error || "Failed to save secretary");
            return;
        }

        setEditing(null);
        fetchSecretaries();
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !editing) return;
        e.target.value = "";   // let the same file be picked again after a failure
        setDocError("");
        setUploadingName(file.name);

        const fd = new FormData();
        fd.append("file", file);
        fd.append("folder", "employee-files");
        const up = await fetch("/api/upload", { method: "POST", body: fd });
        if (!up.ok) {
            setUploadingName("");
            setDocError("Upload failed.");
            return;
        }
        const { path, contentType } = await up.json();

        // fileType comes from the response, not the picked file: /api/upload
        // re-encodes images to WebP, so file.type would be a lie. fileSize is
        // the size as picked — the endpoint does not report the stored length,
        // so it is exact for documents and approximate for a re-encoded image.
        const res = await fetch("/api/employees/files", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId: editing.id,
                fileName: file.name,
                filePath: path,
                fileType: contentType,
                fileSize: file.size,
            }),
        });
        setUploadingName("");
        if (!res.ok) {
            setDocError("Could not attach the document.");
            return;
        }
        loadDocs(editing.id);
    };

    const handleRemoveDoc = async (docId: number) => {
        if (!editing) return;
        setDocError("");
        setRemovingId(docId);
        // res.ok is the only success signal. The response also carries
        // objectRemoved, which is false whenever SUPABASE_SERVICE_ROLE_KEY is
        // unset — the row is still gone, so surfacing it would report a
        // failure that did not happen. Do not read it.
        const res = await fetch(`/api/employees/files/${docId}`, { method: "DELETE" });
        setRemovingId(null);
        if (!res.ok) {
            setDocError("Could not remove the document.");
            return;
        }
        loadDocs(editing.id);
    };

    const handleResign = async (id: string) => {
        const name = secretaries.find((s) => s.id === id)?.name;
        if (!(await confirm({
            title: `Resign ${name ?? "this secretary"}?`,
            message: "They move to Archived and can be re-enrolled later.",
            confirmLabel: "Resign",
        }))) return;
        await fetch(`/api/employees/secretaries/${id}`, { method: "DELETE" });
        fetchSecretaries();
    };

    const handleReEnrol = async (id: string) => {
        await fetch(`/api/employees/secretaries/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "ACTIVE" }),
        });
        fetchSecretaries();
    };

    const openDelete = (sec: Secretary) => {
        setDeleteTarget(sec);
        setDeleteConfirm("");
        setDeleteError("");
    };

    const handleHardDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        setDeleteError("");
        const res = await fetch(`/api/employees/secretaries/${deleteTarget.id}?hard=true`, {
            method: "DELETE",
        });
        setDeleting(false);
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setDeleteError(data.error || "Could not delete this secretary.");
            return;
        }
        setDeleteTarget(null);
        fetchSecretaries();
    };

    if (loading) {
        return <p className="staff-loading" role="status">Loading…</p>;
    }

    return (
        <div>
            <div className="staff-page-header">
                <h1>Secretaries</h1>
                <button className="staff-btn staff-btn-primary" onClick={() => router.push("/admin/employees/secretaries/new")}><Plus size={15} aria-hidden="true" />Add Secretary</button>
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
                            <th>Status</th>
                            <th>Name</th>
                            <th>Phone</th>
                            <th>Email</th>
                            <th>Working Hours</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map((sec) => (
                            <tr key={sec.id} className="staff-row-link" onClick={(e) => { if (shouldOpenRow(e)) openEdit(sec); }}>
                                <td>
                                    <span className={`status-badge ${sec.status === "ACTIVE" ? "active" : "resigned"}`}>
                                        {sec.status}
                                    </span>
                                </td>
                                <td>
                                    <button type="button" className="staff-row-name" onClick={() => openEdit(sec)}>{sec.name}</button>
                                    {sec.username && <div className="employee-username">{sec.username}</div>}
                                </td>
                                <td>{sec.phone || "—"}</td>
                                <td>{sec.email || "—"}</td>
                                <td>{sec.workingHours || "—"}</td>
                                <td>
                                    <div className="staff-row-end">
                                        <RowMenu
                                            label={`More actions for ${sec.name}`}
                                            items={sec.status === "ACTIVE" ? [
                                                { label: "Edit", icon: Pencil, onSelect: () => openEdit(sec) },
                                                { label: "Resign", icon: UserX, onSelect: () => handleResign(sec.id), destructive: true },
                                            ] : [
                                                { label: "Edit", icon: Pencil, onSelect: () => openEdit(sec) },
                                                { label: "Re-enrol", icon: RotateCcw, onSelect: () => handleReEnrol(sec.id) },
                                                { label: "Delete permanently", icon: Trash2, onSelect: () => openDelete(sec), destructive: true },
                                            ]}
                                        />
                                        <ChevronRight size={16} className="staff-row-chevron" aria-hidden="true" />
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {visible.length === 0 && (
                            <tr className="staff-table-state"><td colSpan={6}>
                                {filter === "Archived" ? (
                                    <StaffEmpty icon={Archive} title="No archived secretaries" hint="Secretaries who resign move here. You can re-enrol them any time." />
                                ) : (
                                    <StaffEmpty
                                        icon={Contact}
                                        title="No active secretaries"
                                        hint="Secretaries you add can sign in and manage bookings."
                                        action={<button className="staff-btn staff-btn-primary staff-btn-sm" onClick={() => router.push("/admin/employees/secretaries/new")}><Plus size={15} aria-hidden="true" />Add Secretary</button>}
                                    />
                                )}
                            </td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Edit Secretary (design 2B, TJ-069d3) */}
            {editing && (
                <StaffModal
                    title="Edit Secretary"
                    wide
                    onClose={() => setEditing(null)}
                    closeDisabled={saving}
                    footer={<>
                        <button className="staff-btn staff-btn-secondary" onClick={() => setEditing(null)} disabled={saving}>Cancel</button>
                        <button
                            className="staff-btn staff-btn-primary"
                            aria-busy={saving}
                            onClick={handleSave}
                            disabled={saving || !form.name || !form.username.trim()}
                        >
                            {saving ? "Saving…" : "Save"}
                        </button>
                    </>}
                >
                    {formError && <div className="staff-form-error" role="alert">{formError}</div>}

                    <div className="form-grid">
                        <div className="staff-field">
                            <label htmlFor="edit-name">Name *</label>
                            <input id="edit-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                        </div>
                        <div className="staff-field">
                            <label htmlFor="edit-phone">Phone</label>
                            <input id="edit-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                        </div>
                        <div className="staff-field wide">
                            <label htmlFor="edit-email">Email</label>
                            <input id="edit-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                        </div>
                        <div className="staff-field wide">
                            <label>Working Hours</label>
                            <div className="hours-row">
                                <input
                                    type="time"
                                    aria-label="Start time"
                                    value={hoursFrom}
                                    onChange={(e) => {
                                        setHoursFrom(e.target.value);
                                        setForm({ ...form, workingHours: formatWorkingHours(e.target.value, hoursTo) });
                                    }}
                                />
                                <span className="hours-sep">to</span>
                                <input
                                    type="time"
                                    aria-label="End time"
                                    value={hoursTo}
                                    onChange={(e) => {
                                        setHoursTo(e.target.value);
                                        setForm({ ...form, workingHours: formatWorkingHours(hoursFrom, e.target.value) });
                                    }}
                                />
                            </div>
                            {legacyHours && <span className="staff-field-hint">Currently: {legacyHours}</span>}
                        </div>
                        <div className="staff-field">
                            <label htmlFor="edit-username">Username *</label>
                            <input id="edit-username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                            {form.username.trim() !== editing.username && (
                                <span className="staff-field-hint">They sign in with this from now on.</span>
                            )}
                        </div>
                        <div className="staff-field">
                            <label htmlFor="edit-password">New Password (optional)</label>
                            <div className="password-wrap">
                                <input
                                    id="edit-password"
                                    type={showPassword ? "text" : "password"}
                                    value={form.password}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                />
                                <button
                                    type="button"
                                    className="toggle-password"
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.4 0 10 7 10 7a17.6 17.6 0 0 1-2.2 3.15M6.6 6.6A17.7 17.7 0 0 0 2 11s3.6 7 10 7a9 9 0 0 0 4.4-1.1" />
                                            <path d="m2 2 20 20" />
                                            <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                                        </svg>
                                    ) : (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
                                            <circle cx="12" cy="12" r="3" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                            <span className="staff-field-hint">At least 8 characters.</span>
                        </div>
                        <div className="staff-field">
                            <label htmlFor="edit-password-repeat">Repeat New Password</label>
                            <input
                                id="edit-password-repeat"
                                type={showPassword ? "text" : "password"}
                                value={form.confirmPassword}
                                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                            />
                        </div>
                        {form.password && (
                            <div className="staff-field">
                                <label htmlFor="edit-admin-password">Your Password *</label>
                                <input
                                    id="edit-admin-password"
                                    type="password"
                                    value={form.adminPassword}
                                    onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
                                />
                                <span className="staff-field-hint">Confirm it is you before changing someone else&apos;s password.</span>
                            </div>
                        )}
                    </div>

                    <div className="staff-form-section">
                        <p className="staff-form-section-title">Content management</p>
                        <label className="grant-row">
                            <input
                                type="checkbox"
                                checked={form.canManageContent}
                                onChange={(e) => setForm({ ...form, canManageContent: e.target.checked })}
                            />
                            <span>May manage Blog, public Doctor profiles, and Approvals</span>
                        </label>
                        <span className="staff-field-hint">Takes effect at their next sign-in.</span>
                    </div>

                    <div className="staff-form-section">
                        <p className="staff-form-section-title">Documents</p>
                        {docError && <div className="staff-form-error" role="alert">{docError}</div>}
                        <input
                            type="file"
                            className="doc-input"
                            aria-label="Upload a document"
                            disabled={!!uploadingName}
                            onChange={handleUpload}
                        />
                        {docsLoading ? (
                            <span className="staff-field-hint">Loading documents…</span>
                        ) : (
                            <ul className="doc-list">
                                {uploadingName && (
                                    <li className="doc-row uploading">
                                        <span className="doc-icon">⏳</span>
                                        <span className="doc-name">Uploading {uploadingName}…</span>
                                    </li>
                                )}
                                {docs.map((d) => (
                                    <li key={d.id} className="doc-row">
                                        <span className="doc-icon">{d.fileType.includes("image") ? "🖼" : "📄"}</span>
                                        <a
                                            className="doc-name"
                                            href={clinicalFileUrl(d.filePath)}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            {d.fileName}
                                        </a>
                                        <button
                                            type="button"
                                            className="btn-sm btn-delete"
                                            disabled={removingId === d.id}
                                            onClick={() => handleRemoveDoc(d.id)}
                                        >
                                            {removingId === d.id ? "Removing…" : "Remove"}
                                        </button>
                                    </li>
                                ))}
                                {docs.length === 0 && !uploadingName && (
                                    <li className="doc-empty">No documents yet</li>
                                )}
                            </ul>
                        )}
                        <span className="staff-field-hint">Documents are saved immediately — they do not wait for Save.</span>
                    </div>
                </StaffModal>
            )}

            {deleteTarget && (
                <StaffModal
                    title={`Delete ${deleteTarget.name}?`}
                    onClose={() => setDeleteTarget(null)}
                    closeDisabled={deleting}
                    footer={<>
                        <button className="staff-btn staff-btn-secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
                        <button
                            className="staff-btn staff-btn-danger"
                            aria-busy={deleting}
                            onClick={handleHardDelete}
                            disabled={deleting || deleteConfirm !== deleteTarget.name}
                        >
                            {deleting ? "Deleting…" : "Delete permanently"}
                        </button>
                    </>}
                >
                    <p className="staff-modal-text">
                        This permanently removes the account and cannot be undone. It is refused if
                        this secretary has any reservations, notes, or a linked public profile.
                    </p>
                    {deleteError && <div className="staff-form-error" role="alert">{deleteError}</div>}
                    <div className="staff-field">
                        <label htmlFor="delete-confirm">Type <strong>{deleteTarget.name}</strong> to confirm</label>
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
          font-size: 0.8rem; font-weight: 600; cursor: pointer; font-family: inherit;
          display: inline-flex; align-items: center; gap: 0.4rem; transition: all 0.15s;
        }
        .chip:hover { background: rgba(255,255,255,0.08); }
        .chip.active { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.3); color: #fff; }
        .chip-count { color: rgba(255,255,255,0.4); font-weight: 500; }
        .chip.active .chip-count { color: rgba(255,255,255,0.7); }
        .staff-table { min-width: 640px; }
        .employee-username { margin-top: 0.15rem; font-size: 0.78rem; color: rgba(255,255,255,0.45); }
        .status-badge { padding: 0.25rem 0.6rem; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
        .status-badge.active { background: rgba(16,185,129,0.15); color: #6ee7b7; }
        .status-badge.resigned { background: rgba(239,68,68,0.15); color: #fca5a5; }
        .btn-sm {
          padding: 0.3rem 0.7rem; border-radius: 6px; font-size: 0.8rem;
          border: none; cursor: pointer; font-weight: 500; font-family: inherit;
        }
        .btn-delete { background: rgba(239,68,68,0.15); color: #fca5a5; }
        .btn-delete:hover { background: rgba(239,68,68,0.25); }
        /* minmax(0, 1fr), not 1fr: a 1fr track never shrinks below its widest
           field, and the working-hours row pushed both columns past the modal. (TJ-020) */
        .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
        .form-grid > .wide { grid-column: 1 / -1; }
        .hours-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
        /* A time input needs about 125px to show "09:00 AM" and its clock
           icon (measured). 9.5rem leaves room for that; below it the row
           wraps rather than clipping the time. (TJ-020) */
        .hours-row input { flex: 1 1 9.5rem; min-width: 0; }
        .hours-sep { font-size: 0.8rem; color: rgba(255,255,255,0.4); flex-shrink: 0; }
        .password-wrap { position: relative; }
        .password-wrap input { width: 100%; padding-inline-end: 2.4rem; }
        .toggle-password {
          position: absolute; inset-inline-end: 0.5rem; top: 50%; transform: translateY(-50%);
          background: none; border: none; padding: 0.15rem; line-height: 0;
          color: rgba(255,255,255,0.45); cursor: pointer;
        }
        .toggle-password:hover { color: #fff; }
        .doc-input { font-size: 0.82rem; color: rgba(255,255,255,0.6); }
        .doc-input::file-selector-button {
          margin-inline-end: 0.75rem; padding: 0.35rem 0.85rem;
          background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.85);
          border: 1px solid rgba(255,255,255,0.14); border-radius: 6px;
          font-family: inherit; font-size: 0.8rem; font-weight: 500; cursor: pointer;
        }
        .doc-input::file-selector-button:hover { background: rgba(255,255,255,0.14); }
        .doc-list {
          list-style: none; display: flex; flex-direction: column;
          gap: 0.4rem; margin: 0.5rem 0 0.5rem; padding: 0;
        }
        .doc-row {
          display: flex; align-items: center; gap: 0.6rem;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06);
          border-radius: 8px; padding: 0.5rem 0.7rem;
        }
        .doc-icon { flex-shrink: 0; }
        .doc-name {
          flex: 1; min-width: 0; font-size: 0.82rem; color: #fff;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          text-decoration: none;
        }
        a.doc-name:hover { text-decoration: underline; }
        .doc-row.uploading .doc-name { color: rgba(255,255,255,0.5); }
        .doc-empty { font-size: 0.8rem; color: rgba(255,255,255,0.35); padding: 0.25rem 0; }
        .grant-row { display: flex; align-items: center; gap: 0.6rem; cursor: pointer; }
        .grant-row input[type="checkbox"] {
          width: 16px; height: 16px; flex-shrink: 0;
          margin: 0; padding: 0; border: none; background: none;
          border-radius: 0; accent-color: #10b981; cursor: pointer;
        }
        .grant-row span { font-size: 0.85rem; color: rgba(255,255,255,0.85); font-weight: 400; }

        @media (max-width: 560px) {
          .form-grid { grid-template-columns: minmax(0, 1fr); }
          .btn-sm { padding: 0.45rem 0.75rem; }
        }
      `}</style>
        </div>
    );
}
