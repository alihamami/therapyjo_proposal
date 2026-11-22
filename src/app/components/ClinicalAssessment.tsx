"use client";

import { useState, useEffect, useCallback } from "react";
import { useConfirm } from "@/app/components/ConfirmDialog";

// A patient's clinical assessments, one page each. A patient who comes back
// with a new injury gets a new page, and the earlier ones stay as written.
// Every screen that shows the Clinical Assessment mounts this one component
// (the admin and doctor patient pages, and the doctor's session page), so a
// change here reaches all of them. (TJ-067b)

interface Intake {
    id: number;
    createdAt: string;
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

type FieldKey = Exclude<keyof Intake, "id" | "createdAt">;

interface Field {
    key: FieldKey;
    label: string;
    type: "text" | "number" | "textarea";
    placeholder?: string;
}

const INTAKE_FIELDS: Field[] = [
    { key: "injuryPlace", label: "Injury Place", type: "text" },
    { key: "patientSince", label: "Patient Since", type: "text", placeholder: "e.g. March 2024" },
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

// Copied from the latest page into a new one: they describe the patient,
// not the injury. Every other field starts blank.
const CARRIED_OVER: FieldKey[] = ["patientSince", "medicalHistory"];

type Form = Record<FieldKey, string>;

function formFrom(intake: Intake | null): Form {
    const form = {} as Form;
    for (const f of INTAKE_FIELDS) {
        const val = intake?.[f.key];
        form[f.key] = val != null ? String(val) : "";
    }
    return form;
}

const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

interface ClinicalAssessmentProps {
    patientId: number;
    // Told whenever the form gains or loses unsaved edits, so the page can
    // guard its Back button and the browser's close (TJ-022). Pass a state
    // setter, which is stable, not a new arrow function on every render.
    onDirtyChange?: (dirty: boolean) => void;
    // Called after a save lands.
    onSaved?: () => void;
}

export default function ClinicalAssessment({ patientId, onDirtyChange, onSaved }: ClinicalAssessmentProps) {
    const confirm = useConfirm();
    const [intakes, setIntakes] = useState<Intake[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    // The page on screen: a saved assessment's id, or "new" for one not saved yet.
    const [selected, setSelected] = useState<number | "new">("new");
    const [form, setForm] = useState<Form>(() => formFrom(null));
    // The form as last loaded or saved. Anything typed since makes it dirty.
    const [baseline, setBaseline] = useState(() => JSON.stringify(formFrom(null)));
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState("");
    const [error, setError] = useState("");

    const dirty = JSON.stringify(form) !== baseline;

    // The cleanup reports clean when this unmounts. The session page drops it
    // while it reloads, and must not go on guarding edits that are gone.
    useEffect(() => {
        onDirtyChange?.(dirty);
        return () => onDirtyChange?.(false);
    }, [dirty, onDirtyChange]);

    const show = useCallback((page: number | "new", f: Form) => {
        setSelected(page);
        setForm(f);
        setBaseline(JSON.stringify(f));
        setMsg("");
        setError("");
    }, []);

    // Loads every page, then shows `focus`, or the latest when focus is not
    // given or not found.
    const load = useCallback(async (focus?: number) => {
        const res = await fetch(`/api/patients/${patientId}/intake`);
        if (!res.ok) {
            setLoadError("Could not load the clinical assessment. Reload the page to try again.");
            setLoading(false);
            return;
        }
        const data = await res.json();
        const list: Intake[] = Array.isArray(data) ? data : [];
        const shown = list.find((i) => i.id === focus) ?? list[list.length - 1] ?? null;
        setIntakes(list);
        show(shown ? shown.id : "new", formFrom(shown));
        setLoadError("");
        setLoading(false);
    }, [patientId, show]);

    useEffect(() => { load(); }, [load]);

    const openPage = async (intake: Intake) => {
        if (intake.id === selected) return;
        if (dirty && !(await confirm({ title: "Switch pages without saving?", message: "Your unsaved Clinical Assessment edits will be lost.", confirmLabel: "Discard changes", tone: "danger" }))) return;
        show(intake.id, formFrom(intake));
    };

    const startNew = async () => {
        if (dirty && !(await confirm({ title: "Start a new assessment without saving?", message: "Your unsaved Clinical Assessment edits will be lost.", confirmLabel: "Discard changes", tone: "danger" }))) return;
        const latest = intakes[intakes.length - 1] ?? null;
        const f = formFrom(null);
        for (const key of CARRIED_OVER) {
            const val = latest?.[key];
            f[key] = val != null ? String(val) : "";
        }
        // Clean until something is typed: the carried-over fields alone are
        // not work to lose.
        show("new", f);
    };

    const save = async () => {
        const isNew = selected === "new";
        setSaving(true);
        setMsg("");
        setError("");
        const res = await fetch(`/api/patients/${patientId}/intake`, {
            method: isNew ? "POST" : "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(isNew ? form : { ...form, intakeId: selected }),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setSaving(false);
            setError(data.error || "Could not save the assessment. Your text is still here; try again.");
            return;
        }
        const saved: Intake = await res.json();
        await load(saved.id);
        setSaving(false);
        setMsg(isNew ? "New assessment saved!" : "Assessment saved!");
        setTimeout(() => setMsg(""), 2500);
        onSaved?.();
    };

    const saveLabel =
        selected !== "new" ? "Update Assessment" : intakes.length > 0 ? "Save New Assessment" : "Save Assessment";

    return (
        <div>
            {loading ? (
                <p className="empty-text">Loading…</p>
            ) : loadError ? (
                <div className="error-msg" role="alert">{loadError}</div>
            ) : (
                <>
                    {intakes.length > 0 && (
                        <div className="assessment-pages" role="group" aria-label="Assessments">
                            {intakes.map((it, i) => (
                                <button
                                    key={it.id}
                                    type="button"
                                    className={`page-pill ${selected === it.id ? "active" : ""}`}
                                    aria-pressed={selected === it.id}
                                    onClick={() => openPage(it)}
                                >
                                    <span className="pill-title">Assessment {i + 1}</span>
                                    <span className="pill-meta" dir="auto">{it.injuryPlace?.trim() || "No injury place"}</span>
                                    <span className="pill-meta">{formatDate(it.createdAt)}</span>
                                </button>
                            ))}
                            {selected === "new" ? (
                                <span className="page-pill active draft" aria-current="true">
                                    <span className="pill-title">Assessment {intakes.length + 1}</span>
                                    <span className="pill-meta">New, not saved yet</span>
                                </span>
                            ) : (
                                <button type="button" className="btn-new" onClick={startNew}>+ New Assessment</button>
                            )}
                        </div>
                    )}

                    {msg && <div className="success-msg">{msg}</div>}
                    {error && <div className="error-msg" role="alert">{error}</div>}

                    <div className="intake-grid">
                        {INTAKE_FIELDS.map((f) => (
                            <div key={f.key} className={`form-group ${f.type === "textarea" ? "full-width" : ""}`}>
                                <label htmlFor={`intake-${f.key}`}>{f.label}</label>
                                {f.type === "textarea" ? (
                                    <textarea
                                        id={`intake-${f.key}`}
                                        rows={3}
                                        value={form[f.key]}
                                        onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                                    />
                                ) : (
                                    <input
                                        id={`intake-${f.key}`}
                                        type={f.type}
                                        placeholder={f.placeholder}
                                        value={form[f.key]}
                                        onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                                    />
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="section-actions">
                        <button type="button" className="staff-btn staff-btn-primary" aria-busy={saving} onClick={save} disabled={saving}>
                            {saving ? "Saving…" : saveLabel}
                        </button>
                    </div>
                </>
            )}

            <style jsx>{`
                .assessment-pages {
                    display: flex; flex-wrap: wrap; gap: 0.5rem;
                    margin-bottom: 1.25rem; padding-bottom: 1rem;
                    border-bottom: 1px solid rgba(255,255,255,0.06);
                }
                .page-pill {
                    display: flex; flex-direction: column; align-items: flex-start; gap: 0.1rem;
                    min-width: 0; max-width: 220px; padding: 0.45rem 0.8rem;
                    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
                    border-radius: var(--radius-sm, 2px); color: rgba(255,255,255,0.6);
                    font-family: inherit; text-align: start; cursor: pointer;
                    transition: background 0.15s, border-color 0.15s;
                }
                .page-pill:hover { background: rgba(255,255,255,0.07); }
                .page-pill.active {
                    background: rgba(76,175,147,0.1); border-color: var(--primary, #4CAF93);
                    color: var(--primary, #4CAF93);
                }
                .page-pill.draft { cursor: default; }
                .pill-title { font-size: 0.82rem; font-weight: 600; }
                .pill-meta {
                    max-width: 100%; font-size: 0.72rem; color: rgba(255,255,255,0.4);
                    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
                }
                .btn-new {
                    padding: 0.45rem 0.9rem;
                    background: none; border: 1px dashed rgba(255,255,255,0.18);
                    border-radius: var(--radius-sm, 2px); color: rgba(255,255,255,0.6);
                    font-size: 0.82rem; font-weight: 500; font-family: inherit; cursor: pointer;
                }
                .btn-new:hover { color: #fff; border-color: var(--primary, #4CAF93); }
                .success-msg {
                    background: rgba(76,175,147,0.1); border: 1px solid rgba(76,175,147,0.2);
                    color: #6ee7b7; padding: 0.5rem 0.85rem; border-radius: var(--radius-sm, 2px);
                    font-size: 0.82rem; margin-bottom: 1rem;
                }
                .error-msg {
                    background: rgba(220,38,38,0.1); border: 1px solid rgba(220,38,38,0.2);
                    color: #fca5a5; padding: 0.5rem 0.75rem; border-radius: var(--radius-sm, 2px);
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
                .empty-text { color: rgba(255,255,255,0.35); text-align: center; padding: 2rem 0; }

                @media (max-width: 640px) {
                    .intake-grid { grid-template-columns: 1fr; }
                    .page-pill { max-width: 100%; }
                }
            `}</style>
        </div>
    );
}
