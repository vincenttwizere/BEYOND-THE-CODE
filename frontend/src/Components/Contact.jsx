import { useState } from "react";
import emailjs from "@emailjs/browser";
import { Mail, MapPin, Send } from "lucide-react";

const contactEmail = "vincenttwizere12@gmail.com";
const emailServiceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const emailTemplateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const emailPublicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

const Contact = () => {
    const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
    const [status, setStatus] = useState(null);
    const [isSending, setIsSending] = useState(false);

    const handleChange = (event) => {
        setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
        setStatus(null);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!emailServiceId || !emailTemplateId || !emailPublicKey) {
            setStatus({
                type: "error",
                message: "Email sending is not configured yet. Please contact us using the email address shown.",
            });
            return;
        }

        setIsSending(true);
        setStatus(null);

        try {
            await emailjs.send(
                emailServiceId,
                emailTemplateId,
                {
                    from_name: form.name.trim(),
                    reply_to: form.email.trim(),
                    subject: form.subject.trim(),
                    message: form.message.trim(),
                },
                emailPublicKey
            );
            setForm({ name: "", email: "", subject: "", message: "" });
            setStatus({ type: "success", message: "Your message was sent. Thank you for reaching out!" });
        } catch (error) {
            console.error("EmailJS contact submission failed:", error);
            setStatus({
                type: "error",
                message: `We couldn't send your message. Please try again or email ${contactEmail} directly.`,
            });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <main className="editorial-page">
            <div className="editorial-page-shell">
                <header className="editorial-page-heading">
                    <p className="editorial-eyebrow">We’d love to hear from you</p>
                    <h1>Start a conversation.</h1>
                    <p>Have a question, a story idea, or just want to say hello? Send a note.</p>
                </header>

                <div className="contact-layout">
                    <aside className="contact-aside">
                        <p className="editorial-eyebrow">Get in touch</p>
                        <h2>Good things start with a message.</h2>
                        <a className="contact-detail" href={`mailto:${contactEmail}`}>
                            <span><Mail size={18} aria-hidden="true" /></span>
                            <span>{contactEmail}</span>
                        </a>
                        <p className="contact-detail">
                            <span><MapPin size={18} aria-hidden="true" /></span>
                            <span>Independent stories, shared everywhere.</span>
                        </p>
                        <p className="contact-email-note">Send a message directly to our inbox. No email app is needed.</p>
                    </aside>

                    <form className="editorial-form contact-form" onSubmit={handleSubmit}>
                        <div className="editorial-form-row">
                            <label>
                                Your name
                                <input name="name" value={form.name} onChange={handleChange} autoComplete="name" required />
                            </label>
                            <label>
                                Email address
                                <input name="email" type="email" value={form.email} onChange={handleChange} autoComplete="email" required />
                            </label>
                        </div>
                        <label>
                            Subject
                            <input name="subject" value={form.subject} onChange={handleChange} required />
                        </label>
                        <label>
                            Message
                            <textarea name="message" value={form.message} onChange={handleChange} rows={6} required />
                        </label>
                        {status && (
                            <p
                                className={status.type === "error" ? "editorial-form-error" : "editorial-form-success"}
                                role={status.type === "error" ? "alert" : "status"}
                            >
                                {status.message}
                            </p>
                        )}
                        <button className="editorial-button" type="submit" disabled={isSending}>
                            {isSending ? "Sending…" : "Send message"} <Send size={16} aria-hidden="true" />
                        </button>
                    </form>
                </div>
            </div>
        </main>
    );
};

export default Contact;
