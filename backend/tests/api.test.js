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
