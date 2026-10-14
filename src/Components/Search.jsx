import { Search as SearchIcon, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import useFetch from "../useFetch";
import BlogList from "./Bloglist";

const Search = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const query = searchParams.get("q") || "";
    const { data: blogs, isPending, error } = useFetch("http://localhost:8000/blogs");

    const filteredBlogs = blogs?.filter((blog) => {
        const searchableText = `${blog.title} ${blog.body} ${blog.author} ${blog.category || ""}`.toLocaleLowerCase();
        return query.trim() && searchableText.includes(query.trim().toLocaleLowerCase());
    }) || [];

    const handleSubmit = (event) => {
        event.preventDefault();
        const nextQuery = new FormData(event.currentTarget).get("q").trim();
        setSearchParams(nextQuery ? { q: nextQuery } : {});
    };

    return (
        <main className="editorial-page">
            <div className="editorial-page-shell search-shell">
                <header className="editorial-page-heading">
                    <p className="editorial-eyebrow">Find something worth reading</p>
                    <h1>Search the journal</h1>
                    <p>Search story titles, authors, topics, and article text.</p>
                </header>

                <form className="search-form" role="search" onSubmit={handleSubmit}>
                    <SearchIcon size={21} aria-hidden="true" />
                    <label className="visually-hidden" htmlFor="story-search">Search stories</label>
                    <input
                        id="story-search"
                        key={query}
                        name="q"
                        type="search"
                        defaultValue={query}
                        placeholder="Try “web development” or an author name"
                    />
                    {query && (
                        <button
                            className="search-clear"
                            type="button"
                            aria-label="Clear search"
                            onClick={() => {
                                setSearchParams({});
                            }}
                        >
                            <X size={18} aria-hidden="true" />
                        </button>
                    )}
                    <button className="editorial-button" type="submit">Search</button>
                </form>

                {isPending && <div className="editorial-notice" role="status">Searching stories…</div>}
                {error && <div className="editorial-notice editorial-notice-error" role="alert">{error}</div>}
                {blogs && query.trim() && (
                    <BlogList
                        blogs={filteredBlogs}
                        title={`${filteredBlogs.length} ${filteredBlogs.length === 1 ? "result" : "results"} for “${query}”`}
                    />
                )}
                {blogs && !query.trim() && (
                    <div className="search-empty-state">
                        <SearchIcon size={23} aria-hidden="true" />
                        <p>Enter a title, topic, author, or phrase to find a story.</p>
                    </div>
                )}
            </div>
        </main>
    );
};

export default Search;
