import { useEffect, useState } from "react";
import {
    Activity,
    Bell,
    BookOpen,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    FileImage,
    FolderOpen,
    LayoutDashboard,
    LogOut,
    Mail,
    Menu,
    MessageSquare,
    Moon,
    PanelsTopLeft,
    Search,
    Settings,
    ShieldCheck,
    Sun,
    Tags,
    Users,
    X,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../useAuth";
import "../admin.css";

const navigation = [
    { id: "overview", label: "Dashboard", icon: LayoutDashboard },
    {
        id: "posts",
        label: "Posts",
        icon: BookOpen,
        children: [
            { id: "stories", label: "All posts" },
            { id: "create", label: "New post" },
            { id: "drafts", label: "Drafts" },
        ],
    },
    { id: "categories", label: "Categories & Tags", icon: Tags },
    { id: "media", label: "Media Library", icon: FileImage },
    { id: "comments", label: "Comments", icon: MessageSquare },
    { id: "users", label: "Users", icon: Users },
    { id: "subscribers", label: "Subscribers / Newsletter", icon: Mail },
    { id: "analytics", label: "Analytics", icon: Activity },
    { id: "pages", label: "Pages & Navigation", icon: PanelsTopLeft },
    { id: "settings", label: "Settings", icon: Settings },
];

const pageTitles = {
    overview: "Dashboard",
    stories: "Posts",
    drafts: "Drafts",
    categories: "Categories & Tags",
    media: "Media Library",
    comments: "Comments",
    users: "Users",
    subscribers: "Subscribers / Newsletter",
    analytics: "Analytics",
    pages: "Pages & Navigation",
    settings: "Settings",
};

function readPreference(key, fallback) {
    try {
        return window.localStorage.getItem(key) ?? fallback;
    } catch {
        return fallback;
    }
}

function AdminLayout({ activeTab, children, onNavigate, onSearch, searchValue, user }) {
    const { signOut } = useAuth();
    const navigate = useNavigate();
    const [collapsed, setCollapsed] = useState(() => readPreference("beyond-admin-sidebar", "expanded") === "collapsed");
    const [theme, setTheme] = useState(() => readPreference("beyond-admin-theme", "dark"));
    const [mobileOpen, setMobileOpen] = useState(false);
    const [postsExpanded, setPostsExpanded] = useState(true);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [signOutError, setSignOutError] = useState("");

    useEffect(() => {
        try {
            window.localStorage.setItem("beyond-admin-sidebar", collapsed ? "collapsed" : "expanded");
        } catch {
            // Keep the dashboard usable when browser storage is unavailable.
        }
    }, [collapsed]);

    useEffect(() => {
        try {
            window.localStorage.setItem("beyond-admin-theme", theme);
        } catch {
            // Keep the dashboard usable when browser storage is unavailable.
        }
    }, [theme]);

    useEffect(() => {
        if (!mobileOpen) return undefined;
        const closeOnEscape = (event) => {
            if (event.key === "Escape") setMobileOpen(false);
        };
        window.addEventListener("keydown", closeOnEscape);
        return () => window.removeEventListener("keydown", closeOnEscape);
    }, [mobileOpen]);

    const navigateTo = (destination) => {
        setSignOutError("");
        setMobileOpen(false);
        onNavigate(destination);
    };

    const handleSignOut = async () => {
        setSignOutError("");
        try {
            await signOut();
            navigate("/", { replace: true });
        } catch (error) {
            setSignOutError(error.message);
        }
    };

    const initials = user?.name?.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "A";
    const activeTitle = pageTitles[activeTab] || "Dashboard";

    return (
        <div className={`admin-shell${collapsed ? " is-collapsed" : ""}`} data-theme={theme}>
            <a className="admin-skip-link" href="#admin-main">Skip to dashboard content</a>

            {mobileOpen && (
                <button
                    className="admin-drawer-backdrop"
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    aria-label="Close navigation menu"
                />
            )}

            <aside className={`admin-shell-sidebar${mobileOpen ? " is-mobile-open" : ""}`} aria-label="Admin sidebar">
                <div className="admin-shell-brand-row">
                    <Link className="admin-shell-brand" to="/" aria-label="BEYOND home">
                        <span className="admin-brand-word">BEYOND</span><span className="admin-brand-code">&lt;/&gt;</span>
                    </Link>
                    <button className="admin-collapse-button" type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed}>
                        {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
                    </button>
                    <button className="admin-mobile-close" type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation menu">
                        <X size={19} />
                    </button>
                </div>

                <p className="admin-shell-section-label">Workspace</p>
                <nav className="admin-shell-nav" aria-label="Admin dashboard">
                    {navigation.map(({ id, label, icon: Icon, children: nestedItems }) => {
                        const selected = id === "posts"
                            ? ["stories", "drafts"].includes(activeTab)
                            : activeTab === id;
                        if (nestedItems) {
                            return (
                                <div className="admin-nav-group" key={id}>
                                    <button
                                        className={`admin-shell-nav-item${selected ? " is-active" : ""}`}
                                        type="button"
                                        onClick={() => setPostsExpanded((value) => !value)}
                                        aria-expanded={postsExpanded}
                                        aria-label={label}
                                        title={collapsed ? label : undefined}
                                    >
                                        <Icon size={18} aria-hidden="true" />
                                        <span className="admin-nav-label">{label}</span>
                                        <ChevronDown className={`admin-nav-chevron${postsExpanded ? " is-open" : ""}`} size={15} aria-hidden="true" />
                                    </button>
                                    {postsExpanded && (
                                        <div className="admin-shell-subnav">
                                            {nestedItems.map((item) => (
                                                <button
                                                    key={item.id}
                                                    className={`admin-shell-subnav-item${activeTab === item.id || (item.id === "stories" && activeTab === "stories") ? " is-active" : ""}`}
                                                    type="button"
                                                    onClick={() => navigateTo(item.id)}
                                                >
                                                    <span className="admin-subnav-dot" aria-hidden="true" />
                                                    <span className="admin-nav-label">{item.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        }
                        return (
                            <button
                                key={id}
                                className={`admin-shell-nav-item${selected ? " is-active" : ""}`}
                                type="button"
                                onClick={() => navigateTo(id)}
                                aria-current={selected ? "page" : undefined}
                                title={collapsed ? label : undefined}
                            >
                                <Icon size={18} aria-hidden="true" />
                                <span className="admin-nav-label">{label}</span>
                            </button>
                        );
                    })}
                </nav>

                <div className="admin-shell-sidebar-bottom">
                    <Link className="admin-view-site" to="/" title={collapsed ? "View site" : undefined}>
                        <FolderOpen size={17} aria-hidden="true" />
                        <span className="admin-nav-label">View site</span>
                    </Link>
                    <div className="admin-profile-card">
                        <span className="admin-profile-avatar" aria-hidden="true">{initials}</span>
                        <span className="admin-profile-copy"><strong>{user?.name || "Administrator"}</strong><small><ShieldCheck size={12} /> Admin</small></span>
                    </div>
                    <button className="admin-shell-logout" type="button" onClick={handleSignOut} title={collapsed ? "Log out" : undefined}>
                        <LogOut size={17} aria-hidden="true" />
                        <span className="admin-nav-label">Log out</span>
                    </button>
                </div>
            </aside>

            <main className="admin-shell-main" id="admin-main">
                <header className="admin-shell-topbar">
                    <div className="admin-topbar-leading">
                        <button className="admin-mobile-menu" type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation menu" aria-expanded={mobileOpen}>
                            <Menu size={20} />
                        </button>
                        <div className="admin-shell-breadcrumb"><span>Workspace</span><span aria-hidden="true">/</span><strong>{activeTitle}</strong></div>
                    </div>
                    <div className="admin-shell-actions">
                        <label className="admin-global-search">
                            <Search size={16} aria-hidden="true" />
                            <input type="search" value={searchValue} onChange={(event) => onSearch(event.target.value)} placeholder="Search posts..." aria-label="Search dashboard posts" />
                            <kbd>⌘ K</kbd>
                        </label>
                        <div className="admin-notification-wrap">
                            <button className="admin-toolbar-button" type="button" onClick={() => setNotificationsOpen((value) => !value)} aria-label="Notifications" aria-expanded={notificationsOpen}>
                                <Bell size={18} />
                            </button>
                            {notificationsOpen && (
                                <div className="admin-notification-popover" role="status">
                                    <strong>Notifications</strong>
                                    <p>You’re all caught up.</p>
                                </div>
                            )}
                        </div>
                        <button className="admin-toolbar-button admin-theme-button" type="button" onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
                            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                        <details className="admin-account-menu">
                            <summary aria-label="Open administrator account menu">
                                <span className="admin-account-avatar">{initials}</span>
                                <ChevronDown size={14} aria-hidden="true" />
                            </summary>
                            <div className="admin-account-popover">
                                <strong>{user?.name || "Administrator"}</strong>
                                <small>{user?.email}</small>
                                <button type="button" onClick={handleSignOut}><LogOut size={15} /> Log out</button>
                            </div>
                        </details>
                    </div>
                </header>
                <div className="admin-shell-content" id="admin-content">
                    {signOutError && <p className="admin-shell-error" role="alert">{signOutError}</p>}
                    {children}
                </div>
            </main>
        </div>
    );
}

export default AdminLayout;
