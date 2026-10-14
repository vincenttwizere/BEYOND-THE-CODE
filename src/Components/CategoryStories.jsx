import { Link, useParams } from "react-router-dom";
import useFetch from "../useFetch";
import categories from "../data/categories";
import BlogList from "./Bloglist";

const CategoryStories = () => {
    const { slug } = useParams();
    const category = categories.find((item) => item.slug === slug);
    const { data: blogs, isPending, error } = useFetch("http://localhost:8000/blogs");

    if (!category) {
        return (
            <main className="editorial-page">
                <div className="editorial-page-shell editorial-not-found">
                    <p className="editorial-eyebrow">Category not found</p>
                    <h1>That collection isn’t here.</h1>
                    <Link className="editorial-text-link" to="/categories">Browse all categories <span aria-hidden="true">→</span></Link>
                </div>
            </main>
        );
    }

    const categoryBlogs = blogs?.filter((blog) => blog.category === category.name) || [];

    return (
        <main className="editorial-page">
            <div className="editorial-page-shell">
                <Link className="editorial-back-link" to="/categories">← All categories</Link>
                <header className="editorial-page-heading">
                    <p className="editorial-eyebrow">{category.name}</p>
                    <h1>{category.heading}</h1>
                    <p>{category.description}</p>
                </header>
                {isPending && <div className="editorial-notice" role="status">Loading stories…</div>}
                {error && <div className="editorial-notice editorial-notice-error" role="alert">{error}</div>}
                {blogs && <BlogList blogs={categoryBlogs} title={`Stories in ${category.name}`} />}
            </div>
        </main>
    );
};

export default CategoryStories;
