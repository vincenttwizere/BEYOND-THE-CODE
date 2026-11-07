import { useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../useAuth";

const Auth = () => {
    const [mode, setMode] = useState("login");
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [message, setMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { user, isLoading, signIn, signUp } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const isSignUp = mode === "signup";

    useEffect(() => {
        if (!isLoading && user) {
            navigate(user.role === "admin" ? "/admin" : "/", { replace: true });
        }
    }, [isLoading, navigate, user]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setMessage("");
        setIsSubmitting(true);
        const values = Object.fromEntries(new FormData(event.currentTarget));
        try {
            const account = isSignUp ? await signUp(values) : await signIn(values);
            const returnTo = location.state?.from;
            const destination = returnTo ? `${returnTo.pathname}${returnTo.search || ""}${returnTo.hash || ""}` : "/";
            navigate(account.role === "admin" ? "/admin" : destination, { replace: true });
        } catch (error) {
            setMessage(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const changeMode = (nextMode) => {
        setMode(nextMode);
        setIsPasswordVisible(false);
        setMessage("");
    };

    return (
        <main className="auth-page">
            <div className="auth-layout">
                <aside className="auth-welcome">
                    <p className="auth-welcome-kicker">BEYOND &lt;/&gt;</p>
                    <div>
                        <p className="auth-welcome-label">A journal for curious minds</p>
                        <h1>Ideas worth<br />coming back to.</h1>
                        <p className="auth-welcome-copy">
                            Thoughtful stories, fresh perspectives, and a community that loves to keep learning.
                        </p>
                    </div>
                    <p className="auth-welcome-footer">Read widely. Think deeply. Stay curious.</p>
                    <span className="auth-decoration auth-decoration-one" aria-hidden="true" />
                    <span className="auth-decoration auth-decoration-two" aria-hidden="true" />
                </aside>

                <section className="auth-panel" aria-labelledby="auth-heading">
                    <div className="auth-panel-top">
                        <span>BEYOND &lt;/&gt;</span>
                        <span>An independent journal</span>
                    </div>

                    <div className="auth-content">
                        <header className="auth-heading">
                            <p className="auth-eyebrow">{isSignUp ? "Get started" : "Your reading journey continues"}</p>
                            <h2 id="auth-heading">{isSignUp ? "Create your account" : "Welcome back"}</h2>
                            <p>{isSignUp ? "Join our community of curious readers." : "Sign in to pick up where you left off."}</p>
                        </header>

                        <div className="auth-mode-switch" role="group" aria-label="Choose login or sign up">
                            <span
                                className={`auth-mode-indicator${isSignUp ? " auth-mode-indicator-signup" : ""}`}
                                aria-hidden="true"
                            />
                            <button
                                className={isSignUp ? "" : "active"}
                                type="button"
                                aria-pressed={!isSignUp}
                                onClick={() => changeMode("login")}
                            >
                                Log in
                            </button>
                            <button
                                className={isSignUp ? "active" : ""}
                                type="button"
                                aria-pressed={isSignUp}
                                onClick={() => changeMode("signup")}
                            >
                                Sign up
                            </button>
                        </div>

                        <div key={mode} className="auth-mode-content">
                            <form className="auth-form" onSubmit={handleSubmit}>
                                {isSignUp && (
                                    <label className="auth-field">
                                        <span>Your name</span>
                                        <span className="auth-input-wrap">
                                            <UserRound size={18} aria-hidden="true" />
                                            <input name="name" type="text" placeholder="e.g. Alex Morgan" autoComplete="name" minLength={2} maxLength={80} required />
                                        </span>
                                    </label>
                                )}
                                <label className="auth-field">
                                    <span>Email address</span>
                                    <span className="auth-input-wrap">
                                        <Mail size={18} aria-hidden="true" />
                                        <input name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
                                    </span>
                                </label>
                                <label className="auth-field">
                                    <span>Password</span>
                                    <span className="auth-input-wrap">
                                        <LockKeyhole size={18} aria-hidden="true" />
                                        <input
                                            name="password"
                                            type={isPasswordVisible ? "text" : "password"}
                                            placeholder={isSignUp ? "At least 8 characters" : "Enter your password"}
                                            autoComplete={isSignUp ? "new-password" : "current-password"}
                                            minLength={8}
                                            required
                                        />
                                        <button
                                            className="auth-password-toggle"
                                            type="button"
                                            aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                                            onClick={() => setIsPasswordVisible((visible) => !visible)}
                                        >
                                            {isPasswordVisible
                                                ? <EyeOff size={18} aria-hidden="true" />
                                                : <Eye size={18} aria-hidden="true" />}
                                        </button>
                                    </span>
                                </label>

                                {message && <p className="auth-notice" role="alert">{message}</p>}

                                <button className="auth-submit" type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? "Please wait…" : isSignUp ? "Create account" : "Log in"}
                                    <ArrowRight size={18} aria-hidden="true" />
                                </button>
                            </form>

                            <p className="auth-switch-prompt">
                                {isSignUp ? "Already have an account?" : "New to Beyond the Code?"}{" "}
                                <button type="button" onClick={() => changeMode(isSignUp ? "login" : "signup")}>
                                    {isSignUp ? "Log in" : "Create an account"}
                                </button>
                            </p>
                        </div>
                    </div>

                    <p className="auth-legal">By continuing, you agree to our community guidelines.</p>
                </section>
            </div>
        </main>
    );
};

export default Auth;
