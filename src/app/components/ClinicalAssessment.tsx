"use client";

import { useState, useEffect, useCallback } from "react";
import type { LucideIcon } from "lucide-react";
import { Check, ClipboardCheck, ClipboardList, Dumbbell, Plus, Stethoscope } from "lucide-react";
import { useConfirm } from "@/app/components/ConfirmDialog";

// A patient's clinical assessments, one page each. A patient who comes back
// with a new injury gets a new page, and the earlier ones stay as written.
// Every screen that shows the Clinical Assessment mounts this one component
// (the admin and doctor patient pages, and the doctor's session page), so a
// change here reaches all of them. (TJ-067b)
//
// The form is in four sections, and its Save bar stays at the bottom of the
// screen while the form is open. The styles are global (.staff-assess-* and
// .staff-save-* in globals.css). (TJ-072b, decisions P4-1 and P4-2)

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
    rows?: number;
    hint?: string;
}

const INTAKE_FIELDS: Field[] = [
    { key: "injuryPlace", label: "Injury Place", type: "text" },
    { key: "patientSince", label: "Patient Since", type: "text", placeholder: "e.g. March 2024" },
    { key: "medicalHistory", label: "Medical History", type: "textarea", rows: 2 },
    { key: "assessment", label: "Assessment", type: "textarea", rows: 3 },
    { key: "aggravators", label: "Pain Aggravators", type: "textarea", rows: 2 },
    { key: "relievers", label: "Pain Relievers", type: "textarea", rows: 2 },
    { key: "diagnosis", label: "Diagnosis", type: "textarea", rows: 2 },
    { key: "treatmentPlan", label: "Treatment Plan", type: "textarea", rows: 3 },
    { key: "recommendedSessions", label: "Recommended Sessions", type: "number", hint: "Counted at the top of the patient file." },
    { key: "clinicExercises", label: "Clinic Exercises", type: "textarea", rows: 3 },
    { key: "homeExercises", label: "Home Exercises", type: "textarea", rows: 3 },
    { key: "nextSessionTreatment", label: "Next Session Treatment", type: "textarea", rows: 2 },
];

const FIELD = Object.fromEntries(INTAKE_FIELDS.map((f) => [f.key, f])) as Record<FieldKey, Field>;

// Each row holds one field, or two side by side on wider screens.
const SECTIONS: { title: string; icon: LucideIcon; rows: FieldKey[][] }[] = [
    { title: "History", icon: ClipboardList, rows: [["injuryPlace", "patientSince"], ["medicalHistory"]] },
    { title: "Examination", icon: Stethoscope, rows: [["assessment"], ["aggravators", "relievers"]] },
    { title: "Diagnosis & plan", icon: ClipboardCheck, rows: [["diagnosis"], ["treatmentPlan", "recommendedSessions"], ["nextSessionTreatment"]] },
    { title: "Exercises", icon: Dumbbell, rows: [["clinicExercises", "homeExercises"]] },
];

const rowClass = (row: FieldKey[]) =>
    row.length < 2 ? "staff-assess-row" : row.some((k) => FIELD[k].type === "number") ? "staff-assess-row with-number" : "staff-assess-row two";

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

    const update = (key: FieldKey, value: string) => {
        setForm((f) => ({ ...f, [key]: value }));
        setError("");
    };

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
        onSaved?.();
    };

    const saveLabel =
        selected !== "new" ? "Update Assessment" : intakes.length > 0 ? "Save New Assessment" : "Save Assessment";
    const pageNumber = selected === "new" ? intakes.length + 1 : intakes.findIndex((i) => i.id === selected) + 1;
    const pageInjury = form.injuryPlace.trim();

    const renderField = (f: Field) => (
        <div key={f.key} className="staff-field">
            <label htmlFor={`intake-${f.key}`}>{f.label}</label>
            {f.type === "textarea" ? (
                <textarea
                    id={`intake-${f.key}`}
                    rows={f.rows ?? 3}
                    value={form[f.key]}
                    onChange={(e) => update(f.key, e.target.value)}
                />
            ) : (
                <input
                    id={`intake-${f.key}`}
                    type={f.type}
                    placeholder={f.placeholder}
                    value={form[f.key]}
                    onChange={(e) => update(f.key, e.target.value)}
                />
            )}
            {f.hint && <span className="staff-field-hint">{f.hint}</span>}
        </div>
    );

    if (loading) return <p className="staff-loading" role="status">Loading…</p>;
    if (loadError) return <div className="staff-form-error" role="alert">{loadError}</div>;

    return (
        <div>
            {intakes.length > 0 && (
                <div className="staff-assess-pages" role="group" aria-label="Assessments">
                    {intakes.map((it, i) => (
                        <button
                            key={it.id}
                            type="button"
                            className={`staff-assess-pill${selected === it.id ? " active" : ""}`}
                            aria-pressed={selected === it.id}
                            onClick={() => openPage(it)}
                        >
                            <span className="staff-assess-pill-title">Assessment {i + 1}</span>
                            <span className="staff-assess-pill-meta" dir="auto">{it.injuryPlace?.trim() || "No injury place"}</span>
                            <span className="staff-assess-pill-meta">{formatDate(it.createdAt)}</span>
                        </button>
                    ))}
                    {selected === "new" ? (
                        <span className="staff-assess-pill active draft" aria-current="true">
                            <span className="staff-assess-pill-title">Assessment {intakes.length + 1}</span>
                            <span className="staff-assess-pill-meta">New, not saved yet</span>
                        </span>
                    ) : (
                        <button type="button" className="staff-assess-new" onClick={startNew}>
                            <Plus size={14} aria-hidden="true" />New Assessment
                        </button>
                    )}
                </div>
            )}

            {SECTIONS.map(({ title, icon: Icon, rows }) => (
                <section key={title} className="staff-assess-section">
                    <h2 className="staff-assess-title">
                        <span className="staff-assess-icon"><Icon size={16} aria-hidden="true" /></span>
                        {title}
                    </h2>
                    {rows.map((row) => (
                        <div key={row.join("-")} className={rowClass(row)}>
                            {row.map((key) => renderField(FIELD[key]))}
                        </div>
                    ))}
                </section>
            ))}

            <div className="staff-save-bar">
                <div className="staff-save-state" role="status">
                    {saving ? (
                        <span className="staff-save-muted">Saving…</span>
                    ) : error ? (
                        <span className="staff-save-error">{error}</span>
                    ) : dirty ? (
                        <span className="staff-save-dirty"><span className="staff-save-dot" aria-hidden="true" />Unsaved changes</span>
                    ) : selected === "new" ? (
                        <span className="staff-save-muted">New assessment, not saved yet</span>
                    ) : (
                        <span className="staff-save-ok"><Check size={15} aria-hidden="true" />All changes saved</span>
                    )}
                </div>
                <div className="staff-save-end">
                    <span className="staff-save-page" dir="auto">
                        Assessment {pageNumber}{pageInjury ? ` · ${pageInjury}` : ""}
                    </span>
                    <button
                        type="button"
                        className="staff-btn staff-btn-primary"
                        aria-busy={saving}
                        onClick={save}
                        disabled={saving || !dirty}
                    >
                        {saving ? "Saving…" : saveLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
