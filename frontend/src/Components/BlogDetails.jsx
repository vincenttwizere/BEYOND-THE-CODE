import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Bookmark, BookmarkCheck, Heart, Share2 } from "lucide-react";
import useFetch from "../useFetch";
import categories from "../data/categories";
import { useAuth } from "../useAuth";
import { apiRequest } from "../api";
import "../comments.css";
import RichText from "./RichText";
const BlogDetails = () => {

    const { id } = useParams();
    const { data: blog, isPending, error } = useFetch('/api/blogs/' + id);
    const { user } = useAuth();
    const [comments, setComments] = useState([]);
    const [myComments, setMyComments] = useState([]);
    const [commentBody, setCommentBody] = useState("");
    const [commentNotice, setCommentNotice] = useState("");
    const [commentError, setCommentError] = useState("");
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [saveError, setSaveError] = useState("");
    const [likeState, setLikeState] = useState({ count: 0, isLiked: false });
    const [isUpdatingLike, setIsUpdatingLike] = useState(false);
    const [likeError, setLikeError] = useState("");
    const [shareNotice, setShareNotice] = useState("");
    const [shareError, setShareError] = useState("");
    const category = blog && categories.find((item) => item.name === blog.category);

    useEffect(() => {
        if (!blog) return undefined;
        const previousTitle = document.title;
        document.title = blog.metaTitle || `${blog.title} · BEYOND </>`;
        let description = document.querySelector('meta[name="description"]');
        if (!description) {
            description = document.createElement("meta");
            description.name = "description";
            document.head.append(description);
        }
        const previousDescription = description.content;
        description.content = blog.metaDescription || blog.excerpt || "";
        let image = document.querySelector('meta[property="og:image"]');
        if (!image) {
            image = document.createElement("meta");
            image.setAttribute("property", "og:image");
            document.head.append(image);
        }
        const previousImage = image.content;
        image.content = blog.ogImage || blog.featuredImage || "";
        return () => {
            document.title = previousTitle;
            description.content = previousDescription;
            image.content = previousImage;
        };
    }, [blog]);

    useEffect(() => {
        let isMounted = true;
        Promise.all([
            apiRequest(`/api/blogs/${id}/comments`),
            user ? apiRequest("/api/me/comments") : Promise.resolve([]),
            user ? apiRequest("/api/me/saved-posts") : Promise.resolve([]),
            user ? apiRequest(`/api/blogs/${id}/likes`) : Promise.resolve({ count: 0, isLiked: false }),
        ])
            .then(([publicComments, ownComments, savedPosts, postLikes]) => {
                if (!isMounted) return;
                setComments(publicComments);
                setMyComments(ownComments.filter((comment) => String(comment.postId) === String(id)));
                setIsSaved(savedPosts.some((post) => String(post.id) === String(id)));
                setLikeState(postLikes);
            })
            .catch((loadError) => {
                if (isMounted) setCommentError(loadError.message);
            });
        return () => {
            isMounted = false;
        };
    }, [id, user]);

    const submitComment = async (event) => {
        event.preventDefault();
        setIsSubmittingComment(true);
        setCommentError("");
        setCommentNotice("");
        try {
            const result = await apiRequest(`/api/blogs/${id}/comments`, {
                method: "POST",
                body: JSON.stringify({ body: commentBody }),
            });
            setMyComments((current) => [{ ...result, postId: id, body: commentBody, name: user.name }, ...current]);
            setCommentBody("");
            setCommentNotice("Your comment was submitted and is waiting for review.");
        } catch (submitError) {
            setCommentError(submitError.message);
        } finally {
            setIsSubmittingComment(false);
        }
    };

    const deleteOwnComment = async (comment) => {
        if (!window.confirm("Delete your comment?")) return;
        setCommentError("");
        try {
            await apiRequest(`/api/me/comments/${comment.id}`, { method: "DELETE" });
            setMyComments((current) => current.filter((item) => item.id !== comment.id));
            setComments((current) => current.filter((item) => item.id !== comment.id));
        } catch (deleteError) {
            setCommentError(deleteError.message);
        }
    };

    const toggleSavePost = async () => {
        setSaveError("");
        try {
            await apiRequest(`/api/me/saved-posts/${id}`, { method: isSaved ? "DELETE" : "POST" });
            setIsSaved((current) => !current);
        } catch (saveErrorValue) {
            setSaveError(saveErrorValue.message);
        }
    };

    const toggleLike = async () => {
        setIsUpdatingLike(true);
        setLikeError("");
        try {
            const result = await apiRequest(`/api/me/liked-posts/${id}`, {
                method: likeState.isLiked ? "DELETE" : "POST",
            });
            setLikeState(result);
        } catch (likeErrorValue) {
            setLikeError(likeErrorValue.message);
        } finally {
            setIsUpdatingLike(false);
        }
    };

    const sharePost = async () => {
        setShareNotice("");
        setShareError("");
        const shareData = { title: blog.title, url: window.location.href };
        try {
            if (navigator.share) {
                await navigator.share(shareData);
                setShareNotice("Story shared.");
            } else if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(shareData.url);
                setShareNotice("Story link copied.");
            } else {
                throw new Error("Sharing is not available in this browser.");
            }
        } catch (shareErrorValue) {
            if (shareErrorValue.name !== "AbortError") setShareError(shareErrorValue.message);
        }
    };

    return (  
        <div className="blog-details">
            <div className="article-shell">
                <Link className="article-back-link" to="/">
                    <span aria-hidden="true">←</span>
                    Back to all stories
                </Link>
                {isPending && (
                    <div className="article-status" role="status">
                        <span className="article-status-label">Loading story</span>
                        <span className="article-loading-line" aria-hidden="true" />
                    </div>
                )}
                {error && (
                    <div className="article-status article-status-error" role="alert">
                        <span className="article-status-label">Story unavailable</span>
                        <p>{error}</p>
                    </div>
                )}
            {blog && (
                <article className="article-card">
                {category && (
                    <img className="article-cover" src={category.image} alt={category.imageAlt} />
                )}
                <header className="article-header">
                    <p className="article-eyebrow">{blog.category || "From the journal"}</p>
                        <h1>{blog.title}</h1>
                        <div className="article-byline">
                            <span className="article-author-mark" aria-hidden="true">
                                {blog.author?.charAt(0).toUpperCase()}
                            </span>
                            <p>Written by <strong>{blog.author}</strong></p>
                        </div>
                        {user && <div className="article-social-actions">
                            <div className="article-like-action">
                                <button type="button" onClick={toggleLike} disabled={isUpdatingLike} aria-pressed={likeState.isLiked}>
                                    <Heart size={16} fill={likeState.isLiked ? "currentColor" : "none"} />
                                    {likeState.isLiked ? "Liked" : "Like"} <span>{likeState.count}</span>
                                </button>
                                {likeError && <p role="alert">{likeError}</p>}
                            </div>
                            <div className="article-share-action">
                                <button type="button" onClick={sharePost}><Share2 size={16} />Share</button>
                                {shareNotice && <p role="status">{shareNotice}</p>}
                                {shareError && <p role="alert">{shareError}</p>}
                            </div>
                        </div>}
                        {user && <div className="article-save-action"><button type="button" onClick={toggleSavePost} aria-pressed={isSaved}>{isSaved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}{isSaved ? "Saved" : "Save post"}</button>{saveError && <p role="alert">{saveError}</p>}</div>}
                    </header>
                    <div className="article-divider" aria-hidden="true" />
                    <RichText body={blog.body} className="article-body" />
                    <section className="article-comments" aria-labelledby="comments-heading">
                        <header><p className="article-eyebrow">Community</p><h2 id="comments-heading">Conversation</h2></header>
                        {comments.length ? <div className="article-comment-list">{comments.map((comment) => (
                            <article className="article-comment" key={comment.id}>
                                <div><strong>{comment.name}</strong><time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleDateString()}</time></div>
                                <p>{comment.body}</p>
                                {comment.reply && <aside><strong>BEYOND team</strong><p>{comment.reply}</p></aside>}
                            </article>
                        ))}</div> : <p className="article-comments-empty">No approved comments yet. Be the first to join the conversation.</p>}
                        {user ? (
                            <form className="article-comment-form" onSubmit={submitComment}>
                                <label htmlFor="article-comment-input">Add a comment</label>
                                <textarea id="article-comment-input" value={commentBody} onChange={(event) => setCommentBody(event.target.value)} minLength={3} maxLength={2000} rows={4} required placeholder="Share a thoughtful response…" />
                                {commentNotice && <p role="status">{commentNotice}</p>}
                                {commentError && <p role="alert">{commentError}</p>}
                                <button type="submit" disabled={isSubmittingComment}>{isSubmittingComment ? "Submitting…" : "Submit for review"}</button>
                            </form>
                        ) : <p className="article-comments-empty"><Link to="/login">Sign in</Link> to leave a comment.</p>}
                        {myComments.length > 0 && (
                            <div className="article-own-comments">
                                <h3>Your comments</h3>
                                {myComments.map((comment) => <article key={comment.id}><p>{comment.body}</p><span>Status: {comment.status}</span><button type="button" onClick={() => deleteOwnComment(comment)}>Delete</button></article>)}
                            </div>
                        )}
                    </section>
                </article>
            )}
            </div>
        </div>
    );
}
 
export default BlogDetails;