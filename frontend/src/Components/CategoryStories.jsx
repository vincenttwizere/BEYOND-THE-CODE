import { Link, useParams } from "react-router-dom";
import useFetch from "../useFetch";
import categories from "../data/categories";
import BlogList from "./Bloglist";

const CategoryStories = () => {
    const { slug } = useParams();
    const { data: categoryData, isPending: categoriesPending, error: categoriesError } = useFetch("/api/categories");
    const storedCategory = categoryData?.find((item) => item.slug === slug);
    const category = storedCategory
        ? { ...categories.find((item) => item.name === storedCategory.name), ...storedCategory, heading: categories.find((item) => item.name === storedCategory.name)?.heading || storedCategory.name, description: categories.find((item) => item.name === storedCategory.name)?.description || `Stories filed under ${storedCategory.name}.` }
        : null;
    const { data: blogs, isPending, error } = useFetch("/api/blogs");

    if (categoriesPending) {
        return <main className="editorial-page"><div className="editorial-page-shell editorial-notice" role="status">Loading category…</div></main>;
    }

    if (!category) {
        return (
            <main className="editorial-page">
                <div className="editorial-page-shell editorial-not-found">
                    <p className="editorial-eyebrow">{categoriesError || "Category not found"}</p>
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
