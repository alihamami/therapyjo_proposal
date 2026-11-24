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
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/reservationStatus";
import PatientSummary from "@/app/components/PatientSummary";

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

    if (loading) return <p className="staff-loading" role="status">Loading…</p>;
    if (!patient) return null;

    return (
        <div>
            {/* Header */}
            <div className="staff-record-head">
                <button className="staff-back" onClick={() => router.push("/secretary/patients")}>← Back</button>
                <div className="staff-record-top">
                    <div className="staff-record-info">
                        <h1>{patient.name}</h1>
                        <div className="staff-record-meta">
                            <span className="staff-inline-icon"><Phone size={13} aria-hidden="true" />{isMissingPhone(patient.phone1) ? <span className="no-phone">No phone</span> : <a href={`tel:${patient.phone1}`}>{patient.phone1}</a>}</span>
                            {patient.phone2 && <span className="staff-inline-icon"><Phone size={13} aria-hidden="true" /><a href={`tel:${patient.phone2}`}>{patient.phone2}</a></span>}
                            <span>Patient #{patient.id}</span>
                        </div>
                        {patient.updatedBy && (
                            <p className="staff-record-updated">
                                Last updated by {patient.updatedBy.name} ({patient.updatedBy.role}) on {formatDate(patient.updatedAt)}
                            </p>
                        )}
                    </div>
                    <div className="staff-record-actions">
                        {patient.archived && <span className="staff-badge-archived">ARCHIVED</span>}
                        <button className="staff-btn staff-btn-secondary staff-btn-sm" onClick={() => setEditingInfo(true)}>
                            <Pencil size={14} aria-hidden="true" />Edit Info
                        </button>
                        {patient.archived ? (
                            <button className="staff-btn staff-btn-secondary staff-btn-sm" onClick={handleArchiveToggle}>Restore</button>
                        ) : (
                            <RowMenu
                                label="More actions for this patient"
                                items={[{ label: "Archive", icon: Archive, onSelect: handleArchiveToggle }]}
                            />
                        )}
                    </div>
                </div>
                <PatientSummary reservations={patient.reservations} lastVisitDate={patient.lastVisitDate} clinical={false} seesFuture />
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
            <div className="staff-tabs">
                <button className={`staff-tab ${activeTab === "sessions" ? "active" : ""}`} onClick={() => setActiveTab("sessions")}>Sessions ({patient.reservations.length})</button>
                <button className={`staff-tab ${activeTab === "files" ? "active" : ""}`} onClick={() => setActiveTab("files")}>Files ({patient.files.length})</button>
            </div>

            {/* Sessions Tab */}
            {activeTab === "sessions" && (
                patient.reservations.length === 0 ? (
                    <div className="staff-panel">
                        <StaffEmpty icon={CalendarDays} title="No sessions yet" hint="Sessions booked for this patient appear here." />
                    </div>
                ) : (
                    <div className="staff-table-wrap">
                        <table className="staff-table staff-table-compact staff-table-wide">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Doctor</th>
                                    <th>Status</th>
                                    <th>Payment</th>
                                    <th>Injury</th>
                                </tr>
                            </thead>
                            <tbody>
                                {patient.reservations.map((r) => (
                                    <tr key={r.id}>
                                        <td>{formatDate(r.sessionDate)}</td>
                                        <td>
                                            <span className="staff-doctor">
                                                <span className="staff-doctor-dot" aria-hidden="true" style={{ background: r.doctor?.color ?? r.doctorColorSnapshot ?? undefined }} />
                                                {r.doctor?.name ?? r.doctorNameSnapshot ?? "—"}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="staff-status" style={{ color: STATUS_COLORS[r.status] }}>
                                                <span className="staff-status-dot" aria-hidden="true" />
                                                {STATUS_LABELS[r.status] ?? r.status}
                                            </span>
                                        </td>
                                        <td>{r.paymentType || "—"}</td>
                                        <td>{r.injuryPlace || "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            )}

            {/* Files Tab */}
            {activeTab === "files" && (
                <div className="staff-record-panel">
                    {fileError && <div className="staff-form-error" role="alert">{fileError}</div>}

                    <div className="staff-files-upload">
                        <input
                            type="file"
                            aria-label="Upload a document"
                            disabled={!!uploadingName}
                            onChange={handleUpload}
                        />
                        <span className="staff-field-hint">
                            {uploadingName ? `Uploading ${uploadingName}…` : "Saved immediately — no separate Save step."}
                        </span>
                    </div>

                    {patient.files.length === 0 && !uploadingName ? (
                        <StaffEmpty icon={FileText} title="No files yet" hint="Files you upload above appear here." />
                    ) : (
                        <div className="staff-files-grid">
                            {patient.files.map((f) => (
                                <div key={f.id} className="staff-file-card">
                                    <a
                                        href={clinicalFileUrl(f.filePath)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="staff-file-open"
                                    >
                                        <span className="staff-file-icon">{f.fileType.includes("image") ? <ImageIcon size={24} aria-hidden="true" /> : <FileText size={24} aria-hidden="true" />}</span>
                                        <span className="staff-file-name">{f.fileName}</span>
                                        <span className="staff-file-date">{formatDate(f.uploadedAt)}</span>
                                    </a>
                                    <button
                                        type="button"
                                        className="staff-btn staff-btn-secondary staff-btn-sm staff-file-remove"
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
        </div>
    );
}
