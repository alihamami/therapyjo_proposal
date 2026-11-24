"use client";

import { useState, useEffect, useCallback, use, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clinicalFileUrl } from "@/lib/storageUrl";
import { useUnsavedChanges } from "@/lib/useUnsavedChanges";
import ClinicalAssessment from "@/app/components/ClinicalAssessment";
import { isMissingPhone } from "@/lib/phone";
import { Archive, CalendarDays, FileText, History, ImageIcon, Pencil, Phone } from "lucide-react";
import RowMenu from "@/app/components/RowMenu";
import { useConfirm } from "@/app/components/ConfirmDialog";
import StaffModal from "@/app/components/StaffModal";
import StaffEmpty from "@/app/components/StaffEmpty";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/reservationStatus";

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

interface AuditEntry {
    id: number;
    action: string;
    summary: string | null;
    createdAt: string;
    user: { name: string; role: string } | null;
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
    soapNote: SoapNote | null;
}

interface SoapNote {
    subjective: string | null;
    objective: string | null;
    assessment: string | null;
    plan: string | null;
}

const ACTION_LABELS: Record<string, string> = {
    DEMOGRAPHICS_UPDATED: "Info updated",
    CLINICAL_INTAKE_UPDATED: "Clinical assessment updated",
    CLINICAL_INTAKE_ADDED: "Clinical assessment added",
    FILE_ADDED: "File added",
    FILE_REMOVED: "File removed",
    ARCHIVED: "Archived",
    RESTORED: "Restored",
    SESSION_CREATED: "Session booked",
    SESSION_UPDATED: "Session edited",
    SESSION_STATUS_CHANGED: "Session status changed",
    SESSION_DUPLICATED: "Session duplicated",
    SESSION_DELETED: "Session deleted",
    SOAP_NOTE_UPDATED: "SOAP note updated",
};

const SOAP_FIELDS = [
    { key: "subjective", label: "Subjective" },
    { key: "objective", label: "Objective" },
    { key: "assessment", label: "Assessment" },
    { key: "plan", label: "Plan" },
] as const;

type SoapForm = Record<(typeof SOAP_FIELDS)[number]["key"], string>;

const soapFormFrom = (n: SoapNote | null): SoapForm => ({
    subjective: n?.subjective ?? "",
    objective: n?.objective ?? "",
    assessment: n?.assessment ?? "",
    plan: n?.plan ?? "",
});

const hasSoap = (n: SoapNote | null) => !!n && SOAP_FIELDS.some((f) => !!n[f.key]?.trim());

