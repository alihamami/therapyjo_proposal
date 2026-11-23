"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { clinicalFileUrl } from "@/lib/storageUrl";
import { isMissingPhone } from "@/lib/phone";
import { Archive, CalendarDays, FileText, ImageIcon, Pencil, Phone } from "lucide-react";
import RowMenu from "@/app/components/RowMenu";
import { useConfirm } from "@/app/components/ConfirmDialog";
import StaffModal from "@/app/components/StaffModal";
import StaffEmpty from "@/app/components/StaffEmpty";

interface PatientData {
    id: number;
    name: string;
    phone1: string;
    phone2: string | null;
    pictureUrl: string | null;
    archived: boolean;
    lastVisitDate: string | null;
    createdAt: string;
    updatedAt: string;
    updatedBy: { name: string; role: string } | null;
    files: PatientFile[];
    reservations: Reservation[];
}

interface PatientFile {
    id: number;
    fileName: string;
    filePath: string;
    fileType: string;
    uploadedAt: string;
}

interface Reservation {
    id: number;
    sessionDate: string;
    sessionTime: string;
    status: string;
    paymentType: string | null;
    injuryPlace: string | null;
    doctor: { id: string; name: string; color: string | null } | null;
    doctorNameSnapshot: string | null;
    doctorColorSnapshot: string | null;
}

