import { useEffect, useMemo, useState } from "react";
import { Check, MessageSquare, Send, Trash2 } from "lucide-react";
import { apiRequest } from "../api";

function AdminComments() {
    const [comments, setComments] = useState([]);
    const [statusFilter, setStatusFilter] = useState("all");
    const [selected, setSelected] = useState([]);
    const [bulkStatus, setBulkStatus] = useState("");
    const [replies, setReplies] = useState({});
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        apiRequest("/api/admin/comments")
            .then((items) => {
                if (isMounted) setComments(items);
            })
            .catch((loadError) => {
                if (isMounted) setError(loadError.message);
            })
            .finally(() => {
                if (isMounted) setIsLoading(false);
            });
        return () => {
            isMounted = false;
        };
    }, []);

    const filtered = useMemo(() => comments.filter((item) => statusFilter === "all" || item.status === statusFilter), [comments, statusFilter]);
    const updateComment = async (comment, values, successMessage) => {
        setError("");
        setNotice("");
        try {
            const updated = await apiRequest(`/api/admin/comments/${comment.id}`, {
                method: "PATCH",
                body: JSON.stringify(values),
            });
            setComments((current) => current.map((item) => item.id === updated.id ? updated : item));
            setNotice(successMessage);
            if (values.reply !== undefined) setReplies((current) => ({ ...current, [comment.id]: updated.reply || "" }));
        } catch (updateError) {
            setError(updateError.message);
        }
    };

    const deleteComment = async (comment) => {
        if (!window.confirm("Permanently delete this comment?")) return;
        setError("");
        try {
            await apiRequest(`/api/admin/comments/${comment.id}`, { method: "DELETE" });
            setComments((current) => current.filter((item) => item.id !== comment.id));
            setSelected((current) => current.filter((id) => id !== comment.id));
            setNotice("Comment deleted.");
        } catch (deleteError) {
            setError(deleteError.message);
        }
    };

    const toggleSelected = (id) => setSelected((current) => current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]);

    const applyBulk = async () => {
        if (!bulkStatus || !selected.length) return;
        if (bulkStatus === "delete" && !window.confirm(`Permanently delete ${selected.length} selected comments?`)) return;
        setError("");
        try {
            if (bulkStatus === "delete") {
                await apiRequest("/api/admin/comments/bulk", { method: "DELETE", body: JSON.stringify({ ids: selected }) });
                setComments((current) => current.filter((item) => !selected.includes(item.id)));
                setNotice("Selected comments deleted.");
            } else {
                const updated = await apiRequest("/api/admin/comments/bulk", {
                    method: "PATCH",
                    body: JSON.stringify({ ids: selected, status: bulkStatus }),
                });
                setComments((current) => current.map((item) => updated.find((entry) => entry.id === item.id) || item));
                setNotice(`Selected comments marked ${bulkStatus}.`);
            }
            setSelected([]);
            setBulkStatus("");
        } catch (bulkError) {
            setError(bulkError.message);
        }
    };

    return (
        <div className="admin-module-stack">
            {notice && <p className="admin-feedback admin-feedback-success" role="status"><Check size={16} />{notice}</p>}
            {error && <p className="admin-feedback admin-feedback-error" role="alert">{error}</p>}
            <section className="admin-panel">
                <div className="admin-panel-heading">
                    <div><h2>Comment moderation</h2><p>Review and respond to conversations on your posts.</p></div>
                    <label className="admin-comment-filter">Filter by status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="spam">Spam</option></select></label>
                </div>
                {selected.length > 0 && <div className="admin-bulk-actions"><span>{selected.length} selected</span><select aria-label="Bulk comment action" value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)}><option value="">Choose action</option><option value="approved">Approve</option><option value="rejected">Reject</option><option value="spam">Mark as spam</option><option value="delete">Delete</option></select><button className="admin-secondary-button" type="button" disabled={!bulkStatus} onClick={applyBulk}>Apply</button></div>}
                {isLoading ? <p className="admin-loading" role="status">Loading comments…</p> : filtered.length ? (
                    <div className="admin-comment-list">
                        {filtered.map((comment) => (
                            <article className="admin-comment-card" key={comment.id}>
                                <div className="admin-comment-card-top">
                                    <label className="admin-comment-select"><input type="checkbox" checked={selected.includes(comment.id)} onChange={() => toggleSelected(comment.id)} aria-label={`Select comment by ${comment.name}`} /></label>
                                    <span className="admin-avatar">{comment.name?.charAt(0).toUpperCase() || "?"}</span>
                                    <div className="admin-comment-author"><strong>{comment.name}</strong><small>{new Date(comment.createdAt).toLocaleString()}</small></div>
                                    <span className={`admin-role-badge admin-comment-status is-${comment.status}`}>{comment.status}</span>
                                </div>
                                <p className="admin-comment-post">On <strong>{comment.postTitle}</strong></p>
                                <p className="admin-comment-body">{comment.body}</p>
                                <div className="admin-comment-reply">
                                    <label htmlFor={`reply-${comment.id}`}>Admin reply</label>
                                    <textarea id={`reply-${comment.id}`} maxLength={2000} rows={2} value={replies[comment.id] ?? comment.reply ?? ""} onChange={(event) => setReplies((current) => ({ ...current, [comment.id]: event.target.value }))} placeholder="Write a reply…" />
                                    <button className="admin-secondary-button" type="button" onClick={() => updateComment(comment, { reply: replies[comment.id] ?? comment.reply ?? "" }, "Reply saved.")}><Send size={14} /> Save reply</button>
                                </div>
                                <div className="admin-comment-actions">
                                    {comment.status !== "approved" && <button className="admin-secondary-button" type="button" onClick={() => updateComment(comment, { status: "approved" }, "Comment approved.")}>Approve</button>}
                                    {comment.status !== "rejected" && <button className="admin-secondary-button" type="button" onClick={() => updateComment(comment, { status: "rejected" }, "Comment rejected.")}>Reject</button>}
                                    {comment.status !== "spam" && <button className="admin-secondary-button" type="button" onClick={() => updateComment(comment, { status: "spam" }, "Comment marked as spam.")}>Mark as spam</button>}
                                    <button className="admin-icon-button is-danger" type="button" onClick={() => deleteComment(comment)} aria-label={`Delete comment by ${comment.name}`}><Trash2 size={15} /></button>
                                </div>
                            </article>
                        ))}
                    </div>
                ) : <div className="admin-empty"><span><MessageSquare size={22} /></span><h3>No comments to show</h3><p>Comments that match this filter will appear here.</p></div>}
            </section>
        </div>
    );
}

export default AdminComments;
