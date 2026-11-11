import { useEffect, useState } from "react";
import { Bookmark, Check, Trash2, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api";
import { useAuth } from "../useAuth";

function Profile() {
    const { user, updateProfile } = useAuth();
    const [savedPosts, setSavedPosts] = useState([]);
    const [comments, setComments] = useState([]);
    const [name, setName] = useState(user.name);
    const [password, setPassword] = useState({ currentPassword: "", newPassword: "", confirmation: "" });
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        let isMounted = true;
        Promise.all([apiRequest("/api/me/saved-posts"), apiRequest("/api/me/comments")])
            .then(([posts, ownComments]) => {
                if (!isMounted) return;
                setSavedPosts(posts);
                setComments(ownComments);
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

    const saveProfile = async (event) => {
        event.preventDefault();
        setError("");
        setNotice("");
        if (password.newPassword && password.newPassword !== password.confirmation) {
            setError("New password and confirmation do not match.");
            return;
        }
        setIsSaving(true);
        try {
            await updateProfile({
                name,
                ...(password.newPassword ? { currentPassword: password.currentPassword, newPassword: password.newPassword } : {}),
            });
            setPassword({ currentPassword: "", newPassword: "", confirmation: "" });
            setNotice("Profile updated.");
        } catch (saveError) {
            setError(saveError.message);
        } finally {
            setIsSaving(false);
        }
    };

    const removeSavedPost = async (post) => {
        try {
            await apiRequest(`/api/me/saved-posts/${post.id}`, { method: "DELETE" });
            setSavedPosts((current) => current.filter((item) => item.id !== post.id));
        } catch (removeError) {
            setError(removeError.message);
        }
    };

    const deleteComment = async (comment) => {
        if (!window.confirm("Delete your comment?")) return;
        try {
            await apiRequest(`/api/me/comments/${comment.id}`, { method: "DELETE" });
            setComments((current) => current.filter((item) => item.id !== comment.id));
        } catch (deleteError) {
            setError(deleteError.message);
        }
    };

    return (
        <main className="editorial-page">
            <div className="editorial-page-shell profile-page">
                <header className="editorial-page-heading"><p className="editorial-eyebrow">Your BEYOND account</p><h1>Your profile.</h1><p>Manage your details, saved posts, and comments.</p></header>
                {notice && <p className="editorial-form-success" role="status"><Check size={16} />{notice}</p>}
                {error && <p className="editorial-form-error" role="alert">{error}</p>}
                <section className="profile-card">
                    <h2><UserRound size={18} /> Account details</h2>
                    <form className="editorial-form" onSubmit={saveProfile}>
                        <label>Name<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={80} required /></label>
                        <label>Email<input value={user.email} readOnly aria-readonly="true" /></label>
                        <fieldset>
                            <legend>Change password</legend>
                            <label>Current password<input type="password" autoComplete="current-password" value={password.currentPassword} onChange={(event) => setPassword({ ...password, currentPassword: event.target.value })} required={Boolean(password.newPassword)} /></label>
                            <div className="editorial-form-row">
                                <label>New password<input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={password.newPassword} onChange={(event) => setPassword({ ...password, newPassword: event.target.value })} /></label>
                                <label>Confirm new password<input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={password.confirmation} onChange={(event) => setPassword({ ...password, confirmation: event.target.value })} /></label>
                            </div>
                        </fieldset>
                        <button className="editorial-button" type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save profile"}</button>
                    </form>
                </section>
                <section className="profile-card">
                    <h2><Bookmark size={18} /> Saved posts</h2>
                    {isLoading ? <p role="status">Loading saved posts…</p> : savedPosts.length ? <ul className="profile-list">{savedPosts.map((post) => <li key={post.id}><Link to={`/blogs/${post.id}`}><strong>{post.title}</strong><small>{post.category} · {post.author}</small></Link><button type="button" onClick={() => removeSavedPost(post)}>Remove</button></li>)}</ul> : <p>You haven’t saved any posts yet.</p>}
                </section>
                <section className="profile-card">
                    <h2>My comments</h2>
                    {isLoading ? <p role="status">Loading comments…</p> : comments.length ? <ul className="profile-list">{comments.map((comment) => <li key={comment.id}><div><p>{comment.body}</p><small>Status: {comment.status}</small></div><button type="button" onClick={() => deleteComment(comment)} aria-label="Delete your comment"><Trash2 size={15} /> Delete</button></li>)}</ul> : <p>You haven’t commented on a post yet.</p>}
                </section>
            </div>
        </main>
    );
}

export default Profile;
