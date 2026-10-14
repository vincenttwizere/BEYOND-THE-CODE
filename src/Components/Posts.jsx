import { useState } from "react";
import { Link } from "react-router-dom";
import useFetch from "../useFetch";
import BlogList from "./Bloglist";

const Posts = () => {
    const { data: blogs, isPending, error } = useFetch("http://localhost:8000/blogs");
    const [authorFilter, setAuthorFilter] = useState("all");
    const authors = blogs ? [...new Set(blogs.map((blog) => blog.author).filter(Boolean))] : [];
    const filteredBlogs = blogs?.filter((blog) => authorFilter === "all" || blog.author === authorFilter) || [];

    return (
        <main className="editorial-page">
            <div className="editorial-page-shell">
                <header className="editorial-page-heading">
                    <p className="editorial-eyebrow">The journal</p>
                    <h1>All stories</h1>
                    <p>Ideas, lessons, and perspectives from the X-Blog community.</p>
                </header>

                {blogs && authors.length > 1 && (
                    <div className="editorial-filter-bar">
                        <label htmlFor="posts-author-filter">Written by</label>
                        <select
                            id="posts-author-filter"
                            value={authorFilter}
                            onChange={(event) => setAuthorFilter(event.target.value)}
                        >
                            <option value="all">Everyone</option>
                            {authors.map((author) => <option key={author} value={author}>{author}</option>)}
                        </select>
                        <Link className="editorial-text-link" to="/create">Write a story <span aria-hidden="true">+</span></Link>
                    </div>
                )}

                {isPending && <div className="editorial-notice" role="status">Loading stories…</div>}
                {error && <div className="editorial-notice editorial-notice-error" role="alert">{error}</div>}
                {blogs && <BlogList blogs={filteredBlogs} title={authorFilter === "all" ? "Published stories" : `Stories by ${authorFilter}`} />}
                <div className="editorial-page-cta">
                    <p>Have a story worth sharing?</p>
                    <Link className="editorial-button" to="/create">Write a story <span aria-hidden="true">→</span></Link>
                </div>
            </div>
        </main>
    );
};

export default Posts;
