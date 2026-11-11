import { useEffect, useState } from "react";
import { Activity, Eye, Users } from "lucide-react";
import { apiRequest } from "../api";

const dateInput = (date) => {
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return localDate.toISOString().slice(0, 10);
};

function AdminAnalytics() {
    const [range, setRange] = useState("30");
    const [to, setTo] = useState(() => dateInput(new Date()));
    const [from, setFrom] = useState(() => {
        const date = new Date();
        date.setDate(date.getDate() - 29);
        return dateInput(date);
    });
    const [data, setData] = useState(null);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        apiRequest(`/api/admin/analytics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
            .then((result) => {
                if (isMounted) {
                    setData(result);
                    setError("");
                }
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
    }, [from, to]);

    const selectRange = (days) => {
        setIsLoading(true);
        setRange(String(days));
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - days + 1);
        setFrom(dateInput(start));
        setTo(dateInput(end));
    };

    const maxViews = Math.max(...(data?.series || []).map((item) => item.views), 1);
    return (
        <div className="admin-module-stack">
            {error && <p className="admin-feedback admin-feedback-error" role="alert">{error}</p>}
            <section className="admin-panel">
                <div className="admin-panel-heading">
                    <div><h2>Traffic overview</h2><p>First-party public page-view activity. Admin routes are excluded.</p></div>
                    <div className="admin-analytics-date-range">
                        <div className="admin-range-presets" role="group" aria-label="Choose analytics date range">
                            {[7, 30, 90].map((days) => <button key={days} className={range === String(days) ? "is-active" : ""} type="button" onClick={() => selectRange(days)}>{days} days</button>)}
                        </div>
                        <label>From<input type="date" value={from} max={to} onChange={(event) => { setIsLoading(true); setRange("custom"); setFrom(event.target.value); }} /></label>
                        <label>To<input type="date" value={to} min={from} max={dateInput(new Date())} onChange={(event) => { setIsLoading(true); setRange("custom"); setTo(event.target.value); }} /></label>
                    </div>
                </div>
                {isLoading && !data ? <p className="admin-loading" role="status">Loading analytics…</p> : (
                    <div className="admin-analytics-stats">
                        <Metric icon={Eye} label="Page views" value={data?.views || 0} />
                        <Metric icon={Users} label="Unique visitors" value={data?.visitors || 0} />
                        <Metric icon={Activity} label="Tracked days" value={data?.series?.length || 0} />
                    </div>
                )}
            </section>
            <div className="admin-overview-grid">
                <section className="admin-panel admin-chart-panel">
                    <div className="admin-panel-heading"><div><h2>Views &amp; visitors</h2><p>Daily totals for the selected range</p></div></div>
                    {data?.series?.length ? <div className="admin-analytics-chart" role="img" aria-label="Page views by day">{data.series.map((item) => <div key={item.day} title={`${item.day}: ${item.views} views, ${item.visitors} visitors`}><span className="admin-analytics-bar" style={{ height: `${Math.max(item.views / maxViews * 100, 2)}%` }} /><small>{item.day.slice(5)}</small></div>)}</div> : <div className="admin-empty"><span><Activity size={22} /></span><h3>No activity in this range</h3><p>Page views will appear after readers visit your public pages.</p></div>}
                </section>
                <section className="admin-panel">
                    <div className="admin-panel-heading"><div><h2>Top pages</h2><p>Most visited paths</p></div></div>
                    <RankedList items={(data?.topPages || []).map((item) => ({ label: item.path, value: item.views }))} empty="No page views recorded." />
                </section>
            </div>
            <div className="admin-overview-grid">
                <section className="admin-panel">
                    <div className="admin-panel-heading"><div><h2>Referrers</h2><p>Sources that sent readers here</p></div></div>
                    <RankedList items={(data?.referrers || []).map((item) => ({ label: item.name, value: item.count }))} empty="No referrer data recorded." />
                </section>
                <section className="admin-panel">
                    <div className="admin-panel-heading"><div><h2>Devices</h2><p>Visitor device categories</p></div></div>
                    <RankedList items={(data?.devices || []).map((item) => ({ label: item.name, value: item.count }))} empty="No device data recorded." />
                </section>
            </div>
        </div>
    );
}

function Metric({ icon: Icon, label, value }) {
    return <article className="admin-analytics-metric"><span><Icon size={17} /></span><small>{label}</small><strong>{value.toLocaleString()}</strong></article>;
}

function RankedList({ items, empty }) {
    return items.length ? <ol className="admin-ranked-list">{items.map((item, index) => <li key={item.label}><span>{index + 1}</span><strong>{item.label}</strong><small>{item.value.toLocaleString()}</small></li>)}</ol> : <div className="admin-empty"><span><Activity size={22} /></span><p>{empty}</p></div>;
}

export default AdminAnalytics;
