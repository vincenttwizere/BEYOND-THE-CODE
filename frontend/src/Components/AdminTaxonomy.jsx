import { useEffect, useState } from "react";
import { Check, Pencil, Plus, Tags, Trash2, X } from "lucide-react";
import { apiRequest } from "../api";

function AdminTaxonomy({ onCategoriesChange }) {
    const [categories, setCategories] = useState([]);
    const [tags, setTags] = useState([]);
    const [form, setForm] = useState({ type: "categories", name: "", id: "" });
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        let isMounted = true;
        Promise.all([
            apiRequest("/api/admin/categories"),
            apiRequest("/api/admin/tags"),
        ])
            .then(([categoryData, tagData]) => {
                if (!isMounted) return;
                setCategories(categoryData);
                setTags(tagData);
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

    const saveItem = async (event) => {
        event.preventDefault();
        setIsSaving(true);
        setError("");
        setNotice("");
        try {
            const base = `/api/admin/${form.type}`;
            const result = await apiRequest(form.id ? `${base}/${form.id}` : base, {
                method: form.id ? "PATCH" : "POST",
                body: JSON.stringify({ name: form.name.trim() }),
            });
            const currentItems = form.type === "categories" ? categories : tags;
            const nextItems = (form.id
                ? currentItems.map((item) => item.id === result.id ? result : item)
                : [...currentItems, result]).sort((left, right) => left.name.localeCompare(right.name));
            (form.type === "categories" ? setCategories : setTags)(nextItems);
            if (form.type === "categories") onCategoriesChange(nextItems);
            setNotice(`${form.type === "categories" ? "Category" : "Tag"} ${form.id ? "updated" : "created"}.`);
            setForm((current) => ({ ...current, id: "", name: "" }));
        } catch (saveError) {
            setError(saveError.message);
        } finally {
            setIsSaving(false);
        }
    };

    const deleteItem = async (type, item) => {
        if (!window.confirm(`Delete “${item.name}”? This cannot be undone.`)) return;
        setError("");
        setNotice("");
        try {
            await apiRequest(`/api/admin/${type}/${item.id}`, { method: "DELETE" });
            const currentItems = type === "categories" ? categories : tags;
            const nextItems = currentItems.filter((entry) => entry.id !== item.id);
            (type === "categories" ? setCategories : setTags)(nextItems);
            if (type === "categories") onCategoriesChange(nextItems);
            setNotice(`${type === "categories" ? "Category" : "Tag"} deleted.`);
        } catch (deleteError) {
            setError(deleteError.message);
        }
    };

    const startEdit = (type, item) => setForm({ type, name: item.name, id: item.id });

    return (
        <div className="admin-module-stack">
            {notice && <p className="admin-feedback admin-feedback-success" role="status"><Check size={16} />{notice}<button type="button" onClick={() => setNotice("")} aria-label="Dismiss message"><X size={15} /></button></p>}
            {error && <p className="admin-feedback admin-feedback-error" role="alert">{error}</p>}
            <section className="admin-panel admin-taxonomy-panel">
                <div className="admin-panel-heading"><div><h2>{form.type === "categories" ? "Categories" : "Tags"}</h2><p>{form.id ? "Edit the selected item." : "Create a category or tag."}</p></div><Tags size={20} aria-hidden="true" /></div>
                <form className="admin-taxonomy-form" onSubmit={saveItem}>
                    <label>Type<select value={form.type} onChange={(event) => setForm({ type: event.target.value, name: "", id: "" })}><option value="categories">Category</option><option value="tags">Tag</option></select></label>
                    <label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} minLength={2} maxLength={60} required placeholder={form.type === "categories" ? "e.g. Engineering" : "e.g. accessibility"} /></label>
                    <button className="admin-primary-button" type="submit" disabled={isSaving}>{form.id ? <Pencil size={15} /> : <Plus size={16} />}{isSaving ? "Saving…" : form.id ? "Save changes" : "Add item"}</button>
                    {form.id && <button className="admin-secondary-button" type="button" onClick={() => setForm((current) => ({ ...current, id: "", name: "" }))}>Cancel</button>}
                </form>
            </section>
            <div className="admin-overview-grid">
                <TaxonomyTable title="Categories" items={categories} isLoading={isLoading} onEdit={(item) => startEdit("categories", item)} onDelete={(item) => deleteItem("categories", item)} />
                <TaxonomyTable title="Tags" items={tags} isLoading={isLoading} onEdit={(item) => startEdit("tags", item)} onDelete={(item) => deleteItem("tags", item)} />
            </div>
        </div>
    );
}

function TaxonomyTable({ title, items, isLoading, onEdit, onDelete }) {
    return (
        <section className="admin-panel admin-taxonomy-list">
            <div className="admin-panel-heading"><div><h2>{title}</h2><p>{items.length} total</p></div></div>
            {isLoading ? <p className="admin-loading" role="status">Loading {title.toLowerCase()}…</p> : items.length ? (
                <div className="admin-table-wrap">
                    <table className="admin-table">
                        <thead><tr><th>Name</th><th>Posts</th><th><span className="visually-hidden">Actions</span></th></tr></thead>
                        <tbody>{items.map((item) => (
                            <tr key={item.id}>
                                <td><div className="admin-story-cell"><strong>{item.name}</strong><small>/{item.slug}</small></div></td>
                                <td>{item.postCount}</td>
                                <td className="admin-actions-cell"><button className="admin-icon-button" type="button" onClick={() => onEdit(item)} aria-label={`Edit ${item.name}`}><Pencil size={15} /></button><button className="admin-icon-button is-danger" type="button" onClick={() => onDelete(item)} aria-label={`Delete ${item.name}`}><Trash2 size={15} /></button></td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            ) : <div className="admin-empty"><span><Tags size={22} /></span><h3>No {title.toLowerCase()} yet</h3><p>Add one above to start organizing posts.</p></div>}
        </section>
    );
}

export default AdminTaxonomy;
