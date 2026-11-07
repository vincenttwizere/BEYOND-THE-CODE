import "../index.css";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Search } from "lucide-react";
import { useAuth } from "../useAuth";

const Navbar = () => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState("");

    const handleSignOut = async () => {
        setError("");
        try {
            await signOut();
            navigate("/", { replace: true });
        } catch (signOutError) {
            setError(signOutError.message);
        }
    };

    return (
        <nav className="navbar">
            <Link className="navbar-brand" to="/" aria-label="X-Blog home">BEYOND &lt;/&gt;</Link>
            <div className="links">
                <NavLink to="/" end>Home</NavLink>
                <NavLink to="/about">About</NavLink>
                <NavLink to="/posts">Posts</NavLink>
                <NavLink to="/categories">Categories</NavLink>
                <NavLink to="/contact">Contact</NavLink>
                <NavLink to="/search" className="search-link" aria-label="Search stories">
                    <Search size={20} aria-hidden="true" />
                    <span>Search</span>
                </NavLink>
                {user?.role === "admin" && <NavLink to="/admin" className="auth-link">Dashboard</NavLink>}
                {!user && <NavLink to="/login" className="auth-link">Login / Sign up</NavLink>}
                {user && (
                    <>
                        <span className="navbar-user">Hi, {user.name}</span>
                        <button className="navbar-logout" type="button" onClick={handleSignOut}>Log out</button>
                    </>
                )}
            </div>
            {error && <span className="navbar-error" role="alert">{error}</span>}
        </nav>
    );
};

export default Navbar;