"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import BlogEditor from "../BlogEditor";
import StaffSkeleton from "@/app/components/StaffSkeleton";

export default function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [post, setPost] = useState<React.ComponentProps<typeof BlogEditor>["initial"] | null>(null);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        fetch(`/api/blog/${id}`)
            .then(async (res) => {
                if (!res.ok) { setNotFound(true); return; }
                setPost(await res.json());
            });
    }, [id]);

    if (notFound) {
        return (
            <div style={{ padding: "2rem", color: "rgba(255,255,255,0.5)" }}>
                Post not found.{" "}
                <button
                    onClick={() => router.push("/admin/blog")}
                    style={{ color: "var(--primary, #4CAF93)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}
                >
                    Back to Blog
                </button>
            </div>
        );
    }

    if (!post) {
        return <StaffSkeleton kind="form" title="Edit Post" label="Loading the post…" back={<button className="staff-back" onClick={() => router.push("/admin/blog")}>← Back to Blog</button>} />;
    }

    return <BlogEditor initial={post} />;
}
