import { useState } from "react";

const Auth = () => {
    const [mode, setMode] = useState("login");
    const [message, setMessage] = useState("");
    const isSignUp = mode === "signup";

    const handleSubmit = (event) => {
        event.preventDefault();
        setMessage("Account access is not available yet. Authentication needs to be connected.");
    };

    const changeMode = (nextMode) => {
        setMode(nextMode);
        setMessage("");
    };

    return (
        <main className="editorial-page">
            <div className="editorial-page-shell auth-shell">
                <header className="editorial-page-heading">
                    <p className="editorial-eyebrow">Welcome to Beyond the Code</p>
                    <h1>{isSignUp ? "Join the conversation." : "Welcome back."}</h1>
                    <p>{isSignUp ? "Create an account to be part of our community." : "Sign in to your account to continue."}</p>
                </header>

                <div className="auth-card">
                    <div className="auth-mode-switch" aria-label="Choose login or sign up">
                        <button
                            className={isSignUp ? "" : "active"}
                            type="button"
                            aria-pressed={!isSignUp}
                            onClick={() => changeMode("login")}
                        >
                            Login
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

                    <form className="editorial-form auth-form" onSubmit={handleSubmit}>
                        {isSignUp && (
                            <label>
                                Your name
                                <input name="name" type="text" autoComplete="name" required />
                            </label>
                        )}
                        <label>
                            Email address
                            <input name="email" type="email" autoComplete="email" required />
                        </label>
                        <label>
                            Password
                            <input
                                name="password"
                                type="password"
                                autoComplete={isSignUp ? "new-password" : "current-password"}
                                minLength={8}
                                required
                            />
                        </label>
                        {message && <p className="editorial-form-error" role="status">{message}</p>}
                        <button className="editorial-button" type="submit">
                            {isSignUp ? "Create account" : "Login"}
                        </button>
                    </form>
                </div>
            </div>
        </main>
    );
};

export default Auth;
