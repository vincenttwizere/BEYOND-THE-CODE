import { useEffect, useMemo, useState } from "react";
import { Download, Mail, Plus, Send, Trash2 } from "lucide-react";
import { apiRequest } from "../api";

function AdminNewsletter() {
    const [subscribers, setSubscribers] = useState([]);
    const [newsletters, setNewsletters] = useState([]);
    const [statusFilter, setStatusFilter] = useState("all");
    const [editor, setEditor] = useState(null);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        let isMounted = true;
        Promise.all([apiRequest("/api/admin/subscribers"), apiRequest("/api/admin/newsletters")])
            .then(([subscriberData, newsletterData]) => {
                if (!isMounted) return;
                setSubscribers(subscriberData);
                setNewsletters(newsletterData);
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

    const filteredSubscribers = useMemo(() => subscribers.filter((item) => statusFilter === "all" || item.status === statusFilter), [subscribers, statusFilter]);
    const updateSubscriber = async (subscriber, status) => {
        setError("");
        try {
            const updated = await apiRequest(`/api/admin/subscribers/${subscriber.id}`, {
                method: "PATCH",
                body: JSON.stringify({ status }),
            });
            setSubscribers((current) => current.map((item) => item.id === updated.id ? updated : item));
        } catch (updateError) {
            setError(updateError.message);
        }
    };

    const deleteSubscriber = async (subscriber) => {
        if (!window.confirm(`Remove ${subscriber.email} from your subscriber list?`)) return;
        try {
            await apiRequest(`/api/admin/subscribers/${subscriber.id}`, { method: "DELETE" });
            setSubscribers((current) => current.filter((item) => item.id !== subscriber.id));
            setNotice("Subscriber removed.");
        } catch (deleteError) {
            setError(deleteError.message);
        }
    };

    const exportCsv = () => {
        const active = subscribers.filter((item) => item.status === "active");
        const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
        const rows = [["email", "status", "subscribed_at"], ...active.map((item) => [item.email, item.status, item.createdAt])];
        const blob = new Blob([rows.map((row) => row.map(quote).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "beyond-subscribers.csv";
        anchor.click();
        URL.revokeObjectURL(url);
    };

    const saveNewsletter = async (event) => {
        event.preventDefault();
        setIsSaving(true);
        setError("");
        try {
            const saved = await apiRequest(editor.id ? `/api/admin/newsletters/${editor.id}` : "/api/admin/newsletters", {
                method: editor.id ? "PATCH" : "POST",
                body: JSON.stringify({ subject: editor.subject, body: editor.body }),
            });
            setNewsletters((current) => editor.id
                ? current.map((item) => item.id === saved.id ? saved : item)
                : [saved, ...current]);
            setEditor(null);
            setNotice("Newsletter draft saved.");
        } catch (saveError) {
            setError(saveError.message);
        } finally {
            setIsSaving(false);
        }
    };

    const sendNewsletter = async (newsletter) => {
        if (!window.confirm(`Send “${newsletter.subject}” to active subscribers?`)) return;
        setError("");
        try {
            await apiRequest(`/api/admin/newsletters/${newsletter.id}/send`, { method: "POST" });
        } catch (sendError) {
            setError(sendError.message);
        }
    };

    const deleteNewsletter = async (newsletter) => {
        if (!window.confirm(`Delete “${newsletter.subject}”?`)) return;
        try {
            await apiRequest(`/api/admin/newsletters/${newsletter.id}`, { method: "DELETE" });
            setNewsletters((current) => current.filter((item) => item.id !== newsletter.id));
            setNotice("Newsletter draft deleted.");
        } catch (deleteError) {
            setError(deleteError.message);
        }
    };

    return (
        <div className="admin-module-stack">
            {notice && <p className="admin-feedback admin-feedback-success" role="status">{notice}</p>}
            {error && <p className="admin-feedback admin-feedback-error" role="alert">{error}</p>}
            {editor ? (
                <section className="admin-panel">
                    <form className="admin-newsletter-editor" onSubmit={saveNewsletter}>
                        <div className="admin-panel-heading"><div><h2>{editor.id ? "Edit newsletter" : "Compose newsletter"}</h2><p>Save your message as a draft before sending.</p></div></div>
                        <label>Subject<input value={editor.subject} onChange={(event) => setEditor({ ...editor, subject: event.target.value })} minLength={3} maxLength={160} required /></label>
                        <label>Message<textarea value={editor.body} onChange={(event) => setEditor({ ...editor, body: event.target.value })} minLength={10} maxLength={20000} rows={12} required /></label>
                        <p className="admin-provider-note" role="note">Delivery is unavailable until a server-side email provider is configured. No subscriber emails will be sent by this dashboard yet.</p>
                        <div className="admin-editor-actions"><button className="admin-secondary-button" type="button" onClick={() => setEditor(null)}>Cancel</button><button className="admin-primary-button" type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save draft"}</button></div>
                    </form>
                </section>
            ) : (
                <>
                    <section className="admin-panel">
                        <div className="admin-panel-heading">
                            <div><h2>Subscribers</h2><p>{subscribers.filter((item) => item.status === "active").length} active · {subscribers.length} total</p></div>
                            <div className="admin-newsletter-actions"><button className="admin-secondary-button" type="button" onClick={exportCsv}><Download size={15} /> Export active CSV</button><label className="admin-comment-filter">Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All</option><option value="active">Active</option><option value="pending">Pending</option><option value="unsubscribed">Unsubscribed</option></select></label></div>
                        </div>
                        {isLoading ? <p className="admin-loading" role="status">Loading subscribers…</p> : filteredSubscribers.length ? (
                            <div className="admin-table-wrap">
                                <table className="admin-table">
                                    <thead><tr><th>Email</th><th>Subscribed</th><th>Status</th><th><span className="visually-hidden">Actions</span></th></tr></thead>
                                    <tbody>{filteredSubscribers.map((subscriber) => (
                                        <tr key={subscriber.id}>
                                            <td>{subscriber.email}</td>
                                            <td>{new Date(subscriber.createdAt).toLocaleDateString()}</td>
                                            <td><select className="admin-inline-select" aria-label={`Set status for ${subscriber.email}`} value={subscriber.status} onChange={(event) => updateSubscriber(subscriber, event.target.value)}><option value="pending">Pending</option><option value="active">Active</option><option value="unsubscribed">Unsubscribed</option></select></td>
                                            <td><button className="admin-icon-button is-danger" type="button" onClick={() => deleteSubscriber(subscriber)} aria-label={`Remove ${subscriber.email}`}><Trash2 size={15} /></button></td>
                                        </tr>
                                    ))}</tbody>
                                </table>
                            </div>
                        ) : <div className="admin-empty"><span><Mail size={22} /></span><h3>No subscribers found</h3><p>Newsletter sign-ups will appear here.</p></div>}
                    </section>
                    <section className="admin-panel">
                        <div className="admin-panel-heading"><div><h2>Newsletters</h2><p>Draft a message for your active subscribers.</p></div><button className="admin-primary-button" type="button" onClick={() => setEditor({ subject: "", body: "" })}><Plus size={16} /> Compose</button></div>
                        {isLoading ? <p className="admin-loading" role="status">Loading newsletters…</p> : newsletters.length ? (
                            <div className="admin-table-wrap"><table className="admin-table">
                                <thead><tr><th>Subject</th><th>Updated</th><th>Status</th><th><span className="visually-hidden">Actions</span></th></tr></thead>
                                <tbody>{newsletters.map((newsletter) => <tr key={newsletter.id}>
                                    <td><strong>{newsletter.subject}</strong></td><td>{new Date(newsletter.updatedAt).toLocaleDateString()}</td><td>{newsletter.status}</td>
                                    <td className="admin-actions-cell"><button className="admin-icon-button" type="button" onClick={() => setEditor({ ...newsletter })} aria-label={`Edit ${newsletter.subject}`}><Mail size={15} /></button><button className="admin-icon-button" type="button" onClick={() => sendNewsletter(newsletter)} aria-label={`Send ${newsletter.subject}`}><Send size={15} /></button><button className="admin-icon-button is-danger" type="button" onClick={() => deleteNewsletter(newsletter)} aria-label={`Delete ${newsletter.subject}`}><Trash2 size={15} /></button></td>
                                </tr>)}</tbody>
                            </table></div>
                        ) : <div className="admin-empty"><span><Mail size={22} /></span><h3>No newsletters yet</h3><p>Compose a newsletter to start a draft.</p></div>}
                    </section>
                </>
            )}
        </div>
    );
}

export default AdminNewsletter;
