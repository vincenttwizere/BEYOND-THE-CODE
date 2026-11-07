export async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        credentials: "same-origin",
        headers: {
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...options.headers,
        },
    });

    if (response.status === 204) {
        return null;
    }

    const responseBody = await response.text();
    let payload = {};
    if (responseBody) {
        try {
            payload = JSON.parse(responseBody);
        } catch {
            throw new Error("The server returned an invalid response.");
        }
    }
    if (!response.ok) {
        throw new Error(payload.error || "The request could not be completed.");
    }
    return payload;
}
