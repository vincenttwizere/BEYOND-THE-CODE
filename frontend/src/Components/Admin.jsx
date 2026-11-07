import { useEffect, useMemo, useState } from "react";
import { BookOpen, Check, ChevronDown, CirclePlus, FileText, LayoutDashboard, Pencil, Search, ShieldCheck, Trash2, Users, X } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import categories from "../data/categories";
import { apiRequest } from "../api";

const emptyStory = {
    title: "",
    author: "",
    category: categories[0].name,
    body: "",
    published: true,
};

const formatDate = (date) => new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
});

const Admin = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || (searchParams.get("create") === "1" ? "stories" : "overview"));
    const [blogs, setBlogs] = useState([]);
    const [users, setUsers] = useState([]);
    const [editor, setEditor] = useState(() => searchParams.get("create") === "1" ? { ...emptyStory } : null);
    const [query, setQuery] = useState("");
    const [notice, setNotice] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        Promise.all([apiRequest("/api/admin/blogs"), apiRequest("/api/admin/users")])
            .then(([storyData, userData]) => {
                setBlogs(storyData);
                setUsers(userData);
            })
            .catch((loadError) => setError(loadError.message))
            .finally(() => setIsLoading(false));
    }, []);

    const publishedCount = useMemo(() => blogs.filter((blog) => blog.published).length, [blogs]);
    const filteredBlogs = useMemo(() => blogs.filter((blog) =>
        `${blog.title} ${blog.author} ${blog.category}`.toLowerCase().includes(query.toLowerCase())
    ), [blogs, query]);
    const setTab = (tab) => {
        setActiveTab(tab);
        setNotice("");
        setError("");
        setSearchParams(tab === "overview" ? {} : { tab });
    };

    const saveStory = async (event) => {
        event.preventDefault();
        setIsSaving(true);
        setError("");
        try {
            const isEditing = Boolean(editor.id);
            const saved = await apiRequest(
                isEditing ? `/api/admin/blogs/${editor.id}` : "/api/admin/blogs",
                {
                    method: isEditing ? "PATCH" : "POST",
                    body: JSON.stringify({
                        title: editor.title,
                        author: editor.author,
                        category: editor.category,
                        body: editor.body,
                        published: editor.published,
                    }),
                }
            );
            setBlogs((current) => isEditing
                ? current.map((blog) => blog.id === saved.id ? saved : blog)
                : [saved, ...current]);
            setEditor(null);
            setNotice(isEditing ? "Story updated." : "Story created.");
        } catch (saveError) {
            setError(saveError.message);
        } finally {
            setIsSaving(false);
        }
    };

    const deleteStory = async (blog) => {
        if (!window.confirm(`Permanently delete “${blog.title}”?`)) return;
        setError("");
        try {
            await apiRequest(`/api/admin/blogs/${blog.id}`, { method: "DELETE" });
            setBlogs((current) => current.filter((item) => item.id !== blog.id));
            setNotice("Story deleted.");
        } catch (deleteError) {
            setError(deleteError.message);
        }
    };

    const updateRole = async (user, role) => {
        setError("");
        try {
            const { user: updated } = await apiRequest(`/api/admin/users/${user.id}`, {
                method: "PATCH",
                body: JSON.stringify({ role }),
            });
            setUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
            setNotice(`${updated.name} is now ${role === "admin" ? "an administrator" : "a reader"}.`);
        } catch (roleError) {
            setError(roleError.message);
        }
    };

    const deleteUser = async (user) => {
        if (!window.confirm(`Delete the account for ${user.name}? This cannot be undone.`)) return;
        setError("");
        try {
            await apiRequest(`/api/admin/users/${user.id}`, { method: "DELETE" });
            setUsers((current) => current.filter((item) => item.id !== user.id));
            setNotice("Account deleted.");
        } catch (deleteError) {
            setError(deleteError.message);
        }
    };

    return (
        <main className="admin-page">
            <aside className="admin-sidebar">
                <Link className="admin-brand" to="/" aria-label="BEYOND home">BEYOND <span>&lt;/&gt;</span></Link>
                <p className="admin-sidebar-label">Workspace</p>
                <nav aria-label="Admin dashboard">
                    {[
                        ["overview", LayoutDashboard, "Overview"],
                        ["stories", BookOpen, "Stories"],
                        ["users", Users, "Readers"],
                    ].map(([tab, Icon, label]) => (
                        <button
                            key={tab}
                            className={`admin-nav-item${activeTab === tab ? " is-active" : ""}`}
                            type="button"
                            onClick={() => setTab(tab)}
                        >
                            <Icon size={18} aria-hidden="true" />
                            {label}
                            {tab === "users" && <span className="admin-nav-count">{users.length}</span>}
                        </button>
                    ))}
                </nav>
                <div className="admin-sidebar-bottom">
                    <span><ShieldCheck size={17} aria-hidden="true" /> Administrator</span>
                    <Link to="/">View website <span aria-hidden="true">↗</span></Link>
                </div>
            </aside>

            <section className="admin-main">
                <header className="admin-topbar">
                    <div className="admin-breadcrumb">Workspace <span>/</span> {activeTab === "stories" ? "Stories" : activeTab === "users" ? "Readers" : "Overview"}</div>
                    <div className="admin-topbar-right">
                        <span className="admin-live-dot" /> All changes saved
                    </div>
                </header>

                <div className="admin-content">
                    <header className="admin-page-heading">
                        <div>
                            <p className="admin-eyebrow">{activeTab === "overview" ? "YOUR PUBLICATION" : "CONTENT & COMMUNITY"}</p>
                            <h1>{activeTab === "stories" ? "Stories" : activeTab === "users" ? "Readers" : "Good morning."}</h1>
                            <p>{activeTab === "stories"
                                ? "Create, edit, and publish stories for your readers."
                                : activeTab === "users"
                                    ? "Manage reader accounts and administrator access."
                                    : "A clear view of your publication, all in one place."}</p>
                        </div>
                        {activeTab !== "users" && (
                            <button className="admin-primary-button" type="button" onClick={() => {
                                setEditor({ ...emptyStory });
                                setActiveTab("stories");
                                setSearchParams({ tab: "stories" });
                                setError("");
                            }}>
                                <CirclePlus size={17} aria-hidden="true" /> New story
                            </button>
                        )}
                    </header>

                    {notice && <p className="admin-feedback admin-feedback-success" role="status"><Check size={16} />{notice}<button type="button" onClick={() => setNotice("")} aria-label="Dismiss message"><X size={15} /></button></p>}
                    {error && <p className="admin-feedback admin-feedback-error" role="alert">{error}</p>}
                    {isLoading && <p className="admin-loading" role="status">Loading workspace…</p>}

                    {!isLoading && activeTab === "overview" && (
                        <>
                            <div className="admin-stat-grid">
                                <article className="admin-stat-card"><span className="admin-stat-icon admin-stat-icon-warm"><FileText size={19} /></span><span className="admin-stat-label">Total stories</span><strong>{blogs.length}</strong><span className="admin-stat-foot">{publishedCount} published</span></article>
                                <article className="admin-stat-card"><span className="admin-stat-icon admin-stat-icon-green"><Users size={19} /></span><span className="admin-stat-label">Community</span><strong>{users.length}</strong><span className="admin-stat-foot">{users.filter((user) => user.role === "admin").length} administrators</span></article>
                                <article className="admin-stat-card"><span className="admin-stat-icon admin-stat-icon-blue"><BookOpen size={19} /></span><span className="admin-stat-label">Drafts</span><strong>{blogs.length - publishedCount}</strong><span className="admin-stat-foot">Ready when you are</span></article>
                            </div>
                            <section className="admin-panel">
                                <div className="admin-panel-heading"><div><h2>Recently updated</h2><p>Your latest stories and drafts</p></div><button className="admin-inline-link" type="button" onClick={() => setTab("stories")}>View all <span>→</span></button></div>
                                {blogs.length ? <StoryTable blogs={blogs.slice(0, 5)} onEdit={(blog) => { setEditor({ ...blog }); setTab("stories"); }} onDelete={deleteStory} /> : <EmptyState title="No stories yet" copy="Create your first story to get your publication started." />}
                            </section>
                        </>
                    )}

                    {!isLoading && activeTab === "stories" && (
                        <section className="admin-panel">
                            {editor ? (
                                <form className="admin-editor" onSubmit={saveStory}>
                                    <div className="admin-panel-heading"><div><p className="admin-eyebrow">{editor.id ? "EDIT STORY" : "NEW STORY"}</p><h2>{editor.id ? "Update your story" : "Create a story"}</h2></div><button className="admin-icon-button" type="button" onClick={() => { setEditor(null); setError(""); }} aria-label="Close editor"><X size={19} /></button></div>
                                    <label>Story title<input name="title" value={editor.title} onChange={(event) => setEditor({ ...editor, title: event.target.value })} maxLength={120} minLength={3} placeholder="A thoughtful title" required /></label>
                                    <div className="admin-editor-row">
                                        <label>Author<input name="author" value={editor.author} onChange={(event) => setEditor({ ...editor, author: event.target.value })} maxLength={80} minLength={2} placeholder="Author name" required /></label>
                                        <label>Category<select value={editor.category} onChange={(event) => setEditor({ ...editor, category: event.target.value })}>{categories.map((category) => <option key={category.slug} value={category.name}>{category.name}</option>)}</select></label>
                                    </div>
                                    <label>Story content<textarea name="body" value={editor.body} onChange={(event) => setEditor({ ...editor, body: event.target.value })} minLength={50} maxLength={100000} rows={13} placeholder="Write the full story here…" required /></label>
                                    <label className="admin-publish-toggle"><input type="checkbox" checked={Boolean(editor.published)} onChange={(event) => setEditor({ ...editor, published: event.target.checked })} /><span><strong>Publish this story</strong><small>Published stories are visible in the journal. Drafts are only visible to admins.</small></span></label>
                                    <div className="admin-editor-actions"><button className="admin-secondary-button" type="button" onClick={() => setEditor(null)}>Cancel</button><button className="admin-primary-button" type="submit" disabled={isSaving}>{isSaving ? "Saving…" : editor.published ? "Save & publish" : "Save draft"}</button></div>
                                </form>
                            ) : (
                                <>
                                    <div className="admin-panel-heading"><div><h2>All stories</h2><p>{publishedCount} published · {blogs.length - publishedCount} drafts</p></div><div className="admin-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search stories" aria-label="Search stories" /></div></div>
                                    {filteredBlogs.length ? <StoryTable blogs={filteredBlogs} onEdit={(blog) => setEditor({ ...blog })} onDelete={deleteStory} /> : <EmptyState title="No matching stories" copy="Try a different search, or write your first story." />}
                                </>
                            )}
                        </section>
                    )}

                    {!isLoading && activeTab === "users" && (
                        <section className="admin-panel">
                            <div className="admin-panel-heading"><div><h2>Community accounts</h2><p>New readers appear here after signing up.</p></div><span className="admin-total-badge">{users.length} total</span></div>
                            {users.length ? (
                                <div className="admin-table-wrap">
                                    <table className="admin-table">
                                        <thead><tr><th>Reader</th><th>Joined</th><th>Role</th><th><span className="visually-hidden">Actions</span></th></tr></thead>
                                        <tbody>{users.map((user) => (
                                            <tr key={user.id}>
                                                <td><div className="admin-user-cell"><span className="admin-avatar">{user.name.charAt(0).toUpperCase()}</span><span><strong>{user.name}</strong><small>{user.email}</small></span></div></td>
                                                <td>{formatDate(user.createdAt)}</td>
                                                <td><span className={`admin-role-badge${user.role === "admin" ? " is-admin" : ""}`}>{user.role === "admin" && <ShieldCheck size={13} />} {user.role}</span></td>
                                                <td className="admin-actions-cell">
                                                    <label className="admin-role-select"><span className="visually-hidden">Change role for {user.name}</span><select value={user.role} disabled={user.isSystemAdmin} onChange={(event) => updateRole(user, event.target.value)}><option value="reader">Reader</option><option value="admin">Admin</option></select><ChevronDown size={14} /></label>
                                                    {!user.isSystemAdmin && <button className="admin-icon-button is-danger" type="button" onClick={() => deleteUser(user)} aria-label={`Delete ${user.name}`}><Trash2 size={16} /></button>}
                                                </td>
                                            </tr>
                                        ))}</tbody>
                                    </table>
                                </div>
                            ) : <EmptyState title="Your community starts here" copy="Reader accounts will show up as people sign up." />}
                        </section>
                    )}
                </div>
            </section>
        </main>
    );
};

