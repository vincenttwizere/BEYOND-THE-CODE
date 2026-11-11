import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Check, ChevronDown, CirclePlus, Eye, FileText, Mail, MessageSquare, Pencil, Search, ShieldCheck, Trash2, Users, X } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import categories from "../data/categories";
import { apiRequest } from "../api";
import { useAuth } from "../useAuth";
import AdminLayout from "./AdminLayout";
import AdminTaxonomy from "./AdminTaxonomy";
import AdminComments from "./AdminComments";
import AdminNewsletter from "./AdminNewsletter";
import AdminAnalytics from "./AdminAnalytics";
import AdminMedia from "./AdminMedia";
import AdminPages from "./AdminPages";
import AdminSettings from "./AdminSettings";
import RichText from "./RichText";

const emptyStory = {
    title: "",
    slug: "",
    author: "",
    category: categories[0].name,
    body: "",
    excerpt: "",
    tags: [],
    status: "draft",
    published: false,
    metaTitle: "",
    metaDescription: "",
    ogImage: "",
    featuredImage: "",
    scheduledAt: "",
};

const getPostStatus = (blog) => blog.status || (blog.published ? "published" : "draft");
const makeSlug = (title) => title.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
const formatDate = (date) => new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
});

const Admin = () => {
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || (searchParams.get("create") === "1" ? "stories" : "overview"));
    const [blogs, setBlogs] = useState([]);
    const [categoryOptions, setCategoryOptions] = useState(categories);
    const [users, setUsers] = useState([]);
    const [userQuery, setUserQuery] = useState("");
    const [userStatusFilter, setUserStatusFilter] = useState("all");
    const [overview, setOverview] = useState(null);
    const [editor, setEditor] = useState(() => {
        if (searchParams.get("create") === "1") return { ...emptyStory };
        try {
            const saved = window.localStorage.getItem("beyond-admin-post-autosave");
            return saved ? { ...emptyStory, ...JSON.parse(saved) } : null;
        } catch (storageError) {
            console.error("Could not restore the local post draft:", storageError);
            return null;
        }
    });
    const [query, setQuery] = useState("");
    const [postStatus, setPostStatus] = useState(() => searchParams.get("tab") === "drafts" ? "draft" : "all");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [authorFilter, setAuthorFilter] = useState("all");
    const [dateFilter, setDateFilter] = useState("");
    const [sortOrder, setSortOrder] = useState("updated-desc");
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedPosts, setSelectedPosts] = useState([]);
    const [bulkStatus, setBulkStatus] = useState("");
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [notice, setNotice] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const bodyRef = useRef(null);

    useEffect(() => {
        Promise.all([apiRequest("/api/admin/blogs"), apiRequest("/api/admin/users"), apiRequest("/api/admin/overview"), apiRequest("/api/admin/categories")])
            .then(([storyData, userData, overviewData, categoryData]) => {
                setBlogs(storyData);
                setUsers(userData);
                setOverview(overviewData);
                setCategoryOptions(categoryData);
            })
            .catch((loadError) => setError(loadError.message))
            .finally(() => setIsLoading(false));
    }, []);

    useEffect(() => {
        if (!editor) return undefined;
        const timer = window.setTimeout(() => {
            try {
                window.localStorage.setItem("beyond-admin-post-autosave", JSON.stringify(editor));
            } catch (storageError) {
                console.error("Could not save the post draft locally:", storageError);
            }
        }, 700);
        return () => window.clearTimeout(timer);
    }, [editor]);

    const publishedCount = useMemo(() => blogs.filter((blog) => getPostStatus(blog) === "published").length, [blogs]);
    const filteredBlogs = useMemo(() => blogs
        .filter((blog) => postStatus === "all" || getPostStatus(blog) === postStatus)
        .filter((blog) => categoryFilter === "all" || blog.category === categoryFilter)
        .filter((blog) => authorFilter === "all" || blog.author === authorFilter)
        .filter((blog) => !dateFilter || new Date(blog.updatedAt) >= new Date(`${dateFilter}T00:00:00`))
        .filter((blog) => `${blog.title} ${blog.author} ${blog.category} ${(blog.tags || []).join(" ")}`.toLowerCase().includes(query.toLowerCase()))
        .sort((left, right) => sortOrder === "title-asc"
            ? left.title.localeCompare(right.title)
            : sortOrder === "updated-asc"
                ? new Date(left.updatedAt) - new Date(right.updatedAt)
                : new Date(right.updatedAt) - new Date(left.updatedAt)), [blogs, postStatus, categoryFilter, authorFilter, dateFilter, query, sortOrder]);
    const pageSize = 10;
    const pageCount = Math.max(1, Math.ceil(filteredBlogs.length / pageSize));
    const activePage = Math.min(currentPage, pageCount);
    const visibleBlogs = filteredBlogs.slice((activePage - 1) * pageSize, activePage * pageSize);
    const authors = useMemo(() => [...new Set(blogs.map((blog) => blog.author).filter(Boolean))].sort(), [blogs]);
    const filteredUsers = useMemo(() => users.filter((item) =>
        (userStatusFilter === "all" || (item.status || "active") === userStatusFilter) &&
        `${item.name} ${item.email} ${item.role}`.toLowerCase().includes(userQuery.toLowerCase())
    ), [users, userQuery, userStatusFilter]);
    const setTab = (tab) => {
        setActiveTab(tab);
        setNotice("");
        setError("");
        setSearchParams(tab === "overview" ? {} : { tab });
    };
    const navigateDashboard = (destination) => {
        if (destination === "create") {
            setEditor({ ...emptyStory });
            setPostStatus("all");
            setTab("stories");
            return;
        }
        if (destination === "drafts") {
            setPostStatus("draft");
            setTab("drafts");
            return;
        }
        if (destination === "stories") setPostStatus("all");
        setTab(destination);
    };
    const updateEditor = (field, value) => {
        setEditor((current) => {
            if (!current) return current;
            const next = { ...current, [field]: value };
            if (field === "title" && (!current.slug || current.slug === makeSlug(current.title))) {
                next.slug = makeSlug(value);
            }
            if (field === "status") next.published = value === "published";
            return next;
        });
    };

    const insertCodeBlock = () => {
        const textarea = bodyRef.current;
        const currentBody = editor.body || "";
        const start = textarea?.selectionStart ?? currentBody.length;
        const end = textarea?.selectionEnd ?? currentBody.length;
        const snippet = "\n```js\n\n```\n";
        const nextBody = `${currentBody.slice(0, start)}${snippet}${currentBody.slice(end)}`;
        updateEditor("body", nextBody);
        requestAnimationFrame(() => {
            textarea?.focus();
            textarea?.setSelectionRange(start + 7, start + 7);
        });
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
                        slug: editor.slug || makeSlug(editor.title),
                        author: editor.author,
                        category: editor.category,
                        body: editor.body,
                        excerpt: editor.excerpt,
                        tags: editor.tags,
                        status: editor.status || (editor.published ? "published" : "draft"),
                        published: editor.status === "published" || editor.published,
                        metaTitle: editor.metaTitle,
                        metaDescription: editor.metaDescription,
                        ogImage: editor.ogImage,
                        featuredImage: editor.featuredImage,
                        scheduledAt: editor.scheduledAt || null,
                    }),
                }
            );
            setBlogs((current) => isEditing
                ? current.map((blog) => blog.id === saved.id ? saved : blog)
                : [saved, ...current]);
            setEditor(null);
            setIsPreviewing(false);
            try {
                window.localStorage.removeItem("beyond-admin-post-autosave");
            } catch (storageError) {
                console.error("Could not clear the local post draft:", storageError);
            }
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

    const updateUserStatus = async (user, status) => {
        if (status !== "active" && !window.confirm(`${status === "banned" ? "Ban" : "Suspend"} ${user.name}? Their account sessions will end and they will not be able to sign in.`)) return;
        setError("");
        try {
            const { user: updated } = await apiRequest(`/api/admin/users/${user.id}`, {
                method: "PATCH",
                body: JSON.stringify({ status }),
            });
            setUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
            setNotice(`${updated.name} is now ${status}.`);
        } catch (statusError) {
            setError(statusError.message);
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

    const togglePostSelection = (id) => {
        setSelectedPosts((current) => current.includes(id)
            ? current.filter((item) => item !== id)
            : [...current, id]);
    };
    const togglePageSelection = (pageBlogs) => {
        const pageIds = pageBlogs.map((blog) => blog.id);
        const allSelected = pageIds.every((id) => selectedPosts.includes(id));
        setSelectedPosts((current) => allSelected
            ? current.filter((id) => !pageIds.includes(id))
            : [...new Set([...current, ...pageIds])]);
    };
    const applyBulkAction = async () => {
        if (!bulkStatus || !selectedPosts.length) return;
        if (bulkStatus === "delete" && !window.confirm(`Permanently delete ${selectedPosts.length} selected posts? This cannot be undone.`)) return;
        setError("");
        try {
            if (bulkStatus === "delete") {
                await Promise.all(selectedPosts.map((id) => apiRequest(`/api/admin/blogs/${id}`, { method: "DELETE" })));
                setBlogs((current) => current.filter((blog) => !selectedPosts.includes(blog.id)));
                setNotice(`${selectedPosts.length} posts deleted.`);
            } else {
                const updated = await Promise.all(selectedPosts.map((id) => apiRequest(`/api/admin/blogs/${id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ status: bulkStatus }),
                })));
                setBlogs((current) => current.map((blog) => updated.find((item) => item.id === blog.id) || blog));
                setNotice(`${selectedPosts.length} posts moved to ${bulkStatus}.`);
            }
            setSelectedPosts([]);
            setBulkStatus("");
        } catch (bulkError) {
            setError(bulkError.message);
        }
    };

    return (
        <AdminLayout activeTab={activeTab} onNavigate={navigateDashboard} onSearch={setQuery} searchValue={query} user={user}>
            <div className="admin-content">
                    <header className="admin-page-heading">
                        <div>
                            <p className="admin-eyebrow">{activeTab === "overview" ? "YOUR PUBLICATION" : "CONTENT & COMMUNITY"}</p>
                            <h1>{activeTab === "stories" ? "Posts" : activeTab === "drafts" ? "Drafts" : activeTab === "users" ? "Users" : activeTab === "categories" ? "Categories & Tags" : activeTab === "media" ? "Media Library" : activeTab === "comments" ? "Comments" : activeTab === "subscribers" ? "Subscribers & Newsletter" : activeTab === "analytics" ? "Analytics" : activeTab === "pages" ? "Pages & Navigation" : activeTab === "settings" ? "Settings" : "Good morning."}</h1>
                            <p>{["stories", "drafts"].includes(activeTab)
                                ? "Create, edit, and publish stories for your readers."
                                : activeTab === "users"
                                    ? "Manage user accounts and administrator access."
                                    : activeTab === "overview"
                                        ? "A clear view of your publication, all in one place."
                                        : "Manage this part of your publication."}</p>
                        </div>
                        {["overview", "stories", "drafts"].includes(activeTab) && (
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
                                <StatCard icon={FileText} label="Total posts" value={overview?.posts ?? blogs.length} foot={`${overview?.published ?? publishedCount} published`} tone="warm" />
                                <StatCard icon={BookOpen} label="Drafts" value={overview?.drafts ?? blogs.length - publishedCount} foot="Ready when you are" tone="blue" />
                                <StatCard icon={Eye} label="Total views" value={overview?.views ?? 0} foot="Public page views" tone="green" />
                                <StatCard icon={MessageSquare} label="Comments" value={overview?.comments ?? 0} foot={`${overview?.pendingComments ?? 0} pending review`} tone="blue" />
                                <StatCard icon={Mail} label="Subscribers" value={overview?.subscribers ?? 0} foot="Active subscribers" tone="warm" />
                                <StatCard icon={Users} label="Users" value={overview?.users ?? users.length} foot={`${users.filter((item) => item.role === "admin").length} administrators`} tone="green" />
                            </div>
                            <div className="admin-overview-grid">
                                <section className="admin-panel admin-chart-panel">
                                    <div className="admin-panel-heading"><div><h2>Views over time</h2><p>Daily public page views · last 14 days</p></div></div>
                                    <BarChart values={overview?.viewsByDay || []} label="Daily page views" />
                                </section>
                                <section className="admin-panel admin-chart-panel">
                                    <div className="admin-panel-heading"><div><h2>Audience growth</h2><p>New users and subscribers by day</p></div></div>
                                    <GrowthChart values={overview?.growthByDay || []} />
                                </section>
                            </div>
                            <div className="admin-overview-grid">
                                <section className="admin-panel admin-overview-list-panel">
                                    <div className="admin-panel-heading"><div><h2>Top posts</h2><p>Most viewed public posts</p></div><button className="admin-inline-link" type="button" onClick={() => setTab("stories")}>All posts <span>→</span></button></div>
                                    {overview?.topPosts?.length ? (
                                        <ol className="admin-top-posts">{overview.topPosts.map((post, index) => <li key={post.id}><span>{String(index + 1).padStart(2, "0")}</span><strong>{post.title}</strong><small>{post.views} views</small></li>)}</ol>
                                    ) : <EmptyState title="No post views yet" copy="Page views will appear here as readers visit your site." />}
                                </section>
                                <section className="admin-panel admin-overview-list-panel">
                                    <div className="admin-panel-heading"><div><h2>Pending comments</h2><p>Comments that need your review</p></div><button className="admin-inline-link" type="button" onClick={() => setTab("comments")}>Review <span>→</span></button></div>
                                    {overview?.pendingComments ? <p className="admin-pending-summary">{overview.pendingComments} comments are waiting for approval.</p> : <EmptyState title="You’re all caught up" copy="New comments waiting for review will show up here." />}
                                </section>
                            </div>
                            <div className="admin-quick-actions">
                                <span>Quick actions</span>
                                <button className="admin-primary-button" type="button" onClick={() => navigateDashboard("create")}><CirclePlus size={16} /> New post</button>
                                <Link className="admin-secondary-button" to="/">View site <span aria-hidden="true">↗</span></Link>
                            </div>
                            <section className="admin-panel">
                                <div className="admin-panel-heading"><div><h2>Recently updated</h2><p>Your latest stories and drafts</p></div><button className="admin-inline-link" type="button" onClick={() => setTab("stories")}>View all <span>→</span></button></div>
                                {overview?.recentPosts?.length ? <StoryTable blogs={overview.recentPosts} onEdit={(blog) => { setEditor({ ...blog }); setTab("stories"); }} onDelete={deleteStory} /> : <EmptyState title="No stories yet" copy="Create your first story to get your publication started." />}
                            </section>
                        </>
                    )}

                    {!isLoading && ["stories", "drafts"].includes(activeTab) && (
                        <section className="admin-panel">
                            {editor ? (
                                <form className="admin-editor" onSubmit={saveStory}>
                                    <div className="admin-panel-heading">
                                        <div><p className="admin-eyebrow">{editor.id ? "EDIT POST" : "NEW POST"}</p><h2>{editor.id ? "Update your post" : "Create a post"}</h2></div>
                                        <div className="admin-editor-heading-actions">
                                            <button className="admin-secondary-button" type="button" onClick={() => setIsPreviewing((value) => !value)}>{isPreviewing ? "Edit post" : "Preview"}</button>
                                            <button className="admin-icon-button" type="button" onClick={() => { setEditor(null); setError(""); }} aria-label="Close editor"><X size={19} /></button>
                                        </div>
                                    </div>
                                    {!isPreviewing ? (
                                        <>
                                            <label>Post title<input name="title" value={editor.title} onChange={(event) => updateEditor("title", event.target.value)} maxLength={120} minLength={3} placeholder="A thoughtful title" required /></label>
                                            <label>Slug<input name="slug" value={editor.slug} onChange={(event) => updateEditor("slug", makeSlug(event.target.value))} maxLength={120} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="auto-generated-from-title" required /></label>
                                            <div className="admin-editor-row">
                                                <label>Author<input name="author" value={editor.author} onChange={(event) => updateEditor("author", event.target.value)} maxLength={80} minLength={2} placeholder="Author name" required /></label>
                                                <label>Category<select value={editor.category} onChange={(event) => updateEditor("category", event.target.value)}>{categoryOptions.map((category) => <option key={category.slug} value={category.name}>{category.name}</option>)}</select></label>
                                            </div>
                                            <label>Excerpt<textarea name="excerpt" value={editor.excerpt || ""} onChange={(event) => updateEditor("excerpt", event.target.value)} maxLength={500} rows={3} placeholder="A short summary for post cards and search results" /></label>
                                            <label>Tags<input name="tags" value={(editor.tags || []).join(", ")} onChange={(event) => updateEditor("tags", event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 30))} placeholder="react, accessibility, career" /></label>
                                            <div className="admin-editor-toolbar"><span>Post content · Markdown supported</span><button className="admin-secondary-button" type="button" onClick={insertCodeBlock}>Insert code block</button></div>
                                            <label className="visually-hidden" htmlFor="admin-post-body">Post content</label>
                                            <textarea ref={bodyRef} id="admin-post-body" name="body" value={editor.body} onChange={(event) => updateEditor("body", event.target.value)} minLength={50} maxLength={100000} rows={15} placeholder="Write the full post here…" required />
                                            <div className="admin-editor-row">
                                                <label>Featured image URL<input name="featuredImage" type="url" value={editor.featuredImage || ""} onChange={(event) => updateEditor("featuredImage", event.target.value)} maxLength={500} placeholder="https://…" /></label>
                                                <label>Open Graph image URL<input name="ogImage" type="url" value={editor.ogImage || ""} onChange={(event) => updateEditor("ogImage", event.target.value)} maxLength={500} placeholder="https://…" /></label>
                                            </div>
                                            <fieldset className="admin-seo-fields">
                                                <legend>Search engine preview</legend>
                                                <label>Meta title<input name="metaTitle" value={editor.metaTitle || ""} onChange={(event) => updateEditor("metaTitle", event.target.value)} maxLength={120} placeholder={editor.title || "Post title"} /></label>
                                                <label>Meta description<textarea name="metaDescription" value={editor.metaDescription || ""} onChange={(event) => updateEditor("metaDescription", event.target.value)} maxLength={320} rows={3} placeholder="Describe this post for search results" /></label>
                                            </fieldset>
                                            <div className="admin-editor-row">
                                                <label>Status<select value={editor.status || (editor.published ? "published" : "draft")} onChange={(event) => updateEditor("status", event.target.value)}><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
                                                {editor.status === "scheduled" && <label>Publish date and time<input type="datetime-local" value={editor.scheduledAt ? toLocalDateTime(editor.scheduledAt) : ""} onChange={(event) => updateEditor("scheduledAt", event.target.value)} required /></label>}
                                            </div>
                                        </>
                                    ) : (
                                        <article className="admin-post-preview">
                                            <p className="admin-eyebrow">{editor.category || "POST PREVIEW"}</p>
                                            <h2>{editor.title || "Untitled post"}</h2>
                                            {editor.excerpt && <p className="admin-preview-excerpt">{editor.excerpt}</p>}
                                            <MarkdownPreview body={editor.body} />
                                        </article>
                                    )}
                                    <div className="admin-editor-actions">
                                        <span className="admin-autosave-note">Draft is auto-saved on this device.</span>
                                        <button className="admin-secondary-button" type="button" onClick={() => { setEditor(null); setError(""); }}>Cancel</button>
                                        <button className="admin-primary-button" type="submit" disabled={isSaving}>{isSaving ? "Saving…" : editor.status === "published" ? "Save & publish" : editor.status === "scheduled" ? "Schedule post" : editor.status === "archived" ? "Save as archived" : "Save draft"}</button>
                                    </div>
                                </form>
                            ) : (
                                <>
                                    <div className="admin-panel-heading"><div><h2>{activeTab === "drafts" ? "Drafts" : "All posts"}</h2><p>{publishedCount} published · {blogs.length - publishedCount} not published</p></div><div className="admin-search"><Search size={16} /><input value={query} onChange={(event) => { setQuery(event.target.value); setCurrentPage(1); }} placeholder="Search posts" aria-label="Search posts" /></div></div>
                                    <div className="admin-post-filters">
                                        <label>Status<select value={postStatus} onChange={(event) => { setPostStatus(event.target.value); setCurrentPage(1); }}><option value="all">All statuses</option><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
                                        <label>Category<select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setCurrentPage(1); }}><option value="all">All categories</option>{categoryOptions.map((item) => <option key={item.slug} value={item.name}>{item.name}</option>)}</select></label>
                                        <label>Author<select value={authorFilter} onChange={(event) => { setAuthorFilter(event.target.value); setCurrentPage(1); }}><option value="all">All authors</option>{authors.map((author) => <option key={author} value={author}>{author}</option>)}</select></label>
                                        <label>Updated after<input type="date" value={dateFilter} onChange={(event) => { setDateFilter(event.target.value); setCurrentPage(1); }} /></label>
                                        <label>Sort<select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}><option value="updated-desc">Newest first</option><option value="updated-asc">Oldest first</option><option value="title-asc">Title A–Z</option></select></label>
                                    </div>
                                    {selectedPosts.length > 0 && (
                                        <div className="admin-bulk-actions">
                                            <span>{selectedPosts.length} selected</span>
                                            <label className="visually-hidden" htmlFor="admin-bulk-status">Bulk action</label>
                                            <select id="admin-bulk-status" value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)}><option value="">Choose action</option><option value="draft">Move to drafts</option><option value="published">Publish</option><option value="archived">Archive</option><option value="delete">Delete</option></select>
                                            <button className="admin-secondary-button" type="button" disabled={!bulkStatus} onClick={applyBulkAction}>Apply</button>
                                        </div>
                                    )}
                                    {filteredBlogs.length ? (
                                        <>
                                            <StoryTable
                                                blogs={visibleBlogs}
                                                onEdit={(blog) => { setEditor({ ...emptyStory, ...blog, status: getPostStatus(blog) }); setIsPreviewing(false); }}
                                                onDelete={deleteStory}
                                                selectedPosts={selectedPosts}
                                                onTogglePost={togglePostSelection}
                                                onTogglePage={togglePageSelection}
                                            />
                                            <div className="admin-pagination"><span>{filteredBlogs.length} posts · Page {activePage} of {pageCount}</span><div><button className="admin-secondary-button" type="button" onClick={() => setCurrentPage(Math.max(1, activePage - 1))} disabled={activePage === 1}>Previous</button><button className="admin-secondary-button" type="button" onClick={() => setCurrentPage(Math.min(pageCount, activePage + 1))} disabled={activePage === pageCount}>Next</button></div></div>
                                        </>
                                    ) : <EmptyState title="No matching posts" copy="Try adjusting your filters, or write your first post." />}
                                </>
                            )}
                        </section>
                    )}

                    {!isLoading && activeTab === "users" && (
                        <section className="admin-panel">
                            <div className="admin-panel-heading"><div><h2>Community accounts</h2><p>Manage user access and administrator roles.</p></div><span className="admin-total-badge">{users.length} total</span></div>
                            <div className="admin-user-filters"><label className="admin-search"><Search size={16} /><input value={userQuery} onChange={(event) => setUserQuery(event.target.value)} placeholder="Search users" aria-label="Search users" /></label><label>Status<select value={userStatusFilter} onChange={(event) => setUserStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="banned">Banned</option></select></label></div>
                            {filteredUsers.length ? (
                                <div className="admin-table-wrap">
                                    <table className="admin-table">
                                        <thead><tr><th>User</th><th>Joined</th><th>Role</th><th>Status</th><th><span className="visually-hidden">Actions</span></th></tr></thead>
                                        <tbody>{filteredUsers.map((user) => (
                                            <tr key={user.id}>
                                                <td><div className="admin-user-cell"><span className="admin-avatar">{user.name.charAt(0).toUpperCase()}</span><span><strong>{user.name}</strong><small>{user.email}</small></span></div></td>
                                                <td>{formatDate(user.createdAt)}</td>
                                                <td><span className={`admin-role-badge${user.role === "admin" ? " is-admin" : ""}`}>{user.role === "admin" && <ShieldCheck size={13} />} {user.role === "admin" ? "Admin" : "User"}</span></td>
                                                <td><span className={`admin-status-badge is-${user.status || "active"}`}><span />{user.status || "active"}</span></td>
                                                <td className="admin-actions-cell">
                                                    <label className="admin-role-select"><span className="visually-hidden">Change role for {user.name}</span><select value={user.role} disabled={user.isSystemAdmin} onChange={(event) => updateRole(user, event.target.value)}><option value="reader">User</option><option value="admin">Admin</option></select><ChevronDown size={14} /></label>
                                                    <label className="admin-role-select"><span className="visually-hidden">Change status for {user.name}</span><select value={user.status || "active"} disabled={user.isSystemAdmin} onChange={(event) => updateUserStatus(user, event.target.value)}><option value="active">Active</option><option value="suspended">Suspend</option><option value="banned">Ban</option></select><ChevronDown size={14} /></label>
                                                    {!user.isSystemAdmin && <button className="admin-icon-button is-danger" type="button" onClick={() => deleteUser(user)} aria-label={`Delete ${user.name}`}><Trash2 size={16} /></button>}
                                                </td>
                                            </tr>
                                        ))}</tbody>
                                    </table>
                                </div>
                            ) : <EmptyState title="No users found" copy={users.length ? "Try a different search or status filter." : "User accounts will appear here after they sign up."} />}
                        </section>
                    )}
                    {!isLoading && activeTab === "categories" && <AdminTaxonomy onCategoriesChange={setCategoryOptions} />}
                    {!isLoading && activeTab === "comments" && <AdminComments />}
                    {!isLoading && activeTab === "subscribers" && <AdminNewsletter />}
                    {!isLoading && activeTab === "analytics" && <AdminAnalytics />}
                    {!isLoading && activeTab === "media" && <AdminMedia />}
                    {!isLoading && activeTab === "pages" && <AdminPages />}
                    {!isLoading && activeTab === "settings" && <AdminSettings />}
                    {!isLoading && !["overview", "stories", "drafts", "users", "categories", "comments", "subscribers", "analytics", "media", "pages", "settings"].includes(activeTab) && (
                        <section className="admin-panel admin-module-placeholder">
                            <span className="admin-stat-icon admin-stat-icon-warm"><FileText size={19} /></span>
                            <h2>{activeTab === "drafts" ? "Drafts" : activeTab === "subscribers" ? "Subscribers & Newsletter" : activeTab === "pages" ? "Pages & Navigation" : activeTab === "media" ? "Media Library" : activeTab === "categories" ? "Categories & Tags" : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h2>
                            <p>This area is part of the dashboard plan. Its module will be built after the current checkpoint.</p>
                        </section>
                    )}
                </div>
        </AdminLayout>
    );
};

function StatCard({ icon: Icon, label, value, foot, tone }) {
    return (
        <article className="admin-stat-card">
            <span className={`admin-stat-icon admin-stat-icon-${tone}`}><Icon size={19} /></span>
            <span className="admin-stat-label">{label}</span>
            <strong>{value.toLocaleString()}</strong>
            <span className="admin-stat-foot">{foot}</span>
        </article>
    );
}

function BarChart({ values, label }) {
    if (!values.length) return <EmptyState title="No chart data yet" copy="Views will be plotted here as activity is recorded." />;
    const max = Math.max(...values.map(([, value]) => value), 1);
    return (
        <div className="admin-bar-chart" role="img" aria-label={`${label} for the last ${values.length} days`}>
            {values.map(([day, value]) => (
                <div className="admin-bar-column" key={day} title={`${day}: ${value} views`}>
                    <span className="admin-bar-value">{value || ""}</span>
                    <span className="admin-bar-track"><span className="admin-bar-fill" style={{ height: `${Math.max(value / max * 100, 2)}%` }} /></span>
                    <span className="admin-bar-label">{day.slice(5)}</span>
                </div>
            ))}
        </div>
    );
}

function GrowthChart({ values }) {
    if (!values.length) return <EmptyState title="No growth data yet" copy="User and subscriber sign-ups will appear here." />;
    const max = Math.max(...values.map(([, counts]) => counts.users + counts.subscribers), 1);
    return (
        <div className="admin-growth-chart" role="img" aria-label="Daily user and subscriber growth">
            <div className="admin-chart-legend"><span><i className="is-users" />Users</span><span><i className="is-subscribers" />Subscribers</span></div>
            <div className="admin-growth-bars">
                {values.map(([day, counts]) => (
                    <div className="admin-growth-column" key={day} title={`${day}: ${counts.users} users, ${counts.subscribers} subscribers`}>
                        <span className="admin-growth-stack" style={{ height: `${Math.max((counts.users + counts.subscribers) / max * 100, 2)}%` }}>
                            <i className="is-users" style={{ flexGrow: counts.users }} />
                            <i className="is-subscribers" style={{ flexGrow: counts.subscribers }} />
                        </span>
                        <small>{day.slice(5)}</small>
                    </div>
                ))}
            </div>
        </div>
    );
}

function toLocalDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
}

function MarkdownPreview({ body }) {
    return <RichText body={body} className="admin-markdown-preview" />;
}

function StoryTable({ blogs, onEdit, onDelete, selectedPosts = [], onTogglePost, onTogglePage }) {
    return (
        <div className="admin-table-wrap">
            <table className="admin-table">
                <thead><tr>{onTogglePost && <th><input type="checkbox" aria-label="Select all posts on this page" checked={blogs.length > 0 && blogs.every((blog) => selectedPosts.includes(blog.id))} onChange={() => onTogglePage(blogs)} /></th>}<th>Post</th><th>Category</th><th>Updated</th><th>Status</th><th><span className="visually-hidden">Actions</span></th></tr></thead>
                <tbody>{blogs.map((blog) => (
                    <tr key={blog.id}>
                        {onTogglePost && <td><input type="checkbox" checked={selectedPosts.includes(blog.id)} aria-label={`Select ${blog.title}`} onChange={() => onTogglePost(blog.id)} /></td>}
                        <td><div className="admin-story-cell"><strong>{blog.title}</strong><small>By {blog.author}</small></div></td>
                        <td>{blog.category}</td>
                        <td>{formatDate(blog.updatedAt)}</td>
                        <td><span className={`admin-status-badge is-${getPostStatus(blog)}`}><span />{getPostStatus(blog).charAt(0).toUpperCase() + getPostStatus(blog).slice(1)}</span></td>
                        <td className="admin-actions-cell">
                            {getPostStatus(blog) === "published" && <Link className="admin-icon-button" to={`/blogs/${blog.id}`} target="_blank" rel="noreferrer" aria-label={`Preview ${blog.title}`}><BookOpen size={16} /></Link>}
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
