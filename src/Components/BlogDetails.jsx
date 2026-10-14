import { Link, useParams } from "react-router-dom";
import useFetch from "../useFetch";
import categories from "../data/categories";
const BlogDetails = () => {

    const { id } = useParams();
    const { data: blog, isPending, error } = useFetch('http://localhost:8000/blogs/' + id);
    const category = blog && categories.find((item) => item.name === blog.category);
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
                    </header>
                    <div className="article-divider" aria-hidden="true" />
                    <div className="article-body">{blog.body}</div>
                </article>
            )}
            </div>
        </div>
    );
}
 
export default BlogDetails;