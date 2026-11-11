import { useEffect, useState } from "react";
import Navbar from "./Components/Navbar";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import Home from "./Components/Home";
import BlogDetails from "./Components/BlogDetails";
import Footer from "./Components/Footer";
import About from "./Components/About";
import Posts from "./Components/Posts";
import Categories from "./Components/Categories";
import CategoryStories from "./Components/CategoryStories";
import Contact from "./Components/Contact";
import Search from "./Components/Search";
import NotFound from "./Components/NotFound";
import Auth from "./Components/Auth";
import Admin from "./Components/Admin";
import RequireAuth from "./Components/RequireAuth";
import { apiRequest } from "./api";
import StaticPage from "./Components/StaticPage";
import Profile from "./Components/Profile";

const App = () => {
    const location = useLocation();
    const isAdminRoute = location.pathname.startsWith("/admin");
    const [siteSettings, setSiteSettings] = useState(null);

    useEffect(() => {
        let isMounted = true;
        apiRequest("/api/site-settings")
            .then((settings) => {
                if (isMounted) setSiteSettings(settings);
                if (isMounted) {
                    document.title = settings.seoTitle || settings.siteName || "BEYOND </>";
                    if (settings.favicon) {
                        const favicon = document.querySelector('link[rel="icon"]');
                        if (favicon) favicon.href = settings.favicon;
                    }
                    let description = document.querySelector('meta[name="description"]');
                    if (!description) {
                        description = document.createElement("meta");
                        description.name = "description";
                        document.head.append(description);
                    }
                    if (settings.seoDescription) description.content = settings.seoDescription;
                }
            })
            .catch((error) => console.error("Could not load site settings:", error));
        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (isAdminRoute) return;

        let visitorId;
        try {
            visitorId = window.sessionStorage.getItem("beyond-visitor-id");
            if (!visitorId) {
                visitorId = window.crypto.randomUUID();
                window.sessionStorage.setItem("beyond-visitor-id", visitorId);
            }
        } catch (error) {
            console.error("Could not save an analytics visitor ID:", error);
            visitorId = window.crypto.randomUUID();
        }

        const width = window.innerWidth;
        const device = width < 640 ? "mobile" : width < 1024 ? "tablet" : "desktop";
        apiRequest("/api/analytics/pageview", {
            method: "POST",
            body: JSON.stringify({
                path: `${location.pathname}${location.search}`,
                visitorId,
                referrer: document.referrer,
                device,
            }),
        }).catch((error) => console.error("Could not record this page view:", error));
    }, [isAdminRoute, location.pathname, location.search]);

    if (siteSettings?.maintenanceMode && !isAdminRoute && location.pathname !== "/login") {
        return (
            <main className="maintenance-page">
                <p className="editorial-eyebrow">{siteSettings.siteName || "BEYOND </>"}</p>
                <h1>We will be right back.</h1>
                <p>{siteSettings.tagline || "The site is temporarily unavailable while we make a few improvements."}</p>
                <Link to="/login">Administrator sign in</Link>
            </main>
        );
    }

    return (
      <div className={`App${isAdminRoute ? " App-admin" : ""}`} id="top">
        {!isAdminRoute && <Navbar />}
        <div className="content">
          <Routes>
            <Route exact path="/" element={<Home />} />
            <Route path="/create" element={<RequireAuth role="admin"><Navigate to="/admin?create=1" replace /></RequireAuth>} />
            <Route path="/blogs/:id" element={<RequireAuth><BlogDetails /></RequireAuth>} />
            <Route path="/admin/*" element={<RequireAuth role="admin"><Admin /></RequireAuth>} />
            <Route path="/about" element={<About />} />
            <Route path="/posts" element={<Posts />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/categories/:slug" element={<CategoryStories />} />
            <Route path="/pages/:slug" element={<StaticPage />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/search" element={<Search />} />
            <Route path="/login" element={<Auth />} />
            <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
        {!isAdminRoute && <Footer />}
      </div>
    );
};

export default App;