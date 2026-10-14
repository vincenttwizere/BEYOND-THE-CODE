import { useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import categories from "../data/categories";

const Create = () => {
    const navigate = useNavigate();
    const [title, setTitle] = useState("");
    const [author, setAuthor] = useState("");
    const [category, setCategory] = useState(categories[0].name);
    const [body, setBody] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            const response = await fetch("http://localhost:8000/blogs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: title.trim(), author: author.trim(), category, body: body.trim() }),
            });

            if (!response.ok) {
                throw new Error("The story could not be published. Please try again.");
            }

            const createdBlog = await response.json();
            if (createdBlog.id == null) {
                throw new Error("The server saved the story but did not return its ID.");
            }
            navigate(`/blogs/${createdBlog.id}`);
        } catch (submissionError) {
            setError(submissionError.message || "The story could not be published. Please try again.");
            setIsSubmitting(false);
        }
    };

    return (
        <main className="editorial-page">
            <div className="editorial-page-shell create-shell">
                <Link className="editorial-back-link" to="/posts">
                    <ArrowLeft size={16} aria-hidden="true" /> Back to stories
                </Link>
                <header className="editorial-page-heading">
                    <p className="editorial-eyebrow">Your voice belongs here</p>
                    <h1>Write a story</h1>
                    <p>Share an idea, a lesson, or a moment worth remembering.</p>
                </header>

                <form className="editorial-form" onSubmit={handleSubmit}>
                    <label>
                        Story title
                        <input
                            name="title"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            maxLength={120}
                            placeholder="Give your story a title"
                            required
                        />
                    </label>
                    <div className="editorial-form-row">
                        <label>
                            Author name
                            <input
                                name="author"
                                value={author}
                                onChange={(event) => setAuthor(event.target.value)}
                                maxLength={60}
                                placeholder="How should we credit you?"
                                required
                            />
                        </label>
                        <label>
                            Category
                            <select value={category} onChange={(event) => setCategory(event.target.value)}>
                                {categories.map((item) => (
                                    <option key={item.slug} value={item.name}>{item.name}</option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <label>
                        Your story
                        <textarea
                            name="body"
                            value={body}
                            onChange={(event) => setBody(event.target.value)}
                            rows={10}
                            placeholder="Start writing..."
                            required
                        />
                    </label>
                    {error && <p className="editorial-form-error" role="alert">{error}</p>}
                    <button className="editorial-button" type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "Publishing…" : "Publish story"}
                        <Send size={16} aria-hidden="true" />
                    </button>
                </form>
            </div>
        </main>
    );
};

export default Create;
