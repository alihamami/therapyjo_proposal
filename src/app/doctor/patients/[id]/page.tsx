"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { clinicalFileUrl } from "@/lib/storageUrl";
import { useUnsavedChanges } from "@/lib/useUnsavedChanges";

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
    intake: Intake | null;
    files: PatientFile[];
    reservations: Reservation[];
}

interface Intake {
    id: number;
    injuryPlace: string | null;
    patientSince: string | null;
    medicalHistory: string | null;
    assessment: string | null;
    aggravators: string | null;
    relievers: string | null;
    diagnosis: string | null;
    treatmentPlan: string | null;
    recommendedSessions: number | null;
    clinicExercises: string | null;
    homeExercises: string | null;
    nextSessionTreatment: string | null;
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

const INTAKE_FIELDS = [
    { key: "injuryPlace", label: "Injury Place", type: "text" },
    { key: "patientSince", label: "Patient Since", type: "text" },
    { key: "medicalHistory", label: "Medical History", type: "textarea" },
    { key: "assessment", label: "Assessment", type: "textarea" },
    { key: "aggravators", label: "Pain Aggravators", type: "textarea" },
    { key: "relievers", label: "Pain Relievers", type: "textarea" },
    { key: "diagnosis", label: "Diagnosis", type: "textarea" },
    { key: "treatmentPlan", label: "Treatment Plan", type: "textarea" },
    { key: "recommendedSessions", label: "Recommended Sessions", type: "number" },
    { key: "clinicExercises", label: "Clinic Exercises", type: "textarea" },
    { key: "homeExercises", label: "Home Exercises", type: "textarea" },
    { key: "nextSessionTreatment", label: "Next Session Treatment", type: "textarea" },
];

export default function DoctorPatientProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [patient, setPatient] = useState<PatientData | null>(null);
    const [loading, setLoading] = useState(true);
    const [intakeForm, setIntakeForm] = useState<Record<string, string>>({});
    const [savingIntake, setSavingIntake] = useState(false);
    const [intakeMsg, setIntakeMsg] = useState("");
    const [activeTab, setActiveTab] = useState<"intake" | "sessions" | "files">("intake");
    const [uploadingName, setUploadingName] = useState("");
    const [fileError, setFileError] = useState("");

    // The intake form as the server last gave it to us. Anything typed since
    // makes the form dirty, and dirty is what the guard below acts on.
    const [intakeBaseline, setIntakeBaseline] = useState<string>("");
    const intakeDirty = JSON.stringify(intakeForm) !== intakeBaseline;
    const { confirmDiscard } = useUnsavedChanges(intakeDirty);

    const fetchPatient = useCallback(async () => {
        const res = await fetch(`/api/patients/${id}`);
        if (!res.ok) { router.push("/doctor/patients"); return; }
        const data = await res.json();
        setPatient(data);

        // Populate intake form
        const intake: Record<string, string> = {};
        for (const f of INTAKE_FIELDS) {
            const val = data.intake?.[f.key];
            if (f.type === "date" && val) {
                intake[f.key] = new Date(val).toISOString().split("T")[0];
            } else {
                intake[f.key] = val != null ? String(val) : "";
            }
        }
        setIntakeForm(intake);
        setIntakeBaseline(JSON.stringify(intake));
        setLoading(false);
    }, [id, router]);

    useEffect(() => { fetchPatient(); }, [fetchPatient]);