export default function SecretaryPatientProfile({ params }: { params: Promise<{ id: string }> }) {
    const confirm = useConfirm();
    const { id } = use(params);
    const router = useRouter();
    const [patient, setPatient] = useState<PatientData | null>(null);
    const [loading, setLoading] = useState(true);
    const [editingInfo, setEditingInfo] = useState(false);
    const [infoForm, setInfoForm] = useState({ name: "", phone1: "", phone2: "" });
    const [savingInfo, setSavingInfo] = useState(false);
    const [activeTab, setActiveTab] = useState<"sessions" | "files">("sessions");
    const [uploadingName, setUploadingName] = useState("");
    const [removingId, setRemovingId] = useState<number | null>(null);
    const [fileError, setFileError] = useState("");

    const fetchPatient = useCallback(async () => {
        const res = await fetch(`/api/patients/${id}`);
        if (!res.ok) { router.push("/secretary/patients"); return; }
        const data = await res.json();
        setPatient(data);
        setInfoForm({ name: data.name, phone1: data.phone1, phone2: data.phone2 || "" });
        setLoading(false);
    }, [id, router]);

    useEffect(() => { fetchPatient(); }, [fetchPatient]);

    const saveInfo = async () => {
        setSavingInfo(true);
        await fetch(`/api/patients/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(infoForm),
        });
        setSavingInfo(false);
        setEditingInfo(false);
        fetchPatient();
    };

    const handleArchiveToggle = async () => {
        const name = patient?.name ?? "this patient";
        if (!(await confirm(patient?.archived
            ? { title: `Restore ${name}?`, message: "They move back to the active patient list.", confirmLabel: "Restore" }
            : { title: `Archive ${name}?`, message: "They move to Archived Patients. Their file stays, and you can restore them any time.", confirmLabel: "Archive" }
        ))) return;
        await fetch(`/api/patients/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ archived: !patient?.archived }),
        });
        fetchPatient();
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = "";   // let the same file be picked again after a failure
        setFileError("");
        setUploadingName(file.name);

        const fd = new FormData();
        fd.append("file", file);
        fd.append("folder", "patient-files");
        const up = await fetch("/api/upload", { method: "POST", body: fd });
        if (!up.ok) {
            setUploadingName("");
            setFileError("Upload failed.");
            return;
        }
        const { path, contentType } = await up.json();

        const res = await fetch(`/api/patients/${id}/files`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                fileName: file.name,
                filePath: path,
                fileType: contentType,
                fileSize: file.size,
            }),
        });
        setUploadingName("");
        if (!res.ok) {
            setFileError("Could not attach the document.");
            return;
        }
        fetchPatient();
    };

    const handleRemoveFile = async (fileId: number) => {
        const fileName = patient?.files.find((f) => f.id === fileId)?.fileName;
        if (!(await confirm({
            title: "Remove this file?",
            message: `${fileName ? `"${fileName}"` : "The file"} is removed from ${patient?.name ?? "this patient"}'s documents for good. This can't be undone.`,
            confirmLabel: "Remove",
            tone: "danger",
        }))) return;
        setFileError("");
        setRemovingId(fileId);
        const res = await fetch(`/api/patients/${id}/files/${fileId}`, { method: "DELETE" });
        setRemovingId(null);
        if (!res.ok) {
            setFileError("Could not remove the document.");
            return;
        }
        fetchPatient();
    };

    const formatDate = (d: string | null) => {
        if (!d) return "—";
        return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    };

    const statusColors: Record<string, string> = {
        SCHEDULED: "#60a5fa", WAITING: "#fbbf24", CHECKED_IN: "#34d399",
        WITH_DOCTOR: "#a78bfa", CHECKED_OUT: "rgba(255,255,255,0.35)",
    };

    if (loading) return <p className="staff-loading" role="status">Loading…</p>;
    if (!patient) return null;

    return (
        <div>
            {/* Header */}
            <div className="profile-header">
                <button className="staff-back" onClick={() => router.push("/secretary/patients")}>← Back</button>
                <div className="header-main">
                    <div className="header-info">
                        <h1>{patient.name}</h1>
                        <div className="header-meta">
                            <span className="staff-inline-icon"><Phone size={13} aria-hidden="true" />{isMissingPhone(patient.phone1) ? <span className="no-phone">No phone</span> : <a href={`tel:${patient.phone1}`}>{patient.phone1}</a>}</span>
                            {patient.phone2 && <span className="staff-inline-icon"><Phone size={13} aria-hidden="true" /><a href={`tel:${patient.phone2}`}>{patient.phone2}</a></span>}
                            <span>Last visit: {formatDate(patient.lastVisitDate)}</span>
                            <span>Patient #{patient.id}</span>
                        </div>
                        {patient.updatedBy && (
                            <p className="updated-by">
                                Last updated by {patient.updatedBy.name} ({patient.updatedBy.role}) on {formatDate(patient.updatedAt)}
                            </p>
                        )}
                    </div>
                    <div className="header-actions">
                        {patient.archived && <span className="badge-archived">ARCHIVED</span>}
                        <button className="staff-btn staff-btn-secondary staff-btn-sm" onClick={() => setEditingInfo(true)}>
                            <Pencil size={14} aria-hidden="true" />Edit Info
                        </button>
                        {patient.archived ? (
                            <button className="staff-btn staff-btn-sm btn-restore" onClick={handleArchiveToggle}>Restore</button>
                        ) : (
                            <RowMenu
                                label="More actions for this patient"
                                items={[{ label: "Archive", icon: Archive, onSelect: handleArchiveToggle }]}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Edit Info Modal — name + phones only (design 2B, TJ-069d1) */}
            {editingInfo && (
                <StaffModal
                    title="Update Patient Info"
                    onClose={() => setEditingInfo(false)}
                    footer={<>
                        <button className="staff-btn staff-btn-secondary" onClick={() => setEditingInfo(false)}>Cancel</button>
                        <button className="staff-btn staff-btn-primary" aria-busy={savingInfo} onClick={saveInfo} disabled={savingInfo}>
                            {savingInfo ? "Saving…" : "Save"}
                        </button>
                    </>}
                >
                    <div className="staff-field">
                        <label htmlFor="info-name">Name</label>
                        <input id="info-name" value={infoForm.name} onChange={(e) => setInfoForm({ ...infoForm, name: e.target.value })} autoFocus />
                    </div>
                    <div className="staff-field-row">
                        <div className="staff-field">
                            <label htmlFor="info-phone1">Phone 1</label>
                            <input id="info-phone1" value={infoForm.phone1} onChange={(e) => setInfoForm({ ...infoForm, phone1: e.target.value })} />
                        </div>
                        <div className="staff-field">
                            <label htmlFor="info-phone2">Phone 2</label>
                            <input id="info-phone2" value={infoForm.phone2} onChange={(e) => setInfoForm({ ...infoForm, phone2: e.target.value })} />
                            <span className="staff-field-hint">Optional</span>
                        </div>
                    </div>
                </StaffModal>
            )}

            {/* Tabs — NO clinical intake tab for secretary */}
            <div className="tabs">
                <button className={`tab ${activeTab === "sessions" ? "active" : ""}`} onClick={() => setActiveTab("sessions")}>Sessions ({patient.reservations.length})</button>
                <button className={`tab ${activeTab === "files" ? "active" : ""}`} onClick={() => setActiveTab("files")}>Files ({patient.files.length})</button>
            </div>

            {/* Sessions Tab */}
            {activeTab === "sessions" && (
                <div className="section-card">
                    {patient.reservations.length === 0 ? (
                        <StaffEmpty icon={CalendarDays} title="No sessions yet" hint="Sessions booked for this patient appear here." />
                    ) : (
                        <table className="staff-table staff-table-compact">
                            <thead><tr><th>Date</th><th>Doctor</th><th>Status</th><th>Payment</th><th>Injury</th></tr></thead>
                            <tbody>
                                {patient.reservations.map((r) => (
                                    <tr key={r.id}>
                                        <td>{formatDate(r.sessionDate)}</td>
                                        <td><span className="doctor-tag" style={{ borderColor: r.doctor?.color || "#666" }}>{r.doctor?.name ?? r.doctorNameSnapshot ?? "—"}</span></td>
                                        <td><span className="status-dot" style={{ background: statusColors[r.status] || "#666" }} />{r.status.replace("_", " ")}</td>
                                        <td>{r.paymentType || "—"}</td>
                                        <td>{r.injuryPlace || "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* Files Tab */}
            {activeTab === "files" && (
                <div className="section-card">
                    {fileError && <div className="error-msg" role="alert">{fileError}</div>}

                    <div className="file-upload-row">
                        <input
                            type="file"
                            className="file-input"
                            aria-label="Upload a document"
                            disabled={!!uploadingName}
                            onChange={handleUpload}
                        />
                        <span className="field-hint">
                            {uploadingName ? `Uploading ${uploadingName}…` : "Saved immediately — no separate Save step."}
                        </span>
                    </div>

                    {patient.files.length === 0 && !uploadingName ? (
                        <StaffEmpty icon={FileText} title="No files yet" hint="Files you upload above appear here." />
                    ) : (
                        <div className="files-grid">
                            {patient.files.map((f) => (
                                <div key={f.id} className="file-card">
                                    <a href={clinicalFileUrl(f.filePath)} target="_blank" rel="noreferrer" className="file-open">
                                        <span className="file-icon">{f.fileType.includes("image") ? <ImageIcon size={24} aria-hidden="true" /> : <FileText size={24} aria-hidden="true" />}</span>
                                        <span className="file-name">{f.fileName}</span>
                                        <span className="file-date">{formatDate(f.uploadedAt)}</span>
                                    </a>
                                    <button
                                        type="button"
                                        className="btn-sm btn-remove"
                                        disabled={removingId === f.id}
                                        onClick={() => handleRemoveFile(f.id)}
                                    >
                                        {removingId === f.id ? "Removing…" : "Remove"}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <style jsx>{`
                .profile-header { margin-bottom: 1.5rem; }
                .header-main { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
                .header-info h1 { font-size: var(--staff-size-xl); font-weight: 600; margin-bottom: 0.35rem; }
                .header-meta { display: flex; gap: 1.25rem; flex-wrap: wrap; color: rgba(255,255,255,0.45); font-size: var(--staff-size-base); }
                .header-meta a { color: var(--primary, #4CAF93); text-decoration: none; }
                .header-meta a:hover { text-decoration: underline; }
                .updated-by { margin-top: 0.4rem; color: rgba(255,255,255,0.3); font-size: var(--staff-size-sm); }
                .header-actions { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
                .badge-archived { background: rgba(239,68,68,0.12); color: #fca5a5; padding: 0.2rem 0.6rem; border-radius: var(--radius-sm, 2px); font-size: var(--staff-size-xs); font-weight: 700; letter-spacing: 0.04em; }
                .btn-sm { padding: 0.3rem 0.7rem; border-radius: var(--radius-sm, 2px); font-size: var(--staff-size-sm); border: none; cursor: pointer; font-weight: 500; font-family: inherit; }
                .btn-edit { background: rgba(96,165,250,0.12); color: #93c5fd; }
                .btn-edit:hover { background: rgba(96,165,250,0.22); }
                .btn-restore { background: rgba(96,165,250,0.12); color: #93c5fd; border: 1px solid transparent; }
                .btn-restore:hover { background: rgba(96,165,250,0.22); }
                .tabs { display: flex; gap: 0; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.06); }
                .tab { background: none; border: none; color: rgba(255,255,255,0.4); padding: 0.7rem 1.2rem; font-size: var(--staff-size-base); font-weight: 500; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.15s; font-family: inherit; }
                .tab:hover { color: rgba(255,255,255,0.7); }
                .tab.active { color: var(--primary, #4CAF93); border-bottom-color: var(--primary, #4CAF93); }
                .section-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: var(--radius-md, 4px); padding: 1.5rem; }
                .doctor-tag { border-left: 3px solid; padding-left: 0.5rem; }
                .status-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 0.4rem; vertical-align: middle; }
                .file-upload-row { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.06); }
                .file-input { font-size: var(--staff-size-base); color: rgba(255,255,255,0.6); max-width: 100%; }
                .field-hint { font-size: var(--staff-size-xs); color: rgba(255,255,255,0.35); }
                .files-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.75rem; }
                .file-card { display: flex; flex-direction: column; align-items: center; gap: 0.35rem; padding: 1rem; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: var(--radius-sm, 2px); color: #fff; transition: background 0.15s; }
                .file-card:hover { background: rgba(255,255,255,0.08); }
                .file-open { display: flex; flex-direction: column; align-items: center; gap: 0.35rem; text-decoration: none; color: #fff; width: 100%; min-width: 0; }
                .btn-remove { background: rgba(239,68,68,0.15); color: #fca5a5; margin-top: 0.5rem; }
                .btn-remove:hover:not(:disabled) { background: rgba(239,68,68,0.25); }
                .btn-remove:disabled { opacity: 0.5; cursor: not-allowed; }
                .error-msg { background: rgba(220,38,38,0.1); border: 1px solid rgba(220,38,38,0.2); color: #fca5a5; padding: 0.5rem 0.75rem; border-radius: var(--radius-sm, 2px); font-size: var(--staff-size-base); margin-bottom: 1rem; }
                .file-icon { display: flex; color: var(--staff-muted); }
                .file-name { font-size: var(--staff-size-sm); text-align: center; word-break: break-all; }
                .file-date { font-size: var(--staff-size-xs); color: rgba(255,255,255,0.3); }
            `}</style>
        </div>
    );
}
