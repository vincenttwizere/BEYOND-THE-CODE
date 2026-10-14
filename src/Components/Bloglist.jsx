import { ArrowRight, Clock3 } from "lucide-react";
import { Link } from "react-router-dom";
import categories from "../data/categories";

const getExcerpt = (body, maxLength = 155) => {
    if (body.length <= maxLength) {
        return body;
    }

    const excerpt = body.slice(0, maxLength);
    const lastSpace = excerpt.lastIndexOf(" ");
    return `${excerpt.slice(0, lastSpace)}…`;
};

const getReadingTime = (body) => Math.max(1, Math.ceil(body.trim().split(/\s+/).length / 200));

const BlogList = ({ blogs, title }) => (
    <section className="blog-list" aria-labelledby="blog-list-heading">
        <header className="blog-list-header">
            <div>
                <p className="blog-list-eyebrow">The journal</p>
                <h2 id="blog-list-heading">{title}</h2>
            </div>
            <p className="blog-list-count">
                {String(blogs.length).padStart(2, "0")} {blogs.length === 1 ? "story" : "stories"}
            </p>
        </header>

        {blogs.length > 0 ? (
            <div className="blog-grid">
                {blogs.map((blog, index) => {
                    const category = categories.find((item) => item.name === blog.category);
                    const cover = category || categories[index % categories.length];
                    const readingTime = getReadingTime(blog.body);

                    return (
                        <article className="blog-preview" key={blog.id}>
                            <Link
                                className="blog-preview-image-link"
                                to={`/blogs/${blog.id}`}
                                aria-label={`Read ${blog.title}`}
                            >
                                <img
                                    className="blog-preview-image"
                                    src={cover.image}
                                    alt={cover.imageAlt}
                                    loading="lazy"
                                />
                                <span className="blog-preview-image-label">{blog.category || "Featured story"}</span>
                            </Link>

                            <div className="blog-preview-content">
                                <div className="blog-preview-meta">
                                    <span className="blog-preview-author">
                                        <span className="blog-preview-author-mark" aria-hidden="true">
                                            {blog.author?.charAt(0).toUpperCase()}
                                        </span>
                                        By                                         <strong>{blog.author || "Guest author"}</strong>
                                    </span>
                                    <span className="blog-preview-reading-time">
                                        <Clock3 size={14} aria-hidden="true" />
                                        {readingTime} min read
                                    </span>
                                </div>

                                <h3>
                                    <Link to={`/blogs/${blog.id}`}>{blog.title}</Link>
                                </h3>
                                <p className="blog-preview-excerpt">{getExcerpt(blog.body)}</p>
                                <Link className="blog-preview-read-link" to={`/blogs/${blog.id}`}>
                                    Read the story
                                    <ArrowRight size={16} aria-hidden="true" />
                                </Link>
                            </div>
                        </article>
                    );
                })}
            </div>
        ) : (
            <p className="blog-list-empty">No stories have been published yet. Check back soon.</p>
        )}
    </section>
);

export default BlogList;
