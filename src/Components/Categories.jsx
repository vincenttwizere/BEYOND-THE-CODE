import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import useFetch from "../useFetch";
import { featuredCategories } from "../data/categories";

const Categories = () => {
    const { data: blogs, isPending, error } = useFetch("http://localhost:8000/blogs");

    return (
        <main className="editorial-page">
            <div className="editorial-page-shell">
                <header className="editorial-page-heading">
                    <p className="editorial-eyebrow">Find your next read</p>
                    <h1>Explore by category</h1>
                    <p>Explore stories through these three featured categories.</p>
                </header>
                {isPending && <div className="editorial-notice" role="status">Loading categories…</div>}
                {error && <div className="editorial-notice editorial-notice-error" role="alert">{error}</div>}
                <div className="category-grid">
                    {featuredCategories.map((category, index) => {
                        const count = blogs?.filter((blog) => blog.category === category.name).length;
                        return (
                            <Link className="category-card" to={`/categories/${category.slug}`} key={category.slug}>
                                <img src={category.image} alt={category.imageAlt} loading="lazy" />
                                <span className="category-card-number">{String(index + 1).padStart(2, "0")}</span>
                                <span className="category-card-overlay" />
                                <span className="category-card-content">
                                    <span className="category-card-name">{category.name}</span>
                                    <span className="category-card-title">{category.heading}</span>
                                    <span className="category-card-footer">
                                        {count == null ? "Explore stories" : `${count} ${count === 1 ? "story" : "stories"}`}
                                        <ArrowRight size={16} aria-hidden="true" />
                                    </span>
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </main>
    );
};

export default Categories;