    const saveIntake = async () => {
        setSavingIntake(true);
        setIntakeMsg("");
        await fetch(`/api/patients/${id}/intake`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(intakeForm),
        });
        setSavingIntake(false);
        setIntakeMsg("Assessment saved!");
        setTimeout(() => setIntakeMsg(""), 2500);
        fetchPatient();
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!confirmDiscard("Uploading will reload this patient and discard your unsaved Clinical Assessment edits. Continue?")) {
            e.target.value = "";
            return;
        }
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

    const statusColors: Record<string, string> = {
        SCHEDULED: "#60a5fa",
        WAITING: "#fbbf24",
        CHECKED_IN: "#34d399",
        WITH_DOCTOR: "#a78bfa",
        CHECKED_OUT: "rgba(255,255,255,0.35)",
    };

    if (loading) {
        return <div style={{ color: "rgba(255,255,255,0.5)", padding: "2rem" }}>Loading…</div>;
    }
    if (!patient) return null;

    return (
        <div>
            {/* Header */}
            <div className="profile-header">
                <button
                    className="btn-back"
                    onClick={() => {
                        if (confirmDiscard("You have unsaved Clinical Assessment edits. Leave without saving?")) {
                            router.push("/doctor/patients");
                        }
                    }}
                >← Back</button>
                <div className="header-main">
                    <div className="header-info">
                        <h1>{patient.name}</h1>
                        <div className="header-meta">
                            {patient.phone1 && <span>📞 <a href={`tel:${patient.phone1}`}>{patient.phone1}</a></span>}
                            {patient.phone2 && <span>📞 <a href={`tel:${patient.phone2}`}>{patient.phone2}</a></span>}
                            <span>Last visit: {formatDate(patient.lastVisitDate)}</span>
                            <span>Patient #{patient.id}</span>
                        </div>
                        {patient.updatedBy && (
                            <p className="updated-by">
                                Last updated by {patient.updatedBy.name} ({patient.updatedBy.role}) on {formatDate(patient.updatedAt)}
                            </p>
                        )}
                    </div>
                    {/* No controls to change or archive the patient: a doctor's writes
                        to a patient are the Clinical Assessment and attaching files,
                        and the server refuses anything else from them. (TJ-054) */}
                    <div className="header-actions">
                        {patient.archived && <span className="badge-archived">ARCHIVED</span>}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="tabs">
                <button className={`tab ${activeTab === "intake" ? "active" : ""}`} onClick={() => setActiveTab("intake")}>Clinical Assessment</button>
                <button className={`tab ${activeTab === "sessions" ? "active" : ""}`} onClick={() => setActiveTab("sessions")}>Sessions ({patient.reservations.length})</button>
                <button className={`tab ${activeTab === "files" ? "active" : ""}`} onClick={() => setActiveTab("files")}>Files ({patient.files.length})</button>
            </div>

            {/* Clinical Intake Tab */}
            {activeTab === "intake" && (
                <div className="section-card">
                    {intakeMsg && <div className="success-msg">{intakeMsg}</div>}
                    <div className="intake-grid">
                        {INTAKE_FIELDS.map((f) => (
                            <div key={f.key} className={`form-group ${f.type === "textarea" ? "full-width" : ""}`}>
                                <label>{f.label}</label>
                                {f.type === "textarea" ? (
                                    <textarea
                                        rows={3}
                                        value={intakeForm[f.key] || ""}
                                        onChange={(e) => setIntakeForm({ ...intakeForm, [f.key]: e.target.value })}
                                    />
                                ) : (
                                    <input
                                        type={f.type}
                                        value={intakeForm[f.key] || ""}
                                        onChange={(e) => setIntakeForm({ ...intakeForm, [f.key]: e.target.value })}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="section-actions">
                        <button className="btn-save" onClick={saveIntake} disabled={savingIntake}>
                            {savingIntake ? "Saving…" : "Update Assessment"}
                        </button>
                    </div>
                </div>
            )}

            {/* Sessions Tab */}
            {activeTab === "sessions" && (
                <div className="section-card">
                    {patient.reservations.length === 0 ? (
                        <p className="empty-text">No sessions yet</p>
                    ) : (
                        <table className="data-table">
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
                                            <span className="doctor-tag" style={{ borderColor: r.doctor?.color || "#666" }}>
                                                {r.doctor?.name ?? r.doctorNameSnapshot ?? "—"}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="status-dot" style={{ background: statusColors[r.status] || "#666" }} />
                                            {r.status.replace("_", " ")}
                                        </td>
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
                        <p className="empty-text">No files uploaded yet</p>
                    ) : (
                        <div className="files-grid">
                            {patient.files.map((f) => (
                                <div key={f.id} className="file-card">
                                    {/* Attach only: removing a file is an admin or
                                        secretary action. (TJ-054) */}
                                    <a
                                        href={clinicalFileUrl(f.filePath)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="file-open"
                                    >
                                        <span className="file-icon">{f.fileType.includes("image") ? "🖼" : "📄"}</span>
                                        <span className="file-name">{f.fileName}</span>
                                        <span className="file-date">{formatDate(f.uploadedAt)}</span>
                                    </a>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <style jsx>{`
                .profile-header { margin-bottom: 1.5rem; }
                .btn-back {
                    background: none; border: none; color: rgba(255,255,255,0.45);
                    font-size: 0.85rem; cursor: pointer; margin-bottom: 0.75rem;
                    display: inline-block; font-family: inherit;
                }
                .btn-back:hover { color: #fff; }
                .header-main { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
                .header-info h1 { font-size: 1.5rem; font-weight: 600; margin-bottom: 0.35rem; }
                .header-meta { display: flex; gap: 1.25rem; flex-wrap: wrap; color: rgba(255,255,255,0.45); font-size: 0.85rem; }
                .header-meta a { color: var(--primary, #4CAF93); text-decoration: none; }
                .header-meta a:hover { text-decoration: underline; }
                .updated-by { margin-top: 0.4rem; color: rgba(255,255,255,0.3); font-size: 0.76rem; }
                .header-actions { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
                .badge-archived {
                    background: rgba(239,68,68,0.12); color: #fca5a5;
                    padding: 0.2rem 0.6rem; border-radius: var(--radius-sm, 2px);
                    font-size: 0.72rem; font-weight: 700; letter-spacing: 0.04em;
                }
                .tabs {
                    display: flex; gap: 0; margin-bottom: 1rem;
                    border-bottom: 1px solid rgba(255,255,255,0.06);
                }
                .tab {
                    background: none; border: none; color: rgba(255,255,255,0.4);
                    padding: 0.7rem 1.2rem; font-size: 0.85rem; font-weight: 500;
                    cursor: pointer; border-bottom: 2px solid transparent;
                    transition: all 0.15s; font-family: inherit;
                }
                .tab:hover { color: rgba(255,255,255,0.7); }
                .tab.active { color: var(--primary, #4CAF93); border-bottom-color: var(--primary, #4CAF93); }
                .section-card {
                    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
                    border-radius: var(--radius-md, 4px); padding: 1.5rem;
                }
                .success-msg {
                    background: rgba(76,175,147,0.1); border: 1px solid rgba(76,175,147,0.2);
                    color: #6ee7b7; padding: 0.5rem 0.85rem; border-radius: var(--radius-sm, 2px);
                    font-size: 0.82rem; margin-bottom: 1rem;
                }
                .intake-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.9rem; }
                .full-width { grid-column: 1 / -1; }
                .form-group { display: flex; flex-direction: column; gap: 0.3rem; }
                .form-group label { font-size: 0.76rem; color: rgba(255,255,255,0.5); font-weight: 500; }
                .form-group input, .form-group textarea {
                    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
                    border-radius: var(--radius-sm, 2px); padding: 0.55rem 0.75rem; color: #fff;
                    font-size: 0.85rem; outline: none; font-family: inherit; resize: vertical;
                }
                .form-group input:focus, .form-group textarea:focus { border-color: var(--primary, #4CAF93); }
                .section-actions { margin-top: 1.25rem; display: flex; justify-content: flex-end; }
                .btn-save {
                    background: var(--primary, #4CAF93); color: #fff;
                    border: none; border-radius: var(--radius-sm, 2px);
                    padding: 0.5rem 1.25rem; font-size: 0.85rem; font-weight: 600;
                    cursor: pointer; font-family: inherit;
                }
                .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
                .data-table { width: 100%; border-collapse: collapse; }
                .data-table th {
                    text-align: left; padding: 0.7rem 0.85rem; font-size: 0.74rem;
                    text-transform: uppercase; letter-spacing: 0.05em;
                    color: rgba(255,255,255,0.4); border-bottom: 1px solid rgba(255,255,255,0.06);
                    font-weight: 600;
                }
                .data-table td {
                    padding: 0.65rem 0.85rem; font-size: 0.85rem;
                    border-bottom: 1px solid rgba(255,255,255,0.04);
                    color: rgba(255,255,255,0.8);
                }
                .data-table tr:hover { background: rgba(255,255,255,0.02); }
                .doctor-tag {
                    border-left: 3px solid; padding-left: 0.5rem;
                }
                .status-dot {
                    display: inline-block; width: 7px; height: 7px; border-radius: 50%;
                    margin-right: 0.4rem; vertical-align: middle;
                }
                .empty-text { color: rgba(255,255,255,0.35); text-align: center; padding: 2rem 0; }
                .files-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.75rem; }
                .file-card {
                    display: flex; flex-direction: column; align-items: center; gap: 0.35rem;
                    padding: 1rem; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06);
                    border-radius: var(--radius-sm, 2px); color: #fff;
                    transition: background 0.15s;
                }
                .file-card:hover { background: rgba(255,255,255,0.08); }
                .file-open {
                    display: flex; flex-direction: column; align-items: center; gap: 0.35rem;
                    text-decoration: none; color: #fff; width: 100%; min-width: 0;
                }
                .file-upload-row {
                    display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;
                    margin-bottom: 1rem; padding-bottom: 1rem;
                    border-bottom: 1px solid rgba(255,255,255,0.06);
                }
                .file-input { font-size: 0.82rem; color: rgba(255,255,255,0.6); max-width: 100%; }
                .field-hint { font-size: 0.72rem; color: rgba(255,255,255,0.35); }
                .error-msg {
                    background: rgba(220,38,38,0.1); border: 1px solid rgba(220,38,38,0.2);
                    color: #fca5a5; padding: 0.5rem 0.75rem; border-radius: var(--radius-sm, 2px);
                    font-size: 0.82rem; margin-bottom: 1rem;
                }
                .file-icon { font-size: 1.5rem; }
                .file-name { font-size: 0.78rem; text-align: center; word-break: break-all; }
                .file-date { font-size: 0.7rem; color: rgba(255,255,255,0.3); }
            `}</style>
        </div>
    );
}