export default function PatientProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const confirm = useConfirm();
    const { id } = use(params);
    const router = useRouter();
    const [patient, setPatient] = useState<PatientData | null>(null);
    const [loading, setLoading] = useState(true);
    const [editingInfo, setEditingInfo] = useState(false);
    const [infoForm, setInfoForm] = useState({ name: "", phone1: "", phone2: "" });
    const [savingInfo, setSavingInfo] = useState(false);
    const [activeTab, setActiveTab] = useState<"intake" | "sessions" | "files" | "history">("intake");
    const [uploadingName, setUploadingName] = useState("");
    const [removingId, setRemovingId] = useState<number | null>(null);
    const [fileError, setFileError] = useState("");
    const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
    const [auditLoading, setAuditLoading] = useState(false);

    // Whether the Clinical Assessment has unsaved edits. The form lives in
    // <ClinicalAssessment>, which reports here; the guard below acts on it.
    // (TJ-067b)
    const [intakeDirty, setIntakeDirty] = useState(false);
    const { confirmDiscard } = useUnsavedChanges(intakeDirty);

    // One session's SOAP note at a time, in a modal. Opened from the Sessions
    // tab, or from the dashboard's Session Details via ?soap=<reservationId>.
    // The API has always let an admin read and write every session's note
    // (canAccessClinical, canWriteSession); this page never drew it. (TJ-065)
    const soapParam = useSearchParams().get("soap");
    const soapLinkHandled = useRef(false);
    const [soapSession, setSoapSession] = useState<Reservation | null>(null);
    const [soapForm, setSoapForm] = useState<SoapForm>(soapFormFrom(null));
    const [soapBaseline, setSoapBaseline] = useState<string>(JSON.stringify(soapFormFrom(null)));
    const [savingSoap, setSavingSoap] = useState(false);
    const [soapSaved, setSoapSaved] = useState(false);
    const [soapError, setSoapError] = useState("");
    const soapDirty = soapSession !== null && JSON.stringify(soapForm) !== soapBaseline;
    const { confirmDiscard: confirmDiscardSoap } = useUnsavedChanges(soapDirty);

    const fetchPatient = useCallback(async () => {
        const res = await fetch(`/api/patients/${id}`);
        if (!res.ok) { router.push("/admin/patients"); return; }
        const data = await res.json();
        setPatient(data);
        setInfoForm({ name: data.name, phone1: data.phone1, phone2: data.phone2 || "" });

        // Arrived from the dashboard's Session Details: open that session's
        // SOAP note, once. A later refetch (after Edit Info, an upload or a
        // file removal) must not reopen it. (TJ-065)
        if (soapParam && !soapLinkHandled.current) {
            soapLinkHandled.current = true;
            const target = (data.reservations as Reservation[]).find((r) => String(r.id) === soapParam);
            if (target) {
                const form = soapFormFrom(target.soapNote);
                setActiveTab("sessions");
                setSoapSession(target);
                setSoapForm(form);
                setSoapBaseline(JSON.stringify(form));
            }
        }
        setLoading(false);
    }, [id, router, soapParam]);

    useEffect(() => { fetchPatient(); }, [fetchPatient]);

    const fetchAuditLog = useCallback(async () => {
        setAuditLoading(true);
        const res = await fetch(`/api/patients/${id}/audit`);
        const data = await res.json();
        setAuditLog(Array.isArray(data) ? data : []);
        setAuditLoading(false);
    }, [id]);

    useEffect(() => {
        if (activeTab === "history" && auditLog.length === 0) fetchAuditLog();
    }, [activeTab, auditLog.length, fetchAuditLog]);

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

    const openSoap = (r: Reservation) => {
        const form = soapFormFrom(r.soapNote);
        setSoapSession(r);
        setSoapForm(form);
        setSoapBaseline(JSON.stringify(form));
        setSoapError("");
        setSoapSaved(false);
    };

    const closeSoap = async () => {
        if (!(await confirmDiscardSoap({ title: "Close without saving?", message: "Your unsaved SOAP note text will be lost." }))) return;
        setSoapSession(null);
        setSoapError("");
    };

    const saveSoap = async () => {
        if (!soapSession) return;
        const sent = soapForm;
        setSavingSoap(true);
        setSoapError("");
        const res = await fetch(`/api/reservations/${soapSession.id}/soap`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(sent),
        });
        setSavingSoap(false);
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setSoapError(data.error || "Could not save the SOAP note.");
            return;
        }
        const saved: SoapNote = await res.json();
        // Patch the one row rather than refetch the whole patient.
        setPatient((p) => p && {
            ...p,
            reservations: p.reservations.map((r) => (r.id === soapSession.id ? { ...r, soapNote: saved } : r)),
        });
        setSoapBaseline(JSON.stringify(sent));
        // The save wrote an audit entry; drop the cached log so the History
        // tab fetches it again on its next visit.
        setAuditLog([]);
        setSoapSaved(true);
        setTimeout(() => setSoapSaved(false), 2000);
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

        // fileType comes from the response, not the picked file: /api/upload
        // re-encodes images to WebP, so file.type would be a lie. fileSize is
        // the size as picked — the endpoint does not report the stored length,
        // so it is exact for documents and approximate for a re-encoded image.
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
        setFileError("");
        setRemovingId(fileId);
        // res.ok is the only success signal. The response also carries
        // objectRemoved, which is false whenever SUPABASE_SERVICE_ROLE_KEY is
        // unset — the row is still gone, so surfacing it would report a
        // failure that did not happen. Do not read it.
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

    if (loading) {
        return <p className="staff-loading" role="status">Loading…</p>;
    }
    if (!patient) return null;

    return (
        <div>
            {/* Header */}
            <div className="staff-record-head">
                <button
                    className="staff-back"
                    onClick={async () => {
                        if (await confirmDiscard({ title: "Leave without saving?", message: "Your unsaved Clinical Assessment edits will be lost." })) {
                            router.push("/admin/patients");
                        }
                    }}
                >← Back</button>
                <div className="staff-record-top">
                    <div className="staff-record-info">
                        <h1>{patient.name}</h1>
                        <div className="staff-record-meta">
                            <span className="staff-inline-icon"><Phone size={13} aria-hidden="true" />{isMissingPhone(patient.phone1) ? <span className="no-phone">No phone</span> : <a href={`tel:${patient.phone1}`}>{patient.phone1}</a>}</span>
                            {patient.phone2 && <span className="staff-inline-icon"><Phone size={13} aria-hidden="true" /><a href={`tel:${patient.phone2}`}>{patient.phone2}</a></span>}
                            <span>Last visit: {formatDate(patient.lastVisitDate)}</span>
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
            </div>

            {/* Edit Info Modal (design 2B, TJ-069d1) */}
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

            {/* SOAP Note Modal (TJ-065; design 2B, TJ-069d1) */}
            {soapSession && (
                <StaffModal
                    title="SOAP Note"
                    wide
                    onClose={closeSoap}
                    footer={<>
                        <button className="staff-btn staff-btn-secondary" onClick={closeSoap}>Close</button>
                        <button className="staff-btn staff-btn-primary" aria-busy={savingSoap} onClick={saveSoap} disabled={savingSoap}>
                            {savingSoap ? "Saving…" : soapSaved ? "✓ Saved" : "Save SOAP Note"}
                        </button>
                    </>}
                >
                    <p className="staff-modal-text">
                        {formatDate(soapSession.sessionDate)} · {soapSession.doctor?.name ?? soapSession.doctorNameSnapshot ?? "—"}
                    </p>
                    {soapError && <div className="staff-form-error" role="alert">{soapError}</div>}
                    {SOAP_FIELDS.map((f) => (
                        <div className="staff-field" key={f.key}>
                            <label htmlFor={`soap-${f.key}`}>{f.label}</label>
                            <textarea
                                id={`soap-${f.key}`}
                                rows={3}
                                value={soapForm[f.key]}
                                onChange={(e) => setSoapForm({ ...soapForm, [f.key]: e.target.value })}
                                placeholder={`Enter ${f.key}…`}
                            />
                        </div>
                    ))}
                </StaffModal>
            )}

            {/* Tabs */}
            <div className="staff-tabs">
                <button className={`staff-tab ${activeTab === "intake" ? "active" : ""}`} onClick={() => setActiveTab("intake")}>Clinical Assessment</button>
                <button className={`staff-tab ${activeTab === "sessions" ? "active" : ""}`} onClick={() => setActiveTab("sessions")}>Sessions ({patient.reservations.length})</button>
                <button className={`staff-tab ${activeTab === "files" ? "active" : ""}`} onClick={() => setActiveTab("files")}>Files ({patient.files.length})</button>
                <button className={`staff-tab ${activeTab === "history" ? "active" : ""}`} onClick={() => setActiveTab("history")}>History</button>
            </div>

            {/* Clinical Assessment Tab. Hidden rather than unmounted while another
                tab is open, so switching tabs keeps unsaved edits. (TJ-067b) */}
            <div className="staff-record-panel" hidden={activeTab !== "intake"}>
                <ClinicalAssessment
                    patientId={patient.id}
                    onDirtyChange={setIntakeDirty}
                    onSaved={() => setAuditLog([])}
                />
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
                                    <th>SOAP Note</th>
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
                                        <td>
                                            <button type="button" className="staff-btn staff-btn-secondary staff-btn-sm" onClick={() => openSoap(r)}>
                                                {hasSoap(r.soapNote) ? "View / Edit" : "Add"}
                                            </button>
                                        </td>
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

            {/* History Tab — admin-only */}
            {activeTab === "history" && (
                auditLoading ? (
                    <div className="staff-panel">
                        <p className="staff-loading" role="status">Loading…</p>
                    </div>
                ) : auditLog.length === 0 ? (
                    <div className="staff-panel">
                        <StaffEmpty icon={History} title="No recorded activity yet" hint="Changes to this patient's file are recorded here." />
                    </div>
                ) : (
                    <div className="staff-table-wrap">
                        <table className="staff-table staff-table-compact staff-table-wide">
                            <thead>
                                <tr>
                                    <th>When</th>
                                    <th>By</th>
                                    <th>Action</th>
                                    <th>Detail</th>
                                </tr>
                            </thead>
                            <tbody>
                                {auditLog.map((e) => (
                                    <tr key={e.id}>
                                        <td>{new Date(e.createdAt).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                                        <td>{e.user ? `${e.user.name} (${e.user.role})` : "—"}</td>
                                        <td>{ACTION_LABELS[e.action] || e.action}</td>
                                        <td>{e.summary || "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            )}
        </div>
    );
}
