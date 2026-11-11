import { useEffect, useState } from "react";
import { Check, Copy, FileImage, Grid2X2, List, Trash2, Upload } from "lucide-react";
import { apiRequest } from "../api";

async function uploadMedia(file) {
    const response = await fetch("/api/admin/media", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": file.type, "X-Alt-Text": "" },
        body: file,
    });
    const body = await response.text();
    let payload = {};
    if (body) {
        try {
            payload = JSON.parse(body);
        } catch {
            throw new Error("The server returned an invalid response.");
        }
    }
    if (!response.ok) throw new Error(payload.error || "The image could not be uploaded.");
    return payload;
}

function AdminMedia() {
    const [items, setItems] = useState([]);
    const [view, setView] = useState("grid");
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        let isMounted = true;
        apiRequest("/api/admin/media")
            .then((result) => {
                if (isMounted) setItems(result);
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

    const addFiles = async (files) => {
        const selectedFiles = [...files];
        if (!selectedFiles.length) return;
        const invalid = selectedFiles.find((file) => !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type) || file.size > 5 * 1024 * 1024);
        if (invalid) {
            setError(`${invalid.name}: use JPEG, PNG, WebP, or GIF files up to 5 MB.`);
            return;
        }
        setError("");
        setIsUploading(true);
        try {
            const uploaded = await Promise.all(selectedFiles.map(uploadMedia));
            setItems((current) => [...uploaded, ...current]);
            setNotice(`${uploaded.length} image${uploaded.length === 1 ? "" : "s"} uploaded.`);
        } catch (uploadError) {
            setError(uploadError.message);
        } finally {
            setIsUploading(false);
        }
    };

    const updateAltText = async (item, altText) => {
        setError("");
        try {
            const updated = await apiRequest(`/api/admin/media/${item.id}`, {
                method: "PATCH",
                body: JSON.stringify({ altText }),
            });
            setItems((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
            setNotice("Alt text saved.");
        } catch (updateError) {
            setError(updateError.message);
        }
    };

    const copyUrl = async (item) => {
        try {
            await navigator.clipboard.writeText(new URL(item.url, window.location.origin).href);
            setNotice("Image URL copied.");
        } catch (copyError) {
            setError(`Could not copy the image URL: ${copyError.message}`);
        }
    };

    const deleteItem = async (item) => {
        if (!window.confirm("Permanently delete this image? Posts using it may no longer display it.")) return;
        try {
            await apiRequest(`/api/admin/media/${item.id}`, { method: "DELETE" });
            setItems((current) => current.filter((entry) => entry.id !== item.id));
            setNotice("Image deleted.");
        } catch (deleteError) {
            setError(deleteError.message);
        }
    };

    return (
        <div className="admin-module-stack">
            {notice && <p className="admin-feedback admin-feedback-success" role="status"><Check size={16} />{notice}</p>}
            {error && <p className="admin-feedback admin-feedback-error" role="alert">{error}</p>}
            <section className="admin-panel">
                <div className="admin-panel-heading">
                    <div><h2>Upload media</h2><p>JPEG, PNG, WebP, or GIF · up to 5 MB each</p></div>
                    <div className="admin-media-view-toggle" role="group" aria-label="Media view">
                        <button className={view === "grid" ? "is-active" : ""} type="button" onClick={() => setView("grid")} aria-label="Grid view"><Grid2X2 size={16} /></button>
                        <button className={view === "list" ? "is-active" : ""} type="button" onClick={() => setView("list")} aria-label="List view"><List size={16} /></button>
                    </div>
                </div>
                <label
                    className={`admin-media-dropzone${isUploading ? " is-uploading" : ""}`}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer.files); }}
                >
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple disabled={isUploading} onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} />
                    <span><Upload size={20} /></span>
                    <strong>{isUploading ? "Uploading images…" : "Drop images here or choose files"}</strong>
                    <small>Images are stored by the existing API server.</small>
                </label>
            </section>
            <section className={`admin-panel admin-media-library is-${view}`}>
                <div className="admin-panel-heading"><div><h2>Media library</h2><p>{items.length} image{items.length === 1 ? "" : "s"}</p></div></div>
                {isLoading ? <p className="admin-loading" role="status">Loading media…</p> : items.length ? (
                    <div className="admin-media-items">
                        {items.map((item) => <MediaItem key={item.id} item={item} onSaveAlt={updateAltText} onCopy={copyUrl} onDelete={deleteItem} />)}
                    </div>
                ) : <div className="admin-empty"><span><FileImage size={22} /></span><h3>Your media library is empty</h3><p>Upload an image to use it in a post.</p></div>}
            </section>
        </div>
    );
}

function MediaItem({ item, onSaveAlt, onCopy, onDelete }) {
    const [altText, setAltText] = useState(item.altText || "");
    return (
        <article className="admin-media-item">
            <img src={item.url} alt={item.altText || ""} />
            <div className="admin-media-info">
                <strong>{item.filename}</strong>
                <small>{(item.size / 1024).toFixed(0)} KB · {new Date(item.createdAt).toLocaleDateString()}</small>
                <label>Alt text<input value={altText} onChange={(event) => setAltText(event.target.value)} maxLength={300} placeholder="Describe this image" /></label>
                <div className="admin-media-actions">
                    <button className="admin-secondary-button" type="button" onClick={() => onSaveAlt(item, altText)}>Save alt text</button>
                    <button className="admin-icon-button" type="button" onClick={() => onCopy(item)} aria-label={`Copy URL for ${item.filename}`}><Copy size={15} /></button>
                    <button className="admin-icon-button is-danger" type="button" onClick={() => onDelete(item)} aria-label={`Delete ${item.filename}`}><Trash2 size={15} /></button>
                </div>
            </div>
        </article>
    );
}

export default AdminMedia;
