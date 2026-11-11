import { Link, useParams } from "react-router-dom";
import useFetch from "../useFetch";
import RichText from "./RichText";

function StaticPage() {
    const { slug } = useParams();
    const { data: page, isPending, error } = useFetch(`/api/pages/${slug}`);

    return (
        <main className="editorial-page">
            <div className="editorial-page-shell">
                <Link className="editorial-back-link" to="/">← Back to BEYOND</Link>
                {isPending && <p className="editorial-notice" role="status">Loading page…</p>}
                {error && <p className="editorial-form-error" role="alert">{error}</p>}
                {page && <article className="article-card">
                    <header className="article-header"><p className="article-eyebrow">BEYOND &lt;/&gt;</p><h1>{page.title}</h1></header>
                    <div className="article-divider" />
                    <RichText body={page.body} className="article-body" />
                </article>}
            </div>
        </main>
    );
}

export default StaticPage;