function StoryTable({ blogs, onEdit, onDelete }) {
    return (
        <div className="admin-table-wrap">
            <table className="admin-table">
                <thead><tr><th>Story</th><th>Category</th><th>Updated</th><th>Status</th><th><span className="visually-hidden">Actions</span></th></tr></thead>
                <tbody>{blogs.map((blog) => (
                    <tr key={blog.id}>
                        <td><div className="admin-story-cell"><strong>{blog.title}</strong><small>By {blog.author}</small></div></td>
                        <td>{blog.category}</td>
                        <td>{formatDate(blog.updatedAt)}</td>
                        <td><span className={`admin-status-badge${blog.published ? " is-published" : ""}`}><span />{blog.published ? "Published" : "Draft"}</span></td>
                        <td className="admin-actions-cell">
                            {blog.published && <Link className="admin-icon-button" to={`/blogs/${blog.id}`} target="_blank" rel="noreferrer" aria-label={`Preview ${blog.title}`}><BookOpen size={16} /></Link>}
                            <button className="admin-icon-button" type="button" onClick={() => onEdit(blog)} aria-label={`Edit ${blog.title}`}><Pencil size={16} /></button>
                            <button className="admin-icon-button is-danger" type="button" onClick={() => onDelete(blog)} aria-label={`Delete ${blog.title}`}><Trash2 size={16} /></button>
                        </td>
                    </tr>
                ))}</tbody>
            </table>
        </div>
    );
}

function EmptyState({ title, copy }) {
    return <div className="admin-empty"><span><FileText size={22} /></span><h3>{title}</h3><p>{copy}</p></div>;
}

export default Admin;
