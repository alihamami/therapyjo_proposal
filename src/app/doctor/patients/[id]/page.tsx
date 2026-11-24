"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { clinicalFileUrl } from "@/lib/storageUrl";
import { useUnsavedChanges } from "@/lib/useUnsavedChanges";
import { CalendarDays, FileText, ImageIcon, Phone } from "lucide-react";
import StaffEmpty from "@/app/components/StaffEmpty";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/reservationStatus";
import PatientSummary, { type LatestAssessment } from "@/app/components/PatientSummary";
import ClinicalAssessment from "@/app/components/ClinicalAssessment";
import { isMissingPhone } from "@/lib/phone";

interface PatientData {
    id: number;
    name: string;
    // Sent to an admin viewing this page, never to a doctor. (TJ-054)
    phone1?: string;
    phone2?: string | null;
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

export default function DoctorPatientProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [patient, setPatient] = useState<PatientData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"intake" | "sessions" | "files">("intake");
    const [uploadingName, setUploadingName] = useState("");
    const [fileError, setFileError] = useState("");

    // Whether the Clinical Assessment has unsaved edits. The form lives in
    // <ClinicalAssessment>, which reports here; the guard below acts on it.
    // (TJ-067b)
    const [intakeDirty, setIntakeDirty] = useState(false);
    const { confirmDiscard } = useUnsavedChanges(intakeDirty);

    // The latest assessment, for the summary line. ClinicalAssessment reports
    // it after each load; undefined until then. (TJ-072c)
    const [latest, setLatest] = useState<LatestAssessment | null | undefined>(undefined);

    const fetchPatient = useCallback(async () => {
        const res = await fetch(`/api/patients/${id}`);
        if (!res.ok) { router.push("/doctor/patients"); return; }
        const data = await res.json();
        setPatient(data);
        setLoading(false);
    }, [id, router]);

    useEffect(() => { fetchPatient(); }, [fetchPatient]);

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
                            router.push("/doctor/patients");
                        }
                    }}
                >← Back</button>
                <div className="staff-record-top">
                    <div className="staff-record-info">
                        <h1>{patient.name}</h1>
                        <div className="staff-record-meta">
                            {typeof patient.phone1 === "string" && <span className="staff-inline-icon"><Phone size={13} aria-hidden="true" />{isMissingPhone(patient.phone1) ? <span className="no-phone">No phone</span> : <a href={`tel:${patient.phone1}`}>{patient.phone1}</a>}</span>}
                            {patient.phone2 && <span className="staff-inline-icon"><Phone size={13} aria-hidden="true" /><a href={`tel:${patient.phone2}`}>{patient.phone2}</a></span>}
                            <span>Patient #{patient.id}</span>
                        </div>
                        {patient.updatedBy && (
                            <p className="staff-record-updated">
                                Last updated by {patient.updatedBy.name} ({patient.updatedBy.role}) on {formatDate(patient.updatedAt)}
                            </p>
                        )}
                    </div>
                    {/* No controls to change or archive the patient: a doctor's writes
                        to a patient are the Clinical Assessment and attaching files,
                        and the server refuses anything else from them. (TJ-054) */}
                    <div className="staff-record-actions">
                        {patient.archived && <span className="staff-badge-archived">ARCHIVED</span>}
                    </div>
                </div>
                <PatientSummary reservations={patient.reservations} lastVisitDate={patient.lastVisitDate} clinical latest={latest} seesFuture={false} />
            </div>

            {/* Tabs */}
            <div className="staff-tabs">
                <button className={`staff-tab ${activeTab === "intake" ? "active" : ""}`} onClick={() => setActiveTab("intake")}>Clinical Assessment</button>
                <button className={`staff-tab ${activeTab === "sessions" ? "active" : ""}`} onClick={() => setActiveTab("sessions")}>Sessions ({patient.reservations.length})</button>
                <button className={`staff-tab ${activeTab === "files" ? "active" : ""}`} onClick={() => setActiveTab("files")}>Files ({patient.files.length})</button>
            </div>

            {/* Clinical Assessment Tab. Hidden rather than unmounted while another
                tab is open, so switching tabs keeps unsaved edits. (TJ-067b) */}
            <div className="staff-record-panel" hidden={activeTab !== "intake"}>
                <ClinicalAssessment patientId={patient.id} onDirtyChange={setIntakeDirty} onLatestChange={setLatest} />
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
                                    {/* Attach only: removing a file is an admin or
                                        secretary action. (TJ-054) */}
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
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
