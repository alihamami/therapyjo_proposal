// Skeletons, decision P4-4 = 4A (TJ-072d): grey blocks in the shape of what
// is loading, pulsing softly together, and still for anyone who has reduced
// motion turned on. Screen readers hear the label once, from a visually
// hidden role="status"; the blocks are hidden from them. The styles are
// global (.staff-skel-* in globals.css).
//
// StaffSkeletonRows fills a table body while a list loads, under the list's
// real header. StaffSkeleton draws a whole loading area: a record (patient
// file, session), a form, the dashboard calendar, the assessment's fields,
// stacked cards (Approvals) or tiles (Doctor profiles).

import type { ReactNode } from "react";

// Varied so the rows do not read as a grid of identical blocks.
const WIDTHS = ["78%", "56%", "86%", "64%", "72%", "50%", "82%"];

const Bar = ({ w, h }: { w?: string; h?: number }) => (
    <span className="staff-skel" style={{ width: w, height: h }} aria-hidden="true" />
);

const Field = ({ label = "30%", box }: { label?: string; box?: number }) => (
    <div className="staff-skel-field" aria-hidden="true">
        <Bar w={label} h={8} />
        <span className="staff-skel-box" style={{ height: box }} />
    </div>
);

const Label = ({ text }: { text: string }) => (
    <span className="staff-skel-label" role="status">{text}</span>
);

interface RowsProps {
    columns: number;
    rows?: number;
    label?: string;
}

export function StaffSkeletonRows({ columns, rows = 6, label = "Loading…" }: RowsProps) {
    return (
        <>
            {Array.from({ length: rows }, (_, r) => (
                <tr key={r} className="staff-skel-row">
                    {Array.from({ length: columns }, (_, c) => (
                        <td key={c}>
                            {r === 0 && c === 0 && <Label text={label} />}
                            <Bar w={WIDTHS[(r * 3 + c) % WIDTHS.length]} />
                        </td>
                    ))}
                </tr>
            ))}
        </>
    );
}

interface StaffSkeletonProps {
    kind: "record" | "form" | "calendar" | "fields" | "cards" | "tiles";
    label?: string;
    /** A form's real page title, shown in place of a title block. */
    title?: string;
    /** The page's real Back button, usable while the rest loads. */
    back?: ReactNode;
}

export default function StaffSkeleton({ kind, label = "Loading…", title, back }: StaffSkeletonProps) {
    if (kind === "tiles") {
        return (
            <>
                <Label text={label} />
                {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="staff-skel-tile" aria-hidden="true">
                        <span className="staff-skel-photo" />
                        <div className="staff-skel-tile-body">
                            <Bar w="70%" />
                            <Bar w="45%" h={8} />
                        </div>
                    </div>
                ))}
            </>
        );
    }

    if (kind === "cards") {
        return (
            <div className="staff-skel-stack">
                <Label text={label} />
                {[0, 1].map((i) => (
                    <div key={i} className="staff-panel staff-skel-card" aria-hidden="true">
                        <div className="staff-skel-line"><Bar w="140px" /><Bar w="60px" h={8} /></div>
                        <div className="staff-skel-grid">
                            <span className="staff-skel-box" style={{ height: 64 }} />
                            <span className="staff-skel-box" style={{ height: 64 }} />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (kind === "calendar") {
        return (
            <div className="staff-panel staff-skel-calendar">
                <Label text={label} />
                <div className="staff-skel-times" aria-hidden="true">
                    {[0, 1, 2, 3, 4, 5].map((i) => <Bar key={i} w="28px" h={8} />)}
                </div>
                {[[0, 22, 0], [58, 0], [0, 0, 22]].map((gaps, c) => (
                    <div key={c} className="staff-skel-col" aria-hidden="true">
                        <Bar w={WIDTHS[c]} />
                        {gaps.map((g, i) => <span key={i} className="staff-skel-box" style={{ height: 48, marginTop: g }} />)}
                    </div>
                ))}
            </div>
        );
    }

    if (kind === "fields") {
        return (
            <div className="staff-skel-fields">
                <Label text={label} />
                <Bar w="120px" h={14} />
                <div className="staff-skel-grid"><Field /><Field /></div>
                <Field label="20%" box={60} />
                <Bar w="140px" h={14} />
                <Field label="18%" box={78} />
                <div className="staff-skel-grid"><Field /><Field /></div>
            </div>
        );
    }

    if (kind === "form") {
        return (
            <div className="staff-skel-page staff-skel-form">
                <Label text={label} />
                {back}
                {title ? <h1 className="staff-skel-heading">{title}</h1> : <Bar w="200px" h={20} />}
                <div className="staff-record-panel staff-skel-fields" aria-hidden="true">
                    <Field label="15%" />
                    <div className="staff-skel-grid"><Field label="25%" /><Field label="25%" /></div>
                    <Field label="20%" box={72} />
                    <div className="staff-skel-end"><span className="staff-skel-box" style={{ width: 120, height: 34 }} /></div>
                </div>
            </div>
        );
    }

    // A record: the patient file and the doctor's session page.
    return (
        <div className="staff-skel-page">
            <Label text={label} />
            {back}
            <div className="staff-skel-record" aria-hidden="true">
                <Bar w="220px" h={20} />
                <div className="staff-skel-line"><Bar w="110px" /><Bar w="80px" /></div>
                <div className="staff-skel-summary">
                    <div className="staff-skel-field"><Bar w="70px" h={8} /><Bar w="180px" /></div>
                    <div className="staff-skel-field"><Bar w="56px" h={8} /><Bar w="90px" /></div>
                    <div className="staff-skel-field"><Bar w="90px" h={8} /><Bar w="120px" /></div>
                </div>
                <div className="staff-skel-tabs"><Bar w="120px" /><Bar w="80px" /><Bar w="60px" /></div>
                <div className="staff-record-panel staff-skel-grid"><Field /><Field /></div>
            </div>
        </div>
    );
}
