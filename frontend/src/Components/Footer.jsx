import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import NewsletterSignup from "./NewsletterSignup";
import { apiRequest } from "../api";

const Footer = () => {
    const [settings, setSettings] = useState(null);

    useEffect(() => {
        let isMounted = true;
        apiRequest("/api/site-settings")
            .then((value) => {
                if (isMounted) setSettings(value);
            })
            .catch((error) => console.error("Could not load footer settings:", error));
        return () => {
            isMounted = false;
        };
    }, []);

    return (
        <footer className="site-footer">
            <div className="site-footer-inner">
                <div className="site-footer-top">
                    <div className="site-footer-brand">
                        <Link className="site-footer-logo" to="/">{settings?.siteName || "BEYOND </>"}<span>.</span></Link>
                        <p>{settings?.tagline || "A journal for curious minds. Thoughtful stories, fresh perspectives, and ideas worth passing on."}</p>
                        <a className="site-footer-email" href="mailto:vincenttwizere12@gmail.com">
                            <Mail size={16} aria-hidden="true" />
                            vincenttwizere12@gmail.com
                            <ArrowUpRight size={14} aria-hidden="true" />
                        </a>
                    </div>

                    {settings?.footerLinks?.length ? (
                        <div className="site-footer-column">
                            <h2>Links</h2>
                            {settings.footerLinks.map((item) => item.href.startsWith("/")
                                ? <Link key={`${item.href}-${item.label}`} to={item.href}>{item.label}</Link>
                                : <a key={`${item.href}-${item.label}`} href={item.href} target="_blank" rel="noreferrer">{item.label}</a>)}
                        </div>
                    ) : (
                        <>
                            <div className="site-footer-column">
                                <h2>Explore</h2>
                                <Link to="/">Home</Link>
                                <Link to="/posts">All stories</Link>
                                <Link to="/categories">Categories</Link>
                                <Link to="/search">Search the journal</Link>
                            </div>
                            <div className="site-footer-column">
                                <h2>Get involved</h2>
                                <Link to="/about">About BEYOND &lt;/&gt;</Link>
                                <Link to="/create">Write a story</Link>
                                <Link to="/contact">Contact</Link>
                            </div>
                        </>
                    )}

                    <Link className="site-footer-invite" to="/create">
                        <span className="site-footer-invite-label">Have something to share?</span>
                        <span className="site-footer-invite-action">Add your voice <ArrowRight size={17} aria-hidden="true" /></span>
                    </Link>
                </div>

                <section className="site-footer-newsletter" aria-labelledby="newsletter-heading">
                    <div><p className="site-footer-invite-label">BEYOND in your inbox</p><h2 id="newsletter-heading">Stories worth keeping up with.</h2></div>
                    <NewsletterSignup />
                </section>

                <div className="site-footer-bottom">
                    <p>© {new Date().getFullYear()} {settings?.siteName || "BEYOND </>"}. Made for ideas that bring us forward.</p>
                    <div className="site-footer-socials">
                        {Object.entries(settings?.socialLinks || {}).filter(([, href]) => href).map(([label, href]) => <a key={label} href={href} target="_blank" rel="noreferrer">{label}</a>)}
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
