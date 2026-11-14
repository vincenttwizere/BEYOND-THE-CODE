import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { createApp, provisionAdmin } from "../index.js";
import { JsonStore } from "../store.js";

let directory;
let store;
let server;
let baseUrl;
const adminEmail = "admin@example.test";
const adminPassword = "A-secure-admin-password";

before(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "beyond-api-"));
    const seedPath = path.join(directory, "seed.json");
    await writeFile(seedPath, JSON.stringify({
        blogs: [{
            id: 1,
            title: "A thoughtful seeded story",
            author: "Editorial Team",
            category: "Ideas",
            body: "A complete story body that should only be available to authenticated readers. " + "A useful sentence. ".repeat(5),
        }],
    }));
    store = new JsonStore(path.join(directory, "app-db.json"), seedPath);
    await store.init();
    await provisionAdmin(store, adminEmail, adminPassword);
    server = createApp(store).listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    if (server) {
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
    if (directory) {
        await rm(directory, { recursive: true, force: true });
    }
});

const request = (route, options = {}) => fetch(`${baseUrl}${route}`, options);
const json = (body) => JSON.stringify(body);

test("reader and administrator access is enforced across the CMS API", async () => {
    const publicResponse = await request("/api/blogs");
    assert.equal(publicResponse.status, 200);
    const [summary] = await publicResponse.json();
    assert.equal(summary.title, "A thoughtful seeded story");
    assert.equal("body" in summary, false);

    const anonymousDetail = await request("/api/blogs/1");
    assert.equal(anonymousDetail.status, 401);

    const signupResponse = await request("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: json({ name: "Reader Person", email: "reader@example.test", password: "reader-password-1" }),
    });
    assert.equal(signupResponse.status, 201);
    const readerCookie = signupResponse.headers.get("set-cookie").split(";")[0];
    const { user: reader } = await signupResponse.json();
    assert.equal(reader.role, "reader");

    const detailResponse = await request("/api/blogs/1", { headers: { cookie: readerCookie } });
    assert.equal(detailResponse.status, 200);
    assert.match((await detailResponse.json()).body, /complete story body/);
    assert.equal((await request("/api/admin/blogs", { headers: { cookie: readerCookie } })).status, 403);
    assert.equal((await request("/api/admin/overview", { headers: { cookie: readerCookie } })).status, 403);
    assert.equal((await request("/api/admin/categories", { headers: { cookie: readerCookie } })).status, 403);
    assert.equal((await request("/api/admin/comments", { headers: { cookie: readerCookie } })).status, 403);

    assert.equal((await request("/api/blogs/1/likes")).status, 401);
    const initialLikes = await request("/api/blogs/1/likes", { headers: { cookie: readerCookie } });
    assert.deepEqual(await initialLikes.json(), { count: 0, isLiked: false });
    const likeResponse = await request("/api/me/liked-posts/1", {
        method: "POST",
        headers: { cookie: readerCookie },
    });
    assert.deepEqual(await likeResponse.json(), { count: 1, isLiked: true });
    const duplicateLike = await request("/api/me/liked-posts/1", {
        method: "POST",
        headers: { cookie: readerCookie },
    });
    assert.deepEqual(await duplicateLike.json(), { count: 1, isLiked: true });
    assert.deepEqual(await (await request("/api/blogs/1/likes", { headers: { cookie: readerCookie } })).json(), { count: 1, isLiked: true });
    const unlikeResponse = await request("/api/me/liked-posts/1", {
        method: "DELETE",
        headers: { cookie: readerCookie },
    });
    assert.deepEqual(await unlikeResponse.json(), { count: 0, isLiked: false });

    const duplicateSignup = await request("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: json({ name: "Another Reader", email: "reader@example.test", password: "reader-password-1", role: "admin" }),
    });
    assert.equal(duplicateSignup.status, 409);

    const loginResponse = await request("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: json({ email: adminEmail, password: adminPassword }),
    });
    assert.equal(loginResponse.status, 200);
    const adminCookie = loginResponse.headers.get("set-cookie").split(";")[0];

    const commentResponse = await request("/api/blogs/1/comments", {
        method: "POST",
        headers: { cookie: readerCookie, "content-type": "application/json" },
        body: json({ body: "A useful and thoughtful comment." }),
    });
    assert.equal(commentResponse.status, 201);
    const comment = await commentResponse.json();
    assert.equal(comment.status, "pending");
    assert.deepEqual(await (await request("/api/blogs/1/comments")).json(), []);
    const approvedComment = await request(`/api/admin/comments/${comment.id}`, {
        method: "PATCH",
        headers: { cookie: adminCookie, "content-type": "application/json" },
        body: json({ status: "approved", reply: "Thank you for reading." }),
    });
    assert.equal(approvedComment.status, 200);
    assert.equal((await (await request("/api/blogs/1/comments")).json())[0].reply, "Thank you for reading.");

    assert.equal((await request("/api/me/saved-posts/1", {
        method: "POST",
        headers: { cookie: readerCookie },
    })).status, 204);
    const savedPosts = await request("/api/me/saved-posts", { headers: { cookie: readerCookie } });
    assert.equal((await savedPosts.json())[0].title, "A thoughtful seeded story");
    assert.equal((await request("/api/me/saved-posts/1", {
        method: "DELETE",
        headers: { cookie: readerCookie },
    })).status, 204);

    const viewResponse = await request("/api/analytics/pageview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: json({ path: "/blogs/1", visitorId: "123e4567-e89b-12d3-a456-426614174000", device: "desktop" }),
    });
    assert.equal(viewResponse.status, 202);
    const overviewResponse = await request("/api/admin/overview", { headers: { cookie: adminCookie } });
    assert.equal(overviewResponse.status, 200);
    assert.equal((await overviewResponse.json()).views, 1);
    const analyticsResponse = await request("/api/admin/analytics", { headers: { cookie: adminCookie } });
    assert.equal((await analyticsResponse.json()).views, 1);

    const signupNewsletter = await request("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: json({ email: "subscriber@example.test", consent: true, website: "" }),
    });
    assert.equal(signupNewsletter.status, 201);
    const { subscriber } = await signupNewsletter.json();
    assert.equal(subscriber.status, "pending");
    const subscriberList = await request("/api/admin/subscribers", { headers: { cookie: adminCookie } });
    assert.equal(subscriberList.status, 200);
    assert.equal("unsubscribeToken" in (await subscriberList.json())[0], false);
    const activateSubscriber = await request(`/api/admin/subscribers/${subscriber.id}`, {
        method: "PATCH",
        headers: { cookie: adminCookie, "content-type": "application/json" },
        body: json({ status: "active" }),
    });
    assert.equal(activateSubscriber.status, 200);

    const newsletterResponse = await request("/api/admin/newsletters", {
        method: "POST",
        headers: { cookie: adminCookie, "content-type": "application/json" },
        body: json({ subject: "A thoughtful update", body: "A message for our newsletter subscribers." }),
    });
    assert.equal(newsletterResponse.status, 201);
    const newsletter = await newsletterResponse.json();
    assert.equal((await request(`/api/admin/newsletters/${newsletter.id}/send`, {
        method: "POST",
        headers: { cookie: adminCookie },
    })).status, 503);

    const pageResponse = await request("/api/admin/pages", {
        method: "POST",
        headers: { cookie: adminCookie, "content-type": "application/json" },
        body: json({ title: "Privacy", slug: "privacy", body: "Our privacy policy.", status: "published" }),
    });
    assert.equal(pageResponse.status, 201);
    assert.equal((await request("/api/pages/privacy")).status, 200);

    const storedSettings = await (await request("/api/admin/settings", { headers: { cookie: adminCookie } })).json();
    const maintenanceSettings = await request("/api/admin/settings", {
        method: "PATCH",
        headers: { cookie: adminCookie, "content-type": "application/json" },
        body: json({ ...storedSettings, maintenanceMode: true }),
    });
    assert.equal(maintenanceSettings.status, 200);
    assert.equal((await request("/api/blogs")).status, 503);
    assert.equal((await request("/api/admin/blogs", { headers: { cookie: adminCookie } })).status, 200);
    assert.equal((await request("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: json({ name: "Blocked Reader", email: "blocked@example.test", password: "blocked-password-1" }),
    })).status, 503);
    assert.equal((await request("/api/admin/settings", {
        method: "PATCH",
        headers: { cookie: adminCookie, "content-type": "application/json" },
        body: json({ ...storedSettings, maintenanceMode: false }),
    })).status, 200);

    const mediaResponse = await request("/api/admin/media", {
        method: "POST",
        headers: { cookie: adminCookie, "content-type": "image/png", "x-alt-text": "A test image" },
        body: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    });
    assert.equal(mediaResponse.status, 201);
    const media = await mediaResponse.json();
    const imageResponse = await request(media.url);
    assert.equal(imageResponse.status, 200);
    assert.match(imageResponse.headers.get("content-type"), /image\/png/);
    assert.equal((await request(`/api/admin/media/${media.id}`, {
        method: "DELETE",
        headers: { cookie: adminCookie },
    })).status, 204);

    const categoryResponse = await request("/api/admin/categories", {
        method: "POST",
        headers: { cookie: adminCookie, "content-type": "application/json" },
        body: json({ name: "New category" }),
    });
    assert.equal(categoryResponse.status, 201);
    const category = await categoryResponse.json();
    assert.equal((await request(`/api/admin/categories/${category.id}`, {
        method: "DELETE",
        headers: { cookie: adminCookie },
    })).status, 204);

    assert.equal((await request(`/api/me/comments/${comment.id}`, {
        method: "DELETE",
        headers: { cookie: readerCookie },
    })).status, 204);

    const createdResponse = await request("/api/admin/blogs", {
        method: "POST",
        headers: { cookie: adminCookie, "content-type": "application/json" },
        body: json({
            title: "A new admin story",
            author: "The Editor",
            category: "Ideas",
            body: "This is a new story body with enough detail to satisfy the API validation rules and publish it.",
            published: true,
        }),
    });
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json();

    const draftResponse = await request(`/api/admin/blogs/${created.id}`, {
        method: "PATCH",
        headers: { cookie: adminCookie, "content-type": "application/json" },
        body: json({ ...created, published: false }),
    });
    assert.equal(draftResponse.status, 200);
    assert.equal((await request(`/api/blogs/${created.id}`, { headers: { cookie: readerCookie } })).status, 404);
    assert.equal((await request(`/api/blogs/${created.id}`, { headers: { cookie: adminCookie } })).status, 200);

    const roleResponse = await request(`/api/admin/users/${reader.id}`, {
        method: "PATCH",
        headers: { cookie: adminCookie, "content-type": "application/json" },
        body: json({ role: "admin" }),
    });
    assert.equal(roleResponse.status, 200);
    assert.equal((await roleResponse.json()).role, "admin");
    const profileResponse = await request("/api/auth/profile", {
        method: "PATCH",
        headers: { cookie: readerCookie, "content-type": "application/json" },
        body: json({ name: "Reader Renamed", currentPassword: "reader-password-1", newPassword: "reader-password-2" }),
    });
    assert.equal(profileResponse.status, 200);
    assert.equal((await profileResponse.json()).user.name, "Reader Renamed");
    const suspendUser = await request(`/api/admin/users/${reader.id}`, {
        method: "PATCH",
        headers: { cookie: adminCookie, "content-type": "application/json" },
        body: json({ status: "suspended" }),
    });
    assert.equal(suspendUser.status, 200);
    assert.equal((await request("/api/auth/me", { headers: { cookie: readerCookie } })).status, 401);
    const blockedLogin = await request("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: json({ email: "reader@example.test", password: "reader-password-2" }),
    });
    assert.equal(blockedLogin.status, 403);

    const systemAdmin = (await (await request("/api/admin/users", { headers: { cookie: adminCookie } })).json())
        .find((user) => user.email === adminEmail);
    const protectedDelete = await request(`/api/admin/users/${systemAdmin.id}`, {
        method: "DELETE",
        headers: { cookie: adminCookie },
    });
    assert.equal(protectedDelete.status, 400);

    const deleteStory = await request(`/api/admin/blogs/${created.id}`, {
        method: "DELETE",
        headers: { cookie: adminCookie },
    });
    assert.equal(deleteStory.status, 204);

    const logoutResponse = await request("/api/auth/logout", {
        method: "POST",
        headers: { cookie: adminCookie },
    });
    assert.equal(logoutResponse.status, 204);
    assert.match(logoutResponse.headers.get("set-cookie"), /Expires=Thu, 01 Jan 1970/);
    assert.equal((await request("/api/auth/me", { headers: { cookie: adminCookie } })).status, 401);
});
