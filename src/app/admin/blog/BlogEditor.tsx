"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LinkIcon } from "lucide-react";

const CATEGORIES = ["Recovery Tips", "Rehabilitation", "Treatments", "Sports", "Women's Health", "Guidance"];

interface LinkedInfo { id: string; lang: "EN" | "AR"; status?: string }

interface PostData {
    id: string;
    title: string;
    lang: "EN" | "AR";
    category: string;
    body: string;
    coverImage: string | null;
    status: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";
    publishAt: string | null;
    updatedAt: string;
    linked: LinkedInfo | null;
}

export default function BlogEditor({ initial }: { initial?: PostData }) {
    const router = useRouter();
    const isEdit = !!initial;
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [title, setTitle] = useState(initial?.title || "");
    const [lang, setLang] = useState<"EN" | "AR">(initial?.lang || "EN");
    const [category, setCategory] = useState(initial?.category || CATEGORIES[0]);
    const [body, setBody] = useState(initial?.body || "");
    const [status, setStatus] = useState<PostData["status"]>(initial?.status || "DRAFT");
    const [publishAt, setPublishAt] = useState(initial?.publishAt ? initial.publishAt.slice(0, 16) : "");
    const [coverImage, setCoverImage] = useState<string | null>(initial?.coverImage || null);
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [linked, setLinked] = useState<LinkedInfo | null>(initial?.linked || null);
    const [saving, setSaving] = useState(false);
    const [translating, setTranslating] = useState(false);
    const [error, setError] = useState("");
    const [lastSaved, setLastSaved] = useState<string | null>(null);

    useEffect(() => {
        if (coverFile) {
            const reader = new FileReader();
            reader.onload = () => setCoverImage(reader.result as string);
            reader.readAsDataURL(coverFile);
        }
    }, [coverFile]);

    const handleSave = async () => {
        setError("");
        if (!title.trim()) { setError("Title is required"); return; }
        if (status === "SCHEDULED" && !publishAt) { setError("Pick a date/time for the scheduled publish"); return; }
        setSaving(true);

        let finalCover = coverImage;
        if (coverFile) {
            const fd = new FormData();
            fd.append("file", coverFile);
            fd.append("folder", "blog");
            const up = await fetch("/api/upload", { method: "POST", body: fd });
            if (up.ok) {
                const data = await up.json();
                finalCover = data.url;
            }
        }

        const payload = {
            title,
            lang,
            category,
            body,
            coverImage: finalCover,
            status,
            publishAt: status === "SCHEDULED" ? new Date(publishAt).toISOString() : null,
        };

        const res = await fetch(isEdit ? `/api/blog/${initial!.id}` : "/api/blog", {
            method: isEdit ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        setSaving(false);

        if (!res.ok) {
            setError(data.error || "Failed to save post");
            return;
        }

        setLastSaved(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        if (!isEdit) {
            router.push(`/admin/blog/${data.id}`);
        }
    };

    const handleTranslate = async () => {
        if (!isEdit) return;
        setTranslating(true);
        const res = await fetch(`/api/blog/${initial!.id}/translate`, { method: "POST" });
        const data = await res.json();
        setTranslating(false);
        if (res.ok) {
            router.push(`/admin/blog/${data.id}`);
        } else if (data.linkedId) {
            router.push(`/admin/blog/${data.linkedId}`);
        } else {
            setError(data.error || "Failed to create translation");
        }
    };

    return (
        <div className="editor-page">
            <button className="back-btn" onClick={() => router.push("/admin/blog")}>← Back to Blog</button>
            <h1>{isEdit ? "Edit Post" : "New Post"}</h1>

            {error && <div className="staff-form-error" role="alert">{error}</div>}

            <div className="editor-layout">
                {/* Left column */}
                <div className="left-col">
                    <div className="staff-form-card">
                        <div className="staff-field">
                            <label htmlFor="post-title">Title</label>
                            <input id="post-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Post title…" autoFocus />
                        </div>
                        <div className="staff-field-row">
                            <div className="staff-field">
                                <label htmlFor="post-category">Category</label>
                                <select id="post-category" value={category} onChange={(e) => setCategory(e.target.value)}>
                                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="staff-field">
                                <label>Language</label>
                                <div className="toggle-group">
                                    <button
                                        type="button"
                                        className={`toggle-btn ${lang === "EN" ? "active" : ""}`}
                                        onClick={() => setLang("EN")}
                                        disabled={isEdit}
                                    >
                                        English
                                    </button>
                                    <button
                                        type="button"
                                        className={`toggle-btn ${lang === "AR" ? "active" : ""}`}
                                        onClick={() => setLang("AR")}
                                        disabled={isEdit}
                                    >
                                        العربية
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="staff-form-card">
                        <h2 className="staff-form-card-title">Publishing</h2>
                        <div className="status-buttons">
                            {(["DRAFT", "SCHEDULED", "PUBLISHED"] as const).map((s) => (
                                <button
                                    key={s}
                                    type="button"
                                    className={`status-btn status-${s.toLowerCase()} ${status === s ? "active" : ""}`}
                                    onClick={() => setStatus(s)}
                                >
                                    {s === "DRAFT" ? "Draft" : s === "SCHEDULED" ? "Scheduled" : "Published"}
                                </button>
                            ))}
                        </div>

                        {status === "SCHEDULED" && (
                            <div className="status-panel panel-scheduled staff-field">
                                <label htmlFor="post-publish-at">Goes live on</label>
                                <input id="post-publish-at" type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} />
                            </div>
                        )}

                        {status === "PUBLISHED" && (
                            <div className="status-panel panel-published">
                                <p>Live on the public site.</p>
                                <button type="button" className="unpublish-btn" onClick={() => setStatus("DRAFT")}>Unpublish → Draft</button>
                            </div>
                        )}
                    </div>

                    <div className="staff-form-card">
                        <label htmlFor="post-body" className="staff-form-card-title">Body</label>
                        <div>
                            <div className="toolbar">
                                <span>B</span><span><em>I</em></span><span><LinkIcon size={13} aria-hidden="true" /></span><span>≡</span>
                            </div>
                            <textarea
                                id="post-body"
                                className="body-textarea"
                                rows={10}
                                dir={lang === "AR" ? "rtl" : "ltr"}
                                value={body}
                                onChange={(e) => setBody(e.target.value)}
                                placeholder="Write the post…"
                            />
                        </div>
                    </div>

                    <div className="footer-row">
                        <span className="saved-hint">{lastSaved ? `Last saved ${lastSaved}` : ""}</span>
                        <div className="staff-form-actions">
                            <button className="staff-btn staff-btn-secondary" onClick={() => router.push("/admin/blog")}>Cancel</button>
                            <button className="staff-btn staff-btn-primary" aria-busy={saving} onClick={handleSave} disabled={saving}>
                                {saving ? "Saving…" : "Save Post"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right column */}
                <div className="right-col">
                    <div className="staff-form-card">
                        <h2 className="staff-form-card-title">Cover Image</h2>
                        <div className="drop-zone" onClick={() => fileInputRef.current?.click()}>
                            {coverImage ? (
                                <img src={coverImage} alt="Cover" className="cover-preview" />
                            ) : (
                                <span className="drop-hint">Click to upload</span>
                            )}
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            style={{ display: "none" }}
                            onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                        />
                    </div>

                    <div className="staff-form-card">
                        <h2 className="staff-form-card-title">Translation</h2>
                        {!isEdit ? (
                            <p className="translation-note">Save this post first to create a linked translation.</p>
                        ) : linked ? (
                            <>
                                <p className="translation-note">
                                    Linked to the {linked.lang === "AR" ? "Arabic" : "English"} version.
                                </p>
                                <button className="translate-btn" onClick={() => router.push(`/admin/blog/${linked.id}`)}>
                                    Open translation
                                </button>
                            </>
                        ) : (
                            <>
                                <p className="translation-note">No counterpart yet.</p>
                                <button className="translate-btn" onClick={handleTranslate} disabled={translating}>
                                    {translating ? "Creating…" : `Create ${lang === "EN" ? "Arabic" : "English"} version`}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <style jsx>{`
                .editor-page { max-width: 1200px; }
                .back-btn { background: none; border: none; color: rgba(255,255,255,0.45); font-size: var(--staff-size-base); cursor: pointer; padding: 0; margin-bottom: 1rem; font-family: inherit; }
                .back-btn:hover { color: #fff; }
                h1 { font-size: var(--staff-size-xl); font-weight: 700; margin: 0 0 1.25rem; }
                .editor-page > .staff-form-error { margin-bottom: 1.25rem; }

                .editor-layout { display: grid; grid-template-columns: 1fr 340px; gap: 1.5rem; align-items: start; }
                .left-col, .right-col { display: flex; flex-direction: column; gap: 1rem; }

                .toggle-group { display: flex; gap: 0.4rem; }
                .toggle-btn {
                    flex: 1; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
                    color: rgba(255,255,255,0.6); padding: 0.6rem; border-radius: 8px; font-size: var(--staff-size-base);
                    cursor: pointer; font-family: inherit; transition: all 0.15s;
                }
                .toggle-btn.active { background: rgba(76,175,147,0.18); border-color: var(--primary, #4CAF93); color: var(--primary, #4CAF93); font-weight: 600; }
                .toggle-btn:disabled { opacity: 0.5; cursor: not-allowed; }

                .status-buttons { display: flex; gap: 0.5rem; }
                .status-btn {
                    flex: 1; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
                    color: rgba(255,255,255,0.6); padding: 0.6rem; border-radius: 8px; font-size: var(--staff-size-base);
                    font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.15s;
                }
                .status-btn.status-draft.active { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.3); color: #fff; }
                .status-btn.status-scheduled.active { background: rgba(96,165,250,0.15); border-color: rgba(96,165,250,0.4); color: #93c5fd; }
                .status-btn.status-published.active { background: rgba(16,185,129,0.15); border-color: rgba(16,185,129,0.4); color: #6ee7b7; }

                .status-panel { border-radius: 8px; padding: 0.85rem; display: flex; flex-direction: column; gap: 0.5rem; }
                .panel-scheduled { background: rgba(96,165,250,0.08); border: 1px solid rgba(96,165,250,0.2); }
                .panel-scheduled label { font-size: var(--staff-size-sm); color: #93c5fd; }
                .panel-published { background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.2); }
                .panel-published p { margin: 0; font-size: var(--staff-size-base); color: #6ee7b7; }
                .unpublish-btn {
                    align-self: flex-start; background: rgba(239,68,68,0.12); color: #fca5a5; border: none;
                    padding: 0.4rem 0.8rem; border-radius: 6px; font-size: var(--staff-size-sm); cursor: pointer; font-family: inherit;
                }
                .unpublish-btn:hover { background: rgba(239,68,68,0.2); }

                .toolbar {
                    display: flex; gap: 0.75rem; padding: 0.5rem 0.75rem; background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.08); border-bottom: none; border-radius: 6px 6px 0 0;
                    color: rgba(255,255,255,0.4); font-size: var(--staff-size-base);
                }
                .body-textarea {
                    width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 0 0 8px 8px; padding: 0.75rem; color: #fff; font-size: var(--staff-size-base);
                    outline: none; font-family: inherit; resize: vertical; line-height: 1.6; box-sizing: border-box;
                }
                .body-textarea:focus { border-color: var(--primary, #4CAF93); }

                .footer-row { display: flex; align-items: center; justify-content: space-between; }
                .saved-hint { font-size: var(--staff-size-sm); color: rgba(255,255,255,0.35); }

                .drop-zone {
                    aspect-ratio: 16/9; border-radius: 10px; border: 2px dashed rgba(255,255,255,0.12);
                    display: flex; align-items: center; justify-content: center; cursor: pointer;
                    background: rgba(255,255,255,0.02); overflow: hidden; transition: border-color 0.2s;
                }
                .drop-zone:hover { border-color: var(--primary, #4CAF93); }
                .drop-hint { color: rgba(255,255,255,0.3); font-size: var(--staff-size-base); }
                .cover-preview { width: 100%; height: 100%; object-fit: cover; }

                .translation-note { font-size: var(--staff-size-base); color: rgba(255,255,255,0.5); margin: 0; }
                .translate-btn {
                    width: 100%; background: rgba(76,175,147,0.12); color: var(--primary, #4CAF93); border: none;
                    padding: 0.6rem; border-radius: 8px; font-size: var(--staff-size-base); font-weight: 600; cursor: pointer; font-family: inherit;
                }
                .translate-btn:hover { background: rgba(76,175,147,0.22); }
                .translate-btn:disabled { opacity: 0.5; cursor: not-allowed; }

                @media (max-width: 900px) {
                    .editor-layout { grid-template-columns: 1fr; }
                }

                @media (max-width: 560px) {
                    .editor-page { padding-bottom: 1rem; }
                    .status-buttons { flex-wrap: wrap; }
                    .status-btn { flex: 1 1 45%; }
                    .toolbar { overflow-x: auto; -webkit-overflow-scrolling: touch; }
                    .footer-row { flex-direction: column; align-items: stretch; gap: 0.75rem; }
                }
            `}</style>
        </div>
    );
}
