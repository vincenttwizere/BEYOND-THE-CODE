import "../index.css";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useAuth } from "../useAuth";
import { apiRequest } from "../api";

const defaultLinks = [
    { label: "Home", href: "/" },
    { label: "About", href: "/about" },
    { label: "Posts", href: "/posts" },
    { label: "Categories", href: "/categories" },
    { label: "Contact", href: "/contact" },
];

const Navbar = () => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState("");
    const [settings, setSettings] = useState(null);

    useEffect(() => {
        let isMounted = true;
        apiRequest("/api/site-settings")
            .then((value) => {
                if (isMounted) {
                    setSettings(value);
                    document.title = value.siteName || "BEYOND </>";
                }
            })
            .catch((loadError) => console.error("Could not load site navigation settings:", loadError))
        return () => {
            isMounted = false;
        };
    }, []);

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
            <Link className="navbar-brand" to="/" aria-label={`${settings?.siteName || "BEYOND </>"} home`}>
                {settings?.logo ? <img src={settings.logo} alt="" /> : settings?.siteName || "BEYOND </>"}
            </Link>
            <div className="links">
                {(settings?.navigation?.length ? settings.navigation : defaultLinks).map((item) => item.href.startsWith("/")
                    ? <NavLink key={`${item.href}-${item.label}`} to={item.href} end={item.href === "/"}>{item.label}</NavLink>
                    : <a key={`${item.href}-${item.label}`} href={item.href} target="_blank" rel="noreferrer">{item.label}</a>)}
                <NavLink to="/search" className="search-link" aria-label="Search stories">
                    <Search size={20} aria-hidden="true" />
                    <span>Search</span>
                </NavLink>
                {user?.role === "admin" && <NavLink to="/admin" className="auth-link">Dashboard</NavLink>}
                {user && <NavLink to="/profile" className="auth-link">Profile</NavLink>}
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