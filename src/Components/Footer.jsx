import { ArrowRight, ArrowUpRight, Mail } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => (
    <footer className="site-footer">
        <div className="site-footer-inner">
            <div className="site-footer-top">
                <div className="site-footer-brand">
                    <Link className="site-footer-logo" to="/">X-BLOG<span>.</span></Link>
                    <p>A journal for curious minds. Thoughtful stories, fresh perspectives, and ideas worth passing on.</p>
                    <a className="site-footer-email" href="mailto:vincenttwizere12@gmail.com">
                        <Mail size={16} aria-hidden="true" />
                        vincenttwizere12@gmail.com
                        <ArrowUpRight size={14} aria-hidden="true" />
                    </a>
                </div>

                <div className="site-footer-column">
                    <h2>Explore</h2>
                    <Link to="/">Home</Link>
                    <Link to="/posts">All stories</Link>
                    <Link to="/categories">Categories</Link>
                    <Link to="/search">Search the journal</Link>
                </div>

                <div className="site-footer-column">
                    <h2>Get involved</h2>
                    <Link to="/about">About X-Blog</Link>
                    <Link to="/create">Write a story</Link>
                    <Link to="/contact">Contact</Link>
                </div>

                <Link className="site-footer-invite" to="/create">
                    <span className="site-footer-invite-label">Have something to share?</span>
                    <span className="site-footer-invite-action">
                        Add your voice <ArrowRight size={17} aria-hidden="true" />
                    </span>
                </Link>
            </div>

            <div className="site-footer-bottom">
                <p>© {new Date().getFullYear()} X-Blog. Made for ideas that bring us forward.</p>
            </div>
        </div>
    </footer>
);

export default Footer;
