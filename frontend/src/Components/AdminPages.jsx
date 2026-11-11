import { useEffect, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { apiRequest } from "../api";

const emptyPage = { title: "", slug: "", body: "", status: "draft" };
const slugify = (value) => value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);

function AdminPages() {
    const [pages, setPages] = useState([]);
    const [navigation, setNavigation] = useState([]);
    const [footerLinks, setFooterLinks] = useState([]);
    const [page, setPage] = useState(null);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        let isMounted = true;
        Promise.all([apiRequest("/api/admin/pages"), apiRequest("/api/admin/settings")])
            .then(([pageData, settings]) => {
                if (!isMounted) return;
                setPages(pageData);
                setNavigation(settings.navigation || []);
                setFooterLinks(settings.footerLinks || []);
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

    const updatePage = (field, value) => setPage((current) => {
        const next = { ...current, [field]: value };
        if (field === "title" && (!current.slug || current.slug === slugify(current.title))) next.slug = slugify(value);
        return next;
    });

    const savePage = async (event) => {
        event.preventDefault();
        setIsSaving(true);
        setError("");
        try {
            const saved = await apiRequest(page.id ? `/api/admin/pages/${page.id}` : "/api/admin/pages", {
                method: page.id ? "PATCH" : "POST",
                body: JSON.stringify(page),
            });
            setPages((current) => page.id ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
            setPage(null);
            setNotice("Page saved.");
        } catch (saveError) {
            setError(saveError.message);
        } finally {
            setIsSaving(false);
        }
    };

    const deletePage = async (item) => {
        if (!window.confirm(`Permanently delete “${item.title}”?`)) return;
        try {
            await apiRequest(`/api/admin/pages/${item.id}`, { method: "DELETE" });
            setPages((current) => current.filter((entry) => entry.id !== item.id));
            setNotice("Page deleted.");
        } catch (deleteError) {
            setError(deleteError.message);
        }
    };

    const updateLink = (type, index, field, value) => {
        const setter = type === "navigation" ? setNavigation : setFooterLinks;
        setter((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
    };

    const addLink = (type) => {
        const setter = type === "navigation" ? setNavigation : setFooterLinks;
        setter((current) => [...current, { label: "", href: "/" }]);
    };

    const removeLink = (type, index) => {
        const setter = type === "navigation" ? setNavigation : setFooterLinks;
        setter((current) => current.filter((_item, itemIndex) => itemIndex !== index));
    };

    const saveNavigation = async () => {
        setError("");
        setNotice("");
        try {
            const current = await apiRequest("/api/admin/settings");
            const saved = await apiRequest("/api/admin/settings", {
                method: "PATCH",
                body: JSON.stringify({ ...current, navigation, footerLinks }),
            });
            setNavigation(saved.navigation);
            setFooterLinks(saved.footerLinks);
            setNotice("Navigation links saved.");
        } catch (saveError) {
            setError(saveError.message);
        }
    };

    return (
        <div className="admin-module-stack">
            {notice && <p className="admin-feedback admin-feedback-success" role="status"><Check size={16} />{notice}</p>}
            {error && <p className="admin-feedback admin-feedback-error" role="alert">{error}</p>}
            <section className="admin-panel">
                <div className="admin-panel-heading"><div><h2>{page?.id ? "Edit page" : "Create a page"}</h2><p>Manage static pages such as About, Contact, and Privacy.</p></div><button className="admin-primary-button" type="button" onClick={() => setPage({ ...emptyPage })}><Plus size={16} /> New page</button></div>
                {page && <form className="admin-page-form" onSubmit={savePage}>
                    <label>Title<input value={page.title} onChange={(event) => updatePage("title", event.target.value)} minLength={2} maxLength={120} required /></label>
                    <label>URL slug<input value={page.slug} onChange={(event) => updatePage("slug", slugify(event.target.value))} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={120} required /></label>
                    <label>Page content<textarea value={page.body} onChange={(event) => updatePage("body", event.target.value)} maxLength={100000} rows={10} /></label>
                    <label>Status<select value={page.status} onChange={(event) => updatePage("status", event.target.value)}><option value="draft">Draft</option><option value="published">Published</option></select></label>
                    <div className="admin-editor-actions"><button className="admin-secondary-button" type="button" onClick={() => setPage(null)}>Cancel</button><button className="admin-primary-button" type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save page"}</button></div>
                </form>}
                {isLoading ? <p className="admin-loading" role="status">Loading pages…</p> : pages.length ? <div className="admin-table-wrap"><table className="admin-table">
                    <thead><tr><th>Page</th><th>URL</th><th>Status</th><th><span className="visually-hidden">Actions</span></th></tr></thead>
                    <tbody>{pages.map((item) => <tr key={item.id}><td><strong>{item.title}</strong></td><td><a href={`/pages/${item.slug}`} target="_blank" rel="noreferrer">/pages/{item.slug}</a></td><td>{item.status}</td><td className="admin-actions-cell"><button className="admin-secondary-button" type="button" onClick={() => setPage({ ...item })}>Edit</button><button className="admin-icon-button is-danger" type="button" onClick={() => deletePage(item)} aria-label={`Delete ${item.title}`}><Trash2 size={15} /></button></td></tr>)}</tbody>
                </table></div> : <div className="admin-empty"><h3>No pages yet</h3><p>Create a page and publish it when it’s ready.</p></div>}
            </section>
            <section className="admin-panel">
                <div className="admin-panel-heading"><div><h2>Public navigation</h2><p>Configure header and footer links. Use internal paths such as /about or /pages/privacy.</p></div><button className="admin-primary-button" type="button" onClick={saveNavigation}>Save links</button></div>
                <div className="admin-navigation-editors">
                    <NavigationList title="Header links" links={navigation} onAdd={() => addLink("navigation")} onChange={(index, field, value) => updateLink("navigation", index, field, value)} onRemove={(index) => removeLink("navigation", index)} />
                    <NavigationList title="Footer links" links={footerLinks} onAdd={() => addLink("footerLinks")} onChange={(index, field, value) => updateLink("footerLinks", index, field, value)} onRemove={(index) => removeLink("footerLinks", index)} />
                </div>
            </section>
        </div>
    );
}

function NavigationList({ title, links, onAdd, onChange, onRemove }) {
    return (
        <section className="admin-navigation-list">
            <div className="admin-panel-heading"><div><h3>{title}</h3><p>{links.length} links</p></div><button className="admin-secondary-button" type="button" onClick={onAdd}><Plus size={15} /> Add link</button></div>
            {links.map((link, index) => <div className="admin-navigation-row" key={`${title}-${index}`}>
                <label>Label<input value={link.label} onChange={(event) => onChange(index, "label", event.target.value)} maxLength={60} placeholder="About" /></label>
                <label>Destination<input value={link.href} onChange={(event) => onChange(index, "href", event.target.value)} maxLength={300} placeholder="/about" /></label>
                <button className="admin-icon-button is-danger" type="button" onClick={() => onRemove(index)} aria-label={`Remove ${link.label || "link"}`}><Trash2 size={15} /></button>
            </div>)}
        </section>
    );
}

export default AdminPages;
