import { useEffect, useState } from "react";
import { Check, Save, UserRound } from "lucide-react";
import { apiRequest } from "../api";
import { useAuth } from "../useAuth";

const defaultSettings = {
    siteName: "BEYOND </>",
    tagline: "",
    logo: "",
    favicon: "",
    seoTitle: "",
    seoDescription: "",
    socialLinks: { website: "", github: "", linkedin: "", x: "" },
    commentsEnabled: true,
    maintenanceMode: false,
    navigation: [],
    footerLinks: [],
};

function AdminSettings() {
    const { user, updateProfile } = useAuth();
    const [settings, setSettings] = useState(defaultSettings);
    const [profile, setProfile] = useState({ name: user?.name || "" });
    const [password, setPassword] = useState({ currentPassword: "", newPassword: "", confirmation: "" });
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        let isMounted = true;
        apiRequest("/api/admin/settings")
            .then((value) => {
                if (isMounted) setSettings({ ...defaultSettings, ...value, socialLinks: { ...defaultSettings.socialLinks, ...value.socialLinks } });
            })
            .catch((loadError) => {
                if (isMounted) setError(loadError.message);
            })
            .finally(() => {
                if (isMounted) setIsLoading(false);
            });
        return () => {
            isMounted = false;
        };
    }, []);

    const saveSettings = async (event) => {
        event.preventDefault();
        setError("");
        setNotice("");
        setIsSaving(true);
        try {
            const saved = await apiRequest("/api/admin/settings", { method: "PATCH", body: JSON.stringify(settings) });
            setSettings(saved);
            setNotice("Site settings saved.");
        } catch (saveError) {
            setError(saveError.message);
        } finally {
            setIsSaving(false);
        }
    };

    const saveProfile = async (event) => {
        event.preventDefault();
        setError("");
        setNotice("");
        if (password.newPassword && password.newPassword !== password.confirmation) {
            setError("New password and confirmation do not match.");
            return;
        }
        setIsSaving(true);
        try {
            const result = await updateProfile({
                name: profile.name,
                ...(password.newPassword ? { currentPassword: password.currentPassword, newPassword: password.newPassword } : {}),
            });
            setProfile({ name: result.name });
            setPassword({ currentPassword: "", newPassword: "", confirmation: "" });
            setNotice("Your profile was updated.");
        } catch (profileError) {
            setError(profileError.message);
        } finally {
            setIsSaving(false);
        }
    };

    const setSocial = (key, value) => setSettings((current) => ({ ...current, socialLinks: { ...current.socialLinks, [key]: value } }));

    return (
        <div className="admin-module-stack">
            {notice && <p className="admin-feedback admin-feedback-success" role="status"><Check size={16} />{notice}</p>}
            {error && <p className="admin-feedback admin-feedback-error" role="alert">{error}</p>}
            {isLoading ? <p className="admin-loading" role="status">Loading settings…</p> : (
                <>
                    <section className="admin-panel">
                        <form className="admin-settings-form" onSubmit={saveSettings}>
                            <div className="admin-panel-heading"><div><h2>Site settings</h2><p>Brand, search defaults, social links, and site behavior.</p></div></div>
                            <div className="admin-editor-row">
                                <label>Site name<input value={settings.siteName} onChange={(event) => setSettings({ ...settings, siteName: event.target.value })} minLength={2} maxLength={120} required /></label>
                                <label>Tagline<input value={settings.tagline} onChange={(event) => setSettings({ ...settings, tagline: event.target.value })} maxLength={240} /></label>
                            </div>
                            <div className="admin-editor-row">
                                <label>Logo URL<input value={settings.logo} onChange={(event) => setSettings({ ...settings, logo: event.target.value })} placeholder="/api/media/…" /></label>
                                <label>Favicon URL<input value={settings.favicon} onChange={(event) => setSettings({ ...settings, favicon: event.target.value })} placeholder="/api/media/…" /></label>
                            </div>
                            <div className="admin-settings-media-hint">Upload a logo or favicon in the Media Library, then paste its URL here.</div>
                            <fieldset className="admin-seo-fields">
                                <legend>Default SEO</legend>
                                <label>Default meta title<input value={settings.seoTitle} onChange={(event) => setSettings({ ...settings, seoTitle: event.target.value })} maxLength={160} /></label>
                                <label>Default description<textarea value={settings.seoDescription} onChange={(event) => setSettings({ ...settings, seoDescription: event.target.value })} maxLength={320} rows={3} /></label>
                            </fieldset>
                            <fieldset className="admin-seo-fields">
                                <legend>Social links</legend>
                                <div className="admin-editor-row">
                                    <label>Website<input type="url" value={settings.socialLinks.website || ""} onChange={(event) => setSocial("website", event.target.value)} placeholder="https://…" /></label>
                                    <label>GitHub<input type="url" value={settings.socialLinks.github || ""} onChange={(event) => setSocial("github", event.target.value)} placeholder="https://github.com/…" /></label>
                                </div>
                                <div className="admin-editor-row">
                                    <label>LinkedIn<input type="url" value={settings.socialLinks.linkedin || ""} onChange={(event) => setSocial("linkedin", event.target.value)} placeholder="https://linkedin.com/in/…" /></label>
                                    <label>X / Twitter<input type="url" value={settings.socialLinks.x || ""} onChange={(event) => setSocial("x", event.target.value)} placeholder="https://x.com/…" /></label>
                                </div>
                            </fieldset>
                            <label className="admin-setting-toggle"><input type="checkbox" checked={settings.commentsEnabled} onChange={(event) => setSettings({ ...settings, commentsEnabled: event.target.checked })} /><span><strong>Allow new comments</strong><small>Readers can submit comments for moderation.</small></span></label>
                            <label className="admin-setting-toggle is-warning"><input type="checkbox" checked={settings.maintenanceMode} onChange={(event) => setSettings({ ...settings, maintenanceMode: event.target.checked })} /><span><strong>Maintenance mode</strong><small>Temporarily pauses public content and sign-ups. Admin access stays available.</small></span></label>
                            <div className="admin-editor-actions"><button className="admin-primary-button" type="submit" disabled={isSaving}><Save size={15} />{isSaving ? "Saving…" : "Save settings"}</button></div>
                        </form>
                    </section>
                    <section className="admin-panel">
                        <form className="admin-settings-form" onSubmit={saveProfile}>
                            <div className="admin-panel-heading"><div><h2>Administrator profile</h2><p>Update your display name and password.</p></div><UserRound size={20} /></div>
                            <label>Name<input value={profile.name} onChange={(event) => setProfile({ name: event.target.value })} minLength={2} maxLength={80} required /></label>
                            <label>Email<input value={user?.email || ""} readOnly aria-readonly="true" /></label>
                            <fieldset className="admin-seo-fields">
                                <legend>Change password</legend>
                                <label>Current password<input type="password" autoComplete="current-password" value={password.currentPassword} onChange={(event) => setPassword({ ...password, currentPassword: event.target.value })} required={Boolean(password.newPassword)} /></label>
                                <div className="admin-editor-row">
                                    <label>New password<input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={password.newPassword} onChange={(event) => setPassword({ ...password, newPassword: event.target.value })} /></label>
                                    <label>Confirm new password<input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={password.confirmation} onChange={(event) => setPassword({ ...password, confirmation: event.target.value })} /></label>
                                </div>
                            </fieldset>
                            <div className="admin-editor-actions"><button className="admin-primary-button" type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save profile"}</button></div>
                        </form>
                    </section>
                </>
            )}
        </div>
    );
}

export default AdminSettings;
