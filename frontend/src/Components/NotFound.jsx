import { Link } from "react-router-dom";

const NotFound = () => (
    <main className="editorial-page">
        <div className="editorial-page-shell editorial-not-found">
            <p className="editorial-eyebrow">404 · Page not found</p>
            <h1>This story took a wrong turn.</h1>
            <p>The page may have moved, or the address may not be right.</p>
            <Link className="editorial-button" to="/">Return home <span aria-hidden="true">→</span></Link>
        </div>
    </main>
);

export default NotFound;
