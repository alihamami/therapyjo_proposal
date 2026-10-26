"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { use } from "react";
import { useUnsavedChanges } from "@/lib/useUnsavedChanges";

interface ReservationDetail {
    id: number;
    sessionDate: string;
    sessionTime: string;
    status: string;
    note: string | null;
    nextSessionNote: string | null;
    paymentType: string | null;
    injuryPlace: string | null;
    isTwoHours: boolean;
    previousSessionNote: string | null;
    previousSessionDate: string | null;
    // phone1/phone2 are sent to an admin viewing this page, never to a doctor. (TJ-054)
    patient: { id: number; name: string; phone1?: string; phone2?: string | null; archived: boolean };
    doctor: { id: string; name: string; color: string | null } | null;
    doctorNameSnapshot: string | null;
    soapNote: { subjective: string | null; objective: string | null; assessment: string | null; plan: string | null } | null;
}

interface PastSession {
    id: number;
    sessionDate: string;
    sessionTime: string;
    status: string;
    injuryPlace: string | null;
    paymentType: string | null;
    doctor: { name: string; color: string | null } | null;
    doctorNameSnapshot: string | null;
    doctorColorSnapshot: string | null;
}

const INTAKE_FIELDS = [
    { key: "injuryPlace", label: "Injury Place", type: "text" },
    { key: "enrollDate", label: "Enrollment Date", type: "date" },
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

export default function DoctorSessionPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const { data: authSession } = useSession();
    const [reservation, setReservation] = useState<ReservationDetail | null>(null);
    const [pastSessions, setPastSessions] = useState<PastSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // A doctor may change only a session booked under them; a colleague's
    // opens read-only. An admin may open this page too and keeps every
    // action. Until the signed-in user is known, nothing is offered. (TJ-062)
    const me = authSession?.user;
    const isColleagues = !!me && me.role === "DOCTOR" && reservation?.doctor?.id !== me.id;
    const readOnly = !me || isColleagues;
    const ownerName = reservation?.doctor?.name ?? reservation?.doctorNameSnapshot ?? "another doctor";

    // Editable fields — session date, time, and doctor are not editable by a
    // doctor (only admin/secretary reschedule or reassign); Injury Place is.
    const [editInjury, setEditInjury] = useState("");

    // SOAP form
    const [soapForm, setSoapForm] = useState({ subjective: "", objective: "", assessment: "", plan: "" });
    const [savingSoap, setSavingSoap] = useState(false);
    const [soapSaved, setSoapSaved] = useState(false);

    // Clinical intake form
    const [intakeForm, setIntakeForm] = useState<Record<string, string>>({});
    const [savingIntake, setSavingIntake] = useState(false);
    const [intakeSaved, setIntakeSaved] = useState(false);

    // Tabs
    const [activeTab, setActiveTab] = useState<"details" | "history" | "soap" | "intake">("details");

    // Both clinical forms are guarded together: fetchData() repopulates both,
    // so either being dirty is enough to lose work.
    const [soapBaseline, setSoapBaseline] = useState<string>("");
    const [intakeBaseline, setIntakeBaseline] = useState<string>(JSON.stringify({}));
    const clinicalDirty =
        JSON.stringify(soapForm) !== soapBaseline ||
        JSON.stringify(intakeForm) !== intakeBaseline;
    const { confirmDiscard } = useUnsavedChanges(clinicalDirty);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const [resRes, soapData] = await Promise.all([
            fetch(`/api/reservations/${id}`),
            fetch(`/api/reservations/${id}/soap`).then((r) => r.json()),
        ]);
        // A missing session, or one on a day that has not opened yet, comes
        // back 404. Show "Session not found" rather than drawing the error
        // body as if it were a session. (TJ-064)
        if (!resRes.ok) {
            setReservation(null);
            setLoading(false);
            return;
        }
        const resData = await resRes.json();

        setReservation(resData);
        setEditInjury(resData.injuryPlace || "");
        setSoapForm({
            subjective: soapData?.subjective || "",
            objective: soapData?.objective || "",
            assessment: soapData?.assessment || "",
            plan: soapData?.plan || "",
        });
        setSoapBaseline(JSON.stringify({
            subjective: soapData?.subjective || "",
            objective: soapData?.objective || "",
            assessment: soapData?.assessment || "",
            plan: soapData?.plan || "",
        }));

        // Fetch all past sessions + intake for this patient
        if (resData.patient?.id) {
            const [sessRes, intakeRes] = await Promise.all([
                fetch(`/api/reservations?patientId=${resData.patient.id}`),
                fetch(`/api/patients/${resData.patient.id}`),
            ]);
            const sessData = await sessRes.json();
            setPastSessions(
                (Array.isArray(sessData) ? sessData : [])
                    .filter((s: PastSession) => s.id !== resData.id)
                    .sort((a: PastSession, b: PastSession) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime())
            );

            // Populate intake form
            const patientData = await intakeRes.json();
            const intake: Record<string, string> = {};
            for (const f of INTAKE_FIELDS) {
                const val = patientData.intake?.[f.key];
                if (f.type === "date" && val) {
                    intake[f.key] = new Date(val).toISOString().split("T")[0];
                } else {
                    intake[f.key] = val != null ? String(val) : "";
                }
            }
            setIntakeForm(intake);
            setIntakeBaseline(JSON.stringify(intake));
        }
        setLoading(false);
    }, [id]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSaveDetails = async () => {
        if (!confirmDiscard("Saving the session details will reload this page and discard your unsaved SOAP or Clinical Intake text. Continue?")) return;
        setSaving(true);
        await fetch(`/api/reservations/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ injuryPlace: editInjury }),
        });
        setSaving(false);
        fetchData();
    };

    const handleSaveSoap = async () => {
        setSavingSoap(true);
        const res = await fetch(`/api/reservations/${id}/soap`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(soapForm),
        });
        // Only a save that actually landed may clear the guard. If the request
        // failed, the text really is unsaved and the warning must still fire.
        if (res.ok) setSoapBaseline(JSON.stringify(soapForm));
        setSavingSoap(false);
        setSoapSaved(true);
        setTimeout(() => setSoapSaved(false), 2000);
    };

    const handleSaveIntake = async () => {
        if (!reservation) return;
        setSavingIntake(true);
        const res = await fetch(`/api/patients/${reservation.patient.id}/intake`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(intakeForm),
        });
        if (res.ok) setIntakeBaseline(JSON.stringify(intakeForm));
        setSavingIntake(false);
        setIntakeSaved(true);
        setTimeout(() => setIntakeSaved(false), 2000);
    };

    const handleStatusChange = async (status: string) => {
        if (!confirmDiscard("Changing the session status will reload this page and discard your unsaved SOAP or Clinical Intake text. Continue?")) return;
        await fetch(`/api/reservations/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
        });
        fetchData();
    };

    const formatDate = (d: string) => new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    const formatTime = (t: string) => new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

    const statusColors: Record<string, string> = {
        SCHEDULED: "#64748b", CHECKED_IN: "#3b82f6", WITH_DOCTOR: "#4CAF93", CHECKED_OUT: "#16a34a", WAITING: "#f59e0b",
    };

    if (loading) return <div style={{ color: "rgba(255,255,255,0.4)", padding: "3rem", textAlign: "center" }}>Loading session…</div>;
    if (!reservation) return <div style={{ color: "rgba(255,255,255,0.4)", padding: "3rem", textAlign: "center" }}>Session not found</div>;

    return (
        <div>
            {/* Back + Header */}
            <button
                className="back-btn"
                onClick={() => {
                    if (confirmDiscard("You have unsaved SOAP or Clinical Intake text. Leave without saving?")) {
                        router.push("/doctor");
                    }
                }}
            >← Back to Schedule</button>

            <div className="header">
                <div className="header-left">
                    <h1>
                        {reservation.patient.name}
                        {reservation.patient.archived && <span className="badge-archived">ARCHIVED</span>}
                    </h1>
                    {reservation.patient.phone1 && (
                        <div className="header-meta">
                            <span>📞 {reservation.patient.phone1}</span>
                            {reservation.patient.phone2 && <span>· {reservation.patient.phone2}</span>}
                        </div>
                    )}
                </div>
                <div className="header-right">
                    <span className="status-badge" style={{ background: `${statusColors[reservation.status]}22`, color: statusColors[reservation.status], border: `1px solid ${statusColors[reservation.status]}44` }}>
                        {reservation.status.replace("_", " ")}
                    </span>
                    {!readOnly && reservation.status !== "CHECKED_OUT" && (
                        <div className="status-actions">
                            {reservation.status === "SCHEDULED" && <button className="action-btn" onClick={() => handleStatusChange("CHECKED_IN")}>Check In</button>}
                            {reservation.status === "CHECKED_IN" && <button className="action-btn" onClick={() => handleStatusChange("WITH_DOCTOR")}>Start Session</button>}
                            {reservation.status === "WITH_DOCTOR" && <button className="action-btn checkout" onClick={() => handleStatusChange("CHECKED_OUT")}>Checkout</button>}
                            {["SCHEDULED", "CHECKED_IN"].includes(reservation.status) && <button className="action-btn waiting" onClick={() => handleStatusChange("WAITING")}>Waiting</button>}
                            {reservation.status === "WAITING" && <button className="action-btn" onClick={() => handleStatusChange("CHECKED_IN")}>Check In</button>}
                        </div>
                    )}
                </div>
            </div>

            {/* A colleague's session: readable, not changeable. Reuses the
                previous-note banner's style. (TJ-062) */}
            {isColleagues && (
                <div className="prev-note-banner">
                    <span className="prev-label">Read only</span>
                    <span>This session belongs to {ownerName}. Only they, an admin or the front desk can change it.</span>
                </div>
            )}

            {/* Previous session note */}
            {reservation.previousSessionNote && (
                <div className="prev-note-banner">
                    <span className="prev-label">Previous Session Note</span>
                    <span>{reservation.previousSessionNote}</span>
                </div>
            )}

            {/* Tabs */}
            <div className="tabs">
                {(["details", "soap", "intake", "history"] as const).map((tab) => (
                    <button key={tab} className={`tab ${activeTab === tab ? "active" : ""}`} onClick={() => setActiveTab(tab)}>
                        {tab === "details" ? "Session Details" : tab === "soap" ? "SOAP Note" : tab === "intake" ? "Clinical Assessment" : `History (${pastSessions.length})`}
                    </button>
                ))}
            </div>

            {/* Details Tab */}
            {activeTab === "details" && (
                <div className="card">
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Session Date</label>
                            <p className="readonly-value">{formatDate(reservation.sessionDate)}</p>
                        </div>
                        <div className="form-group">
                            <label>Session Time</label>
                            <p className="readonly-value">{formatTime(reservation.sessionTime)}</p>
                        </div>
                        <div className="form-group">
                            <label>Doctor</label>
                            <p className="readonly-value">{reservation.doctor?.name ?? reservation.doctorNameSnapshot ?? "—"}</p>
                        </div>
                        <div className="form-group">
                            <label>Injury Place</label>
                            <input value={editInjury} onChange={(e) => setEditInjury(e.target.value)} placeholder="e.g. Lower back, Knee…" readOnly={readOnly} />
                        </div>
                    </div>
                    <p className="field-hint">Date, time, and doctor are set by front-desk staff — contact them to reschedule or reassign this session.</p>
                    {!readOnly && (
                        <div className="card-actions">
                            <button className="btn-save" onClick={handleSaveDetails} disabled={saving}>{saving ? "Saving…" : "Update Session"}</button>
                        </div>
                    )}
                </div>
            )}

            {/* SOAP Tab */}
            {activeTab === "soap" && (
                <div className="card">
                    <div className="soap-grid">
                        {(["subjective", "objective", "assessment", "plan"] as const).map((field) => (
                            <div className="form-group" key={field}>
                                <label>
                                    <span className="soap-letter">{field[0].toUpperCase()}</span>
                                    {field.charAt(0).toUpperCase() + field.slice(1)}
                                </label>
                                <textarea
                                    rows={3}
                                    value={soapForm[field]}
                                    readOnly={readOnly}
                                    onChange={(e) => setSoapForm({ ...soapForm, [field]: e.target.value })}
                                    placeholder={`Enter ${field}…`}
                                />
                            </div>
                        ))}
                    </div>
                    {!readOnly && (
                        <div className="card-actions">
                            <button className="btn-save" onClick={handleSaveSoap} disabled={savingSoap}>
                                {savingSoap ? "Saving…" : soapSaved ? "✓ Saved" : "Save SOAP Note"}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Clinical Assessment Tab */}
            {activeTab === "intake" && (
                <div className="card">
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
                    <div className="card-actions">
                        <button className="btn-save" onClick={handleSaveIntake} disabled={savingIntake}>
                            {savingIntake ? "Saving…" : intakeSaved ? "✓ Saved" : "Update Assessment"}
                        </button>
                    </div>
                </div>
            )}

            {/* History Tab */}
            {activeTab === "history" && (
                <div className="card">
                    {pastSessions.length === 0 ? (
                        <p style={{ color: "rgba(255,255,255,0.4)", padding: "1rem", textAlign: "center" }}>No previous sessions</p>
                    ) : (
                        <div className="table-container">
                            <table className="data-table">
                                <thead><tr><th>Date</th><th>Time</th><th>Doctor</th><th>Status</th><th>Injury</th><th>Payment</th><th></th></tr></thead>
                                <tbody>
                                    {pastSessions.map((s) => (
                                        <tr key={s.id}>
                                            <td>{formatDate(s.sessionDate)}</td>
                                            <td>{formatTime(s.sessionTime)}</td>
                                            <td><span style={{ borderLeft: `3px solid ${s.doctor?.color ?? s.doctorColorSnapshot ?? "#666"}`, paddingLeft: "0.5rem" }}>{s.doctor?.name ?? s.doctorNameSnapshot ?? "—"}</span></td>
                                            <td><span className="mini-status" style={{ color: statusColors[s.status] || "#fff" }}>{s.status.replace("_", " ")}</span></td>
                                            <td>{s.injuryPlace || "—"}</td>
                                            <td>{s.paymentType || "—"}</td>
                                            <td><button className="view-btn" onClick={() => router.push(`/doctor/session/${s.id}`)}>View</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            <style jsx>{`
                .back-btn { background: none; border: none; color: rgba(255,255,255,0.5); font-size: 0.85rem; cursor: pointer; padding: 0; margin-bottom: 1rem; font-family: inherit; }
                .back-btn:hover { color: #fff; }
                .header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1rem; flex-wrap: wrap; gap: 1rem; }
                .header h1 { font-size: 1.5rem; font-weight: 600; margin: 0; display: flex; align-items: center; gap: 0.6rem; }
                .badge-archived { background: rgba(239,68,68,0.12); color: #fca5a5; padding: 0.2rem 0.6rem; border-radius: var(--radius-sm, 2px); font-size: 0.65rem; font-weight: 700; letter-spacing: 0.04em; }
                .header-meta { color: rgba(255,255,255,0.5); font-size: 0.85rem; margin-top: 0.2rem; display: flex; gap: 0.5rem; }
                .header-right { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
                .status-badge { padding: 0.3rem 0.8rem; border-radius: var(--radius-sm, 2px); font-size: 0.78rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; }
                .status-actions { display: flex; gap: 0.35rem; }
                .action-btn { background: var(--primary, #4CAF93); color: #fff; border: none; padding: 0.35rem 0.85rem; border-radius: var(--radius-sm, 2px); font-size: 0.78rem; font-weight: 600; cursor: pointer; font-family: inherit; }
                .action-btn.checkout { background: #16a34a; }
                .action-btn.waiting { background: transparent; border: 1px solid #f59e0b; color: #f59e0b; }
                .prev-note-banner { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-left: 3px solid rgba(76,175,147,0.4); border-radius: var(--radius-sm, 2px); padding: 0.65rem 1rem; margin-bottom: 1rem; font-size: 0.85rem; display: flex; flex-direction: column; gap: 0.15rem; }
                .prev-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; color: rgba(255,255,255,0.4); font-weight: 600; }
                .tabs { display: flex; gap: 0; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.06); }
                .tab { background: none; border: none; border-bottom: 2px solid transparent; color: rgba(255,255,255,0.5); padding: 0.65rem 1.1rem; font-size: 0.85rem; cursor: pointer; font-family: inherit; transition: all 0.15s; }
                .tab:hover { color: rgba(255,255,255,0.8); }
                .tab.active { color: var(--primary, #4CAF93); border-bottom-color: var(--primary, #4CAF93); font-weight: 600; }
                .card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: var(--radius-md, 4px); padding: 1.5rem; }
                .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
                .soap-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
                .intake-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.9rem; }
                .full-width { grid-column: 1 / -1; }
                .form-group { display: flex; flex-direction: column; gap: 0.25rem; }
                .form-group label { font-size: 0.76rem; color: rgba(255,255,255,0.5); font-weight: 500; display: flex; align-items: center; gap: 0.35rem; }
                .soap-letter { width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; background: rgba(76,175,147,0.12); color: var(--primary, #4CAF93); border-radius: 2px; font-weight: 700; font-size: 0.7rem; }
                .form-group input, .form-group textarea, .form-group select { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius-sm, 2px); padding: 0.5rem 0.7rem; color: #fff; font-size: 0.85rem; outline: none; font-family: inherit; resize: vertical; }
                .form-group select option { background: #1a2e35; }
                .form-group input:focus, .form-group textarea:focus { border-color: var(--primary, #4CAF93); }
                .readonly-value { margin: 0; padding: 0.5rem 0.7rem; color: rgba(255,255,255,0.7); font-size: 0.85rem; }
                .field-hint { font-size: 0.76rem; color: rgba(255,255,255,0.35); margin: 0.75rem 0 0; }
                .card-actions { display: flex; justify-content: flex-end; margin-top: 1.25rem; }
                .btn-save { background: var(--primary, #4CAF93); color: #fff; border: none; border-radius: var(--radius-sm, 2px); padding: 0.5rem 1.2rem; font-size: 0.85rem; font-weight: 600; cursor: pointer; font-family: inherit; }
                .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
                .table-container { overflow-x: auto; }
                .data-table { width: 100%; border-collapse: collapse; }
                .data-table th { text-align: left; padding: 0.75rem 0.85rem; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(255,255,255,0.35); border-bottom: 1px solid rgba(255,255,255,0.06); font-weight: 600; }
                .data-table td { padding: 0.65rem 0.85rem; font-size: 0.83rem; border-bottom: 1px solid rgba(255,255,255,0.04); color: rgba(255,255,255,0.75); }
                .data-table tr:hover { background: rgba(255,255,255,0.02); }
                .mini-status { font-size: 0.72rem; font-weight: 600; text-transform: uppercase; }
                .view-btn { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.7); padding: 0.25rem 0.6rem; border-radius: var(--radius-sm, 2px); font-size: 0.75rem; cursor: pointer; font-family: inherit; }
                .view-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
                @media (max-width: 640px) { .form-grid, .soap-grid, .intake-grid { grid-template-columns: 1fr; } }
            `}</style>
        </div>
    );
}
