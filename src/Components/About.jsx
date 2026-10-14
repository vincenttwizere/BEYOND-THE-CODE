import { ArrowRight, BookOpen, Heart, Lightbulb } from "lucide-react";
import { Link } from "react-router-dom";

const About = () => (
    <main className="editorial-page">
        <div className="editorial-page-shell">
            <header className="editorial-page-heading about-heading">
                <p className="editorial-eyebrow">A little about us</p>
                <h1>A home for ideas<br />that move us forward.</h1>
                <p>X-Blog is an independent journal for curious people and the stories that bring us closer.</p>
            </header>

            <div className="about-feature">
                <img src="/images/hero-writing.jpg" alt="A fountain pen and handwritten notes on a desk" />
                <div>
                    <p className="editorial-eyebrow">Why we write</p>
                    <h2>Good stories make room for new perspectives.</h2>
                    <p>We believe the right idea, shared at the right time, can spark a conversation, inspire a new skill, or help someone feel a little less alone. This journal brings together practical learning, creative thinking, and the everyday moments that stay with us.</p>
                    <Link className="editorial-text-link" to="/posts">
                        Explore the journal <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                </div>
            </div>

            <section className="about-values" aria-label="What guides X-Blog">
                <article>
                    <span><BookOpen size={20} aria-hidden="true" /></span>
                    <h3>Stay curious</h3>
                    <p>Make space to keep learning, ask better questions, and explore what you do not know yet.</p>
                </article>
                <article>
                    <span><Lightbulb size={20} aria-hidden="true" /></span>
                    <h3>Share generously</h3>
                    <p>Useful ideas are even more powerful when they are shared clearly and openly.</p>
                </article>
                <article>
                    <span><Heart size={20} aria-hidden="true" /></span>
                    <h3>Lead with people</h3>
                    <p>Every story matters because of the people behind it and the people it can reach.</p>
                </article>
            </section>
        </div>
    </main>
);

export default About;
