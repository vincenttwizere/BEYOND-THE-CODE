import "../index.css";
import { Link, NavLink } from "react-router-dom";
import { Search } from "lucide-react";

const Navbar = () => {

    return (
        <nav className="navbar">
            <Link className="navbar-brand" to="/" aria-label="X-Blog home">X-BLOG</Link>
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
            </div>
        </nav>
    );
};

export default Navbar;