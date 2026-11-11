import { useState } from "react";
import { apiRequest } from "../api";

function NewsletterSignup() {
    const [email, setEmail] = useState("");
    const [consent, setConsent] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        setMessage("");
        setError("");
        setIsSubmitting(true);
        try {
            await apiRequest("/api/newsletter/subscribe", {
                method: "POST",
                body: JSON.stringify({ email, consent, website: event.currentTarget.elements.namedItem("website").value }),
            });
            setEmail("");
            setConsent(false);
            setMessage("Thanks for signing up. Your subscription will be reviewed before activation.");
        } catch (submitError) {
            setError(submitError.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form className="newsletter-signup" onSubmit={submit}>
            <label className="visually-hidden" htmlFor="newsletter-email">Email address</label>
            <div className="newsletter-signup-row">
                <input id="newsletter-email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Your email address" />
                <button type="submit" disabled={isSubmitting}>{isSubmitting ? "Joining…" : "Subscribe"}</button>
            </div>
            <label className="newsletter-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required /><span>I agree to receive the BEYOND newsletter.</span></label>
            {message && <p role="status">{message}</p>}
            {error && <p role="alert">{error}</p>}
            <label className="newsletter-honeypot" aria-hidden="true">Leave this field empty<input tabIndex={-1} autoComplete="off" name="website" /></label>
        </form>
    );
}

export default NewsletterSignup;
