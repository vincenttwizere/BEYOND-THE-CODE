import dotenv from "dotenv";
import { randomBytes, randomUUID, scrypt as scryptCallback, createHash, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import path from "node:path";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import express from "express";
import { JsonStore } from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const scrypt = promisify(scryptCallback);
const dataPath = process.env.DATA_FILE || path.resolve(__dirname, "data/app-db.json");
const seedPath = path.resolve(__dirname, "data/db.json");
const sessionCookie = "beyond_session";
const sessionDuration = 7 * 24 * 60 * 60 * 1000;
const passwordPattern = /^.{8,128}$/s;
const postStatuses = ["draft", "scheduled", "published", "archived"];
const slugify = (value) => value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);

const hashPassword = async (password, salt = randomBytes(16).toString("hex")) => {
  const derivedKey = await scrypt(password, salt, 64);
  return { salt, hash: derivedKey.toString("hex") };
};

const verifyPassword = async (password, salt, expectedHash) => {
  const actual = await scrypt(password, salt, 64);
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

const hashSession = (token) => createHash("sha256").update(token).digest("hex");
const safeUser = ({ id, name, email, role, createdAt, isSystemAdmin = false, status = "active" }) => ({
  id, name, email, role, createdAt, isSystemAdmin, status,
});
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

const validateCredentials = ({ name, email, password }, includeName = false) => {
  if (includeName && (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 80)) {
    return "Name must be between 2 and 80 characters.";
  }
  if (typeof email !== "string" || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return "Enter a valid email address.";
  }
  if (typeof password !== "string" || !passwordPattern.test(password)) {
    return "Password must be between 8 and 128 characters.";
  }
  return null;
};

const createSession = async (store, userId) => {
  const token = randomBytes(32).toString("hex");
  await store.update((data) => {
    const expiresAt = Date.now() + sessionDuration;
    data.sessions = data.sessions.filter((session) => session.expiresAt > Date.now());
    data.sessions.push({ tokenHash: hashSession(token), userId, expiresAt });
  });
  return token;
};

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: sessionDuration,
});

export async function provisionAdmin(store, email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await hashPassword(password);
  await store.update((data) => {
    const existing = data.users.find((user) => user.email === normalizedEmail);
    if (existing) {
      existing.role = "admin";
      existing.isSystemAdmin = true;
      existing.salt = passwordHash.salt;
      existing.hash = passwordHash.hash;
      return;
    }
    data.users.push({
      id: randomUUID(),
      name: "Administrator",
      email: normalizedEmail,
      role: "admin",
      ...passwordHash,
      isSystemAdmin: true,
      createdAt: new Date().toISOString(),
    });
  });
}

export function createApp(store) {
  const app = express();
  const failedLogins = new Map();
  const analyticsLimits = new Map();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "200kb" }));

  const requireAuth = asyncRoute(async (req, res, next) => {
    const token = req.cookies?.[sessionCookie] || req.headers.cookie
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${sessionCookie}=`))
      ?.slice(sessionCookie.length + 1);
    if (!token) {
      return res.status(401).json({ error: "Please log in to continue." });
    }

    const data = await store.getData();
    const session = /^[\da-f]{64}$/i.test(token)
      ? data.sessions.find((item) => item.tokenHash === hashSession(token))
      : null;
    const user = session && session.expiresAt > Date.now()
      ? data.users.find((item) => item.id === session.userId)
      : null;

    if (!user || ["suspended", "banned"].includes(user.status)) {
      return res.status(401).json({ error: "Your session has expired. Please log in again." });
    }
    req.user = user;
    return next();
  });

  const requireAdmin = (req, res, next) => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Administrator access is required." });
    }
    return next();
  };

  const requireAdministrator = [requireAuth, requireAdmin];
  app.use(asyncRoute(async (req, res, next) => {
    const maintenanceExempt = [
      "/api/health",
      "/api/site-settings",
      "/api/analytics/pageview",
    ];
    if (req.path.startsWith("/api/admin/") || (req.path.startsWith("/api/auth/") && req.path !== "/api/auth/signup") ||
      req.path.startsWith("/api/media/") || maintenanceExempt.includes(req.path)) {
      return next();
    }
    const { settings } = await store.getData();
    if (settings.maintenanceMode) {
      return res.status(503).json({ error: "The site is temporarily unavailable for maintenance." });
    }
    return next();
  }));
  const getDataWithDuePosts = async () => {
    const data = await store.getData();
    const now = Date.now();
    if (!data.blogs.some((blog) => blog.status === "scheduled" && blog.scheduledAt && Date.parse(blog.scheduledAt) <= now)) {
      return data;
    }
    return store.update((state) => {
      for (const blog of state.blogs) {
        if (blog.status === "scheduled" && blog.scheduledAt && Date.parse(blog.scheduledAt) <= now) {
          blog.status = "published";
          blog.published = true;
          blog.updatedAt = new Date(now).toISOString();
        }
      }
      return state;
    });
  };

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  app.get("/api/site-settings", asyncRoute(async (_req, res) => {
    const { siteName, tagline, logo, favicon, seoTitle, seoDescription, socialLinks, maintenanceMode, navigation, footerLinks } = (await store.getData()).settings;
    return res.json({ siteName, tagline, logo, favicon, seoTitle, seoDescription, socialLinks, maintenanceMode, navigation, footerLinks });
  }));

  app.get("/api/pages", asyncRoute(async (_req, res) => {
    const pages = (await store.getData()).pages;
    return res.json(pages.filter((page) => page.status === "published").map((page) => ({
      id: page.id,
      title: page.title,
      slug: page.slug,
      status: page.status,
      updatedAt: page.updatedAt,
    })));
  }));

  app.get("/api/pages/:slug", asyncRoute(async (req, res) => {
    const page = (await store.getData()).pages.find((item) => item.slug === req.params.slug && item.status === "published");
    if (!page) return res.status(404).json({ error: "This page could not be found." });
    return res.json(page);
  }));

  app.post("/api/auth/signup", asyncRoute(async (req, res) => {
    const error = validateCredentials(req.body, true);
    if (error) {
      return res.status(400).json({ error });
    }

    const email = req.body.email.trim().toLowerCase();
    const passwordHash = await hashPassword(req.body.password);
    const user = await store.update((data) => {
      if (data.users.some((item) => item.email === email)) {
        return null;
      }
      const newUser = {
        id: randomUUID(),
        name: req.body.name.trim(),
        email,
        role: "reader",
        ...passwordHash,
        createdAt: new Date().toISOString(),
      };
      data.users.push(newUser);
      return newUser;
    });

    if (!user) {
      return res.status(409).json({ error: "An account with that email already exists." });
    }
    res.cookie(sessionCookie, await createSession(store, user.id), cookieOptions());
    return res.status(201).json({ user: safeUser(user) });
  }));

  app.post("/api/auth/login", asyncRoute(async (req, res) => {
    const address = req.ip;
    const attempt = failedLogins.get(address);
    if (attempt && attempt.resetAt > Date.now() && attempt.count >= 10) {
      return res.status(429).json({ error: "Too many sign-in attempts. Please try again later." });
    }

    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body.password === "string" && req.body.password.length <= 128 ? req.body.password : "";
    const data = await store.getData();
    const user = data.users.find((item) => item.email === email);
    const valid = user
      ? await verifyPassword(password, user.salt, user.hash)
      : await verifyPassword(password || "invalid-password", "00000000000000000000000000000000", "0".repeat(128));

    if (!user || !valid) {
      const count = attempt?.resetAt > Date.now() ? attempt.count + 1 : 1;
      failedLogins.set(address, { count, resetAt: Date.now() + 15 * 60 * 1000 });
      return res.status(401).json({ error: "Email or password is incorrect." });
    }
    if (["suspended", "banned"].includes(user.status)) {
      return res.status(403).json({ error: "This account is currently disabled." });
    }

    failedLogins.delete(address);
    res.cookie(sessionCookie, await createSession(store, user.id), cookieOptions());
    return res.json({ user: safeUser(user) });
  }));

  app.get("/api/auth/me", requireAuth, (req, res) => res.json({ user: safeUser(req.user) }));

  app.patch("/api/auth/profile", requireAuth, asyncRoute(async (req, res) => {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    if (name.length < 2 || name.length > 80) {
      return res.status(400).json({ error: "Name must be between 2 and 80 characters." });
    }

    let passwordHash;
    if (req.body.newPassword !== undefined) {
      if (typeof req.body.currentPassword !== "string" || !passwordPattern.test(req.body.newPassword)) {
        return res.status(400).json({ error: "Enter your current password and a new password of 8 to 128 characters." });
      }
      if (!await verifyPassword(req.body.currentPassword, req.user.salt, req.user.hash)) {
        return res.status(400).json({ error: "Your current password is incorrect." });
      }
      passwordHash = await hashPassword(req.body.newPassword);
    }

    const user = await store.update((data) => {
      const current = data.users.find((item) => item.id === req.user.id);
      current.name = name;
      if (passwordHash) {
        current.salt = passwordHash.salt;
        current.hash = passwordHash.hash;
      }
      return current;
    });
    return res.json({ user: safeUser(user) });
  }));

  app.post("/api/auth/logout", asyncRoute(async (req, res) => {
    const token = req.headers.cookie
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${sessionCookie}=`))
      ?.slice(sessionCookie.length + 1);
    if (token) {
      await store.update((data) => {
        data.sessions = data.sessions.filter((session) => session.tokenHash !== hashSession(token));
      });
    }
    const options = cookieOptions();
    delete options.maxAge;
    res.clearCookie(sessionCookie, options);
    return res.status(204).end();
  }));

  app.get("/api/me/saved-posts", requireAuth, asyncRoute(async (req, res) => {
    const data = await store.getData();
    const savedIds = new Set(data.savedPosts.filter((item) => item.userId === req.user.id).map((item) => String(item.postId)));
    return res.json(data.blogs
      .filter((blog) => savedIds.has(String(blog.id)) && (blog.status ? blog.status === "published" : blog.published))
      .map((blog) => {
        const summary = { ...blog };
        delete summary.body;
        return summary;
      }));
  }));

  app.post("/api/me/saved-posts/:postId", requireAuth, asyncRoute(async (req, res) => {
    const data = await store.getData();
    const post = data.blogs.find((blog) => String(blog.id) === req.params.postId);
    if (!post || !(post.status ? post.status === "published" : post.published)) {
      return res.status(404).json({ error: "This post could not be found." });
    }
    await store.update((state) => {
      if (!state.savedPosts.some((item) => item.userId === req.user.id && String(item.postId) === String(post.id))) {
        state.savedPosts.push({ userId: req.user.id, postId: post.id, createdAt: new Date().toISOString() });
      }
    });
    return res.status(204).end();
  }));

  app.delete("/api/me/saved-posts/:postId", requireAuth, asyncRoute(async (req, res) => {
    await store.update((data) => {
      data.savedPosts = data.savedPosts.filter((item) => !(item.userId === req.user.id && String(item.postId) === req.params.postId));
    });
    return res.status(204).end();
  }));

  app.get("/api/blogs/:id/likes", requireAuth, asyncRoute(async (req, res) => {
    const data = await store.getData();
    const blog = data.blogs.find((item) => String(item.id) === req.params.id);
    if (!blog || !(blog.status ? blog.status === "published" : blog.published)) {
      return res.status(404).json({ error: "This post could not be found." });
    }
    const postLikes = data.likes.filter((item) => String(item.postId) === String(blog.id));
    return res.json({
      count: postLikes.length,
      isLiked: postLikes.some((item) => item.userId === req.user.id),
    });
  }));

  app.post("/api/me/liked-posts/:postId", requireAuth, asyncRoute(async (req, res) => {
    const result = await store.update((data) => {
      const blog = data.blogs.find((item) => String(item.id) === req.params.postId);
      if (!blog || !(blog.status ? blog.status === "published" : blog.published)) return null;
      if (!data.likes.some((item) => item.userId === req.user.id && String(item.postId) === String(blog.id))) {
        data.likes.push({ userId: req.user.id, postId: blog.id, createdAt: new Date().toISOString() });
      }
      const postLikes = data.likes.filter((item) => String(item.postId) === String(blog.id));
      return { count: postLikes.length, isLiked: true };
    });
    if (!result) return res.status(404).json({ error: "This post could not be found." });
    return res.json(result);
  }));

  app.delete("/api/me/liked-posts/:postId", requireAuth, asyncRoute(async (req, res) => {
    const result = await store.update((data) => {
      data.likes = data.likes.filter((item) => !(item.userId === req.user.id && String(item.postId) === req.params.postId));
      return {
        count: data.likes.filter((item) => String(item.postId) === req.params.postId).length,
        isLiked: false,
      };
    });
    return res.json(result);
  }));

  app.get("/api/blogs", asyncRoute(async (req, res) => {
    const data = await getDataWithDuePosts();
    const query = typeof req.query.q === "string" ? req.query.q.trim().toLocaleLowerCase() : "";
    const category = typeof req.query.category === "string" ? req.query.category : "";
    const blogs = data.blogs
      .filter((blog) => blog.status ? blog.status === "published" : blog.published)
      .filter((blog) => !category || blog.category === category)
      .filter((blog) => !query || `${blog.title} ${blog.body} ${blog.author} ${blog.category}`.toLocaleLowerCase().includes(query))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .map(({ body, ...blog }) => ({
        ...blog,
        excerpt: blog.excerpt || (body.length > 220 ? `${body.slice(0, 217).trimEnd()}…` : body),
        readingTime: Math.max(1, Math.ceil(body.trim().split(/\s+/).length / 200)),
      }));
    return res.json(blogs);
  }));

  app.get("/api/categories", asyncRoute(async (_req, res) => {
    const data = await store.getData();
    return res.json(data.categories
      .map((category) => ({
        ...category,
        postCount: data.blogs.filter((blog) =>
          blog.category === category.name && (blog.status ? blog.status === "published" : blog.published)
        ).length,
      }))
      .sort((left, right) => left.name.localeCompare(right.name)));
  }));

  app.get("/api/blogs/:id", requireAuth, asyncRoute(async (req, res) => {
    const data = await getDataWithDuePosts();
    const blog = data.blogs.find((item) => String(item.id) === req.params.id);
    if (!blog || (!(blog.status ? blog.status === "published" : blog.published) && req.user.role !== "admin")) {
      return res.status(404).json({ error: "This story could not be found." });
    }
    return res.json(blog);
  }));

  app.get("/api/blogs/:id/comments", asyncRoute(async (req, res) => {
    const data = await store.getData();
    const blog = data.blogs.find((item) => String(item.id) === req.params.id);
    if (!blog || !(blog.status ? blog.status === "published" : blog.published)) {
      return res.status(404).json({ error: "This post could not be found." });
    }
    return res.json(data.comments
      .filter((comment) => String(comment.postId) === req.params.id && comment.status === "approved")
      .map((comment) => ({
        id: comment.id,
        name: comment.name,
        body: comment.body,
        reply: comment.reply || "",
        createdAt: comment.createdAt,
      })));
  }));

  app.post("/api/blogs/:id/comments", requireAuth, asyncRoute(async (req, res) => {
    const data = await store.getData();
    const blog = data.blogs.find((item) => String(item.id) === req.params.id);
    if (!blog || !(blog.status ? blog.status === "published" : blog.published)) {
      return res.status(404).json({ error: "This post could not be found." });
    }
    if (data.settings.commentsEnabled === false) {
      return res.status(403).json({ error: "Comments are currently disabled." });
    }
    const body = typeof req.body.body === "string" ? req.body.body.trim() : "";
    if (body.length < 3 || body.length > 2000) {
      return res.status(400).json({ error: "Comment must be between 3 and 2,000 characters." });
    }
    const comment = {
      id: randomUUID(),
      postId: blog.id,
      userId: req.user.id,
      name: req.user.name,
      body,
      status: "pending",
      reply: "",
      createdAt: new Date().toISOString(),
    };
    await store.update((state) => state.comments.push(comment));
    return res.status(201).json({ id: comment.id, status: comment.status, createdAt: comment.createdAt });
  }));

  app.get("/api/me/comments", requireAuth, asyncRoute(async (req, res) => {
    const data = await store.getData();
    return res.json(data.comments.filter((comment) => comment.userId === req.user.id));
  }));

  app.delete("/api/me/comments/:id", requireAuth, asyncRoute(async (req, res) => {
    const result = await store.update((data) => {
      const comment = data.comments.find((item) => item.id === req.params.id);
      if (!comment) return "missing";
      if (comment.userId !== req.user.id) return "forbidden";
      data.comments = data.comments.filter((item) => item.id !== req.params.id);
      return "deleted";
    });
    if (result === "missing") return res.status(404).json({ error: "This comment could not be found." });
    if (result === "forbidden") return res.status(403).json({ error: "You can only delete your own comments." });
    return res.status(204).end();
  }));

  app.post("/api/analytics/pageview", asyncRoute(async (req, res) => {
    const now = Date.now();
    const attempt = analyticsLimits.get(req.ip);
    if (attempt && attempt.resetAt > now && attempt.count >= 60) {
      return res.status(429).json({ error: "Page view limit reached. Try again shortly." });
    }
    analyticsLimits.set(req.ip, attempt && attempt.resetAt > now
      ? { count: attempt.count + 1, resetAt: attempt.resetAt }
      : { count: 1, resetAt: now + 60_000 });

    const { path: pagePath, visitorId } = req.body;
    if (
      typeof pagePath !== "string" ||
      !pagePath.startsWith("/") ||
      pagePath.startsWith("/admin") ||
      pagePath.length > 300 ||
      typeof visitorId !== "string" ||
      !/^[\da-f-]{16,64}$/i.test(visitorId)
    ) {
      return res.status(400).json({ error: "A valid public page path and visitor ID are required." });
    }

    await store.update((data) => {
      data.analytics.push({
        id: randomUUID(),
        path: pagePath,
        visitorId,
        referrer: typeof req.body.referrer === "string" ? req.body.referrer.slice(0, 300) : "",
        device: ["mobile", "tablet", "desktop"].includes(req.body.device) ? req.body.device : "unknown",
        createdAt: new Date(now).toISOString(),
      });
    });
    return res.status(202).json({ recorded: true });
  }));

  app.get("/api/admin/overview", ...requireAdministrator, asyncRoute(async (_req, res) => {
    const data = await store.getData();
    const publishedPosts = data.blogs.filter((blog) => blog.status ? blog.status === "published" : blog.published);
    const viewsByPost = new Map();
    for (const view of data.analytics) {
      const match = view.path.match(/^\/blogs\/([^/?#]+)/);
      if (match) viewsByPost.set(match[1], (viewsByPost.get(match[1]) || 0) + 1);
    }
    const topPosts = [...viewsByPost.entries()]
      .map(([id, views]) => ({
        id,
        views,
        title: data.blogs.find((blog) => String(blog.id) === id)?.title || "Deleted post",
      }))
      .sort((left, right) => right.views - left.views)
      .slice(0, 5);
    const viewsByDay = new Map();
    for (const view of data.analytics) {
      const day = view.createdAt.slice(0, 10);
      viewsByDay.set(day, (viewsByDay.get(day) || 0) + 1);
    }
    const today = new Date();
    const lastFourteenDays = Array.from({ length: 14 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - 13 + index);
      const day = date.toISOString().slice(0, 10);
      return [day, viewsByDay.get(day) || 0];
    });
    const growthByDay = new Map();
    for (const user of data.users) {
      const day = user.createdAt?.slice(0, 10);
      if (day) growthByDay.set(day, { users: (growthByDay.get(day)?.users || 0) + 1, subscribers: growthByDay.get(day)?.subscribers || 0 });
    }
    for (const subscriber of data.subscribers) {
      const day = subscriber.createdAt?.slice(0, 10);
      if (day) growthByDay.set(day, { users: growthByDay.get(day)?.users || 0, subscribers: (growthByDay.get(day)?.subscribers || 0) + 1 });
    }
    return res.json({
      posts: data.blogs.length,
      published: publishedPosts.length,
      drafts: data.blogs.filter((blog) => (blog.status || (blog.published ? "published" : "draft")) === "draft").length,
      views: data.analytics.length,
      comments: data.comments.length,
      pendingComments: data.comments.filter((comment) => comment.status === "pending").length,
      subscribers: data.subscribers.filter((subscriber) => subscriber.status === "active").length,
      users: data.users.length,
      topPosts,
      viewsByDay: lastFourteenDays,
      growthByDay: [...growthByDay.entries()].sort(([left], [right]) => left.localeCompare(right)).slice(-14),
      recentPosts: [...data.blogs].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 5),
    });
  }));

  app.get("/api/admin/analytics", ...requireAdministrator, asyncRoute(async (req, res) => {
    const from = typeof req.query.from === "string" ? Date.parse(`${req.query.from}T00:00:00.000Z`) : NaN;
    const to = typeof req.query.to === "string" ? Date.parse(`${req.query.to}T23:59:59.999Z`) : NaN;
    if ((req.query.from && Number.isNaN(from)) || (req.query.to && Number.isNaN(to))) {
      return res.status(400).json({ error: "Enter a valid analytics date range." });
    }
    if (!Number.isNaN(from) && !Number.isNaN(to) && from > to) {
      return res.status(400).json({ error: "The start date must be before the end date." });
    }
    const data = await store.getData();
    const views = data.analytics.filter((item) => {
      const time = Date.parse(item.createdAt);
      return (Number.isNaN(from) || time >= from) && (Number.isNaN(to) || time <= to);
    });
    const pages = new Map();
    const referrers = new Map();
    const devices = new Map();
    const days = new Map();
    const visitorsByDay = new Map();
    const uniqueVisitors = new Set();
    for (const view of views) {
      const page = view.path.split("?")[0];
      pages.set(page, (pages.get(page) || 0) + 1);
      devices.set(view.device || "unknown", (devices.get(view.device || "unknown") || 0) + 1);
      if (view.referrer) {
        try {
          const host = new URL(view.referrer).hostname;
          referrers.set(host, (referrers.get(host) || 0) + 1);
        } catch {
          referrers.set("Other", (referrers.get("Other") || 0) + 1);
        }
      }
      const day = view.createdAt.slice(0, 10);
      days.set(day, (days.get(day) || 0) + 1);
      uniqueVisitors.add(view.visitorId);
      if (!visitorsByDay.has(day)) visitorsByDay.set(day, new Set());
      visitorsByDay.get(day).add(view.visitorId);
    }
    const series = [...days.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([day, count]) => ({
      day,
      views: count,
      visitors: visitorsByDay.get(day)?.size || 0,
    }));
    return res.json({
      views: views.length,
      visitors: uniqueVisitors.size,
      topPages: [...pages.entries()].map(([path, count]) => ({ path, views: count })).sort((a, b) => b.views - a.views).slice(0, 10),
      referrers: [...referrers.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10),
      devices: [...devices.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      series,
    });
  }));

  app.post("/api/newsletter/subscribe", asyncRoute(async (req, res) => {
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || req.body.consent !== true) {
      return res.status(400).json({ error: "Enter a valid email address and confirm newsletter consent." });
    }
    if (typeof req.body.website === "string" && req.body.website.trim()) {
      return res.status(400).json({ error: "The subscription could not be completed." });
    }
    const subscriber = await store.update((data) => {
      const current = data.subscribers.find((item) => item.email === email);
      if (current && current.status !== "unsubscribed") return null;
      const updated = current || { id: randomUUID(), email, createdAt: new Date().toISOString() };
      updated.status = "pending";
      updated.unsubscribeToken = randomBytes(24).toString("hex");
      updated.updatedAt = new Date().toISOString();
      if (!current) data.subscribers.push(updated);
      return { id: updated.id, email: updated.email, status: updated.status };
    });
    if (!subscriber) return res.status(409).json({ error: "This email address is already subscribed." });
    return res.status(201).json({ subscriber });
  }));

  app.post("/api/newsletter/unsubscribe", asyncRoute(async (req, res) => {
    if (typeof req.body.token !== "string" || !/^[\da-f]{48}$/i.test(req.body.token)) {
      return res.status(400).json({ error: "A valid unsubscribe link is required." });
    }
    const updated = await store.update((data) => {
      const subscriber = data.subscribers.find((item) => item.unsubscribeToken === req.body.token);
      if (!subscriber) return false;
      subscriber.status = "unsubscribed";
      subscriber.updatedAt = new Date().toISOString();
      return true;
    });
    if (!updated) return res.status(404).json({ error: "This unsubscribe link is invalid or expired." });
    return res.status(200).json({ unsubscribed: true });
  }));

  app.get("/api/admin/blogs", ...requireAdministrator, asyncRoute(async (_req, res) => {
    const data = await getDataWithDuePosts();
    return res.json(data.blogs.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
  }));

  const validateBlog = (body) => {
    if (typeof body.title !== "string" || body.title.trim().length < 3 || body.title.trim().length > 120) {
      return "Title must be between 3 and 120 characters.";
    }
    if (typeof body.author !== "string" || body.author.trim().length < 2 || body.author.trim().length > 80) {
      return "Author must be between 2 and 80 characters.";
    }
    if (typeof body.category !== "string" || body.category.trim().length < 2 || body.category.trim().length > 100) {
      return "Choose a valid category.";
    }
    if (typeof body.body !== "string" || body.body.trim().length < 50 || body.body.length > 100000) {
      return "Story must be between 50 and 100,000 characters.";
    }
    if (body.published !== undefined && typeof body.published !== "boolean") {
      return "Published status must be true or false.";
    }
    if (body.status !== undefined && !postStatuses.includes(body.status)) {
      return "Choose a valid post status.";
    }
    if (body.slug !== undefined && (typeof body.slug !== "string" || body.slug.length > 120 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug))) {
      return "Slug must contain lowercase letters, numbers, and hyphens.";
    }
    if (body.excerpt !== undefined && (typeof body.excerpt !== "string" || body.excerpt.length > 500)) {
      return "Excerpt cannot exceed 500 characters.";
    }
    if (body.tags !== undefined && (!Array.isArray(body.tags) || body.tags.length > 30 || body.tags.some((tag) => typeof tag !== "string" || tag.length > 50))) {
      return "Tags must be a list of up to 30 short labels.";
    }
    for (const field of ["metaTitle", "metaDescription", "ogImage", "featuredImage"]) {
      if (body[field] !== undefined && (typeof body[field] !== "string" || body[field].length > (field === "metaDescription" ? 320 : 500))) {
        return `Invalid ${field} value.`;
      }
    }
    if (body.scheduledAt !== undefined && body.scheduledAt !== null && (typeof body.scheduledAt !== "string" || Number.isNaN(Date.parse(body.scheduledAt)))) {
      return "Enter a valid scheduled publishing date.";
    }
    return null;
  };

  app.post("/api/admin/blogs", ...requireAdministrator, asyncRoute(async (req, res) => {
    const error = validateBlog(req.body);
    if (error) {
      return res.status(400).json({ error });
    }
    const now = new Date().toISOString();
    const status = req.body.status || (req.body.published === false ? "draft" : "published");
    const blog = {
      id: randomUUID(),
      title: req.body.title.trim(),
      slug: req.body.slug?.trim() || slugify(req.body.title.trim()),
      author: req.body.author.trim(),
      category: req.body.category.trim(),
      body: req.body.body.trim(),
      excerpt: req.body.excerpt?.trim() || req.body.body.trim().slice(0, 180),
      tags: req.body.tags || [],
      metaTitle: req.body.metaTitle?.trim() || "",
      metaDescription: req.body.metaDescription?.trim() || "",
      ogImage: req.body.ogImage?.trim() || "",
      featuredImage: req.body.featuredImage?.trim() || "",
      scheduledAt: req.body.scheduledAt || null,
      status,
      published: status === "published",
      createdAt: now,
      updatedAt: now,
    };
    await store.update((data) => {
      data.blogs.push(blog);
      for (const tag of blog.tags) {
        if (!data.tags.some((item) => item.name.toLowerCase() === tag.toLowerCase())) {
          data.tags.push({ id: randomUUID(), name: tag, slug: slugify(tag) });
        }
      }
    });
    return res.status(201).json(blog);
  }));

  app.patch("/api/admin/blogs/:id", ...requireAdministrator, asyncRoute(async (req, res) => {
    const data = await store.getData();
    const current = data.blogs.find((item) => String(item.id) === req.params.id);
    if (!current) {
      return res.status(404).json({ error: "This story could not be found." });
    }
    const updated = { ...current, ...req.body };
    updated.status = req.body.status && (req.body.status !== "published" || req.body.published !== false)
      ? req.body.status
      : req.body.published !== undefined
        ? req.body.published ? "published" : "draft"
        : current.status || (current.published ? "published" : "draft");
    updated.published = updated.status === "published";
    const error = validateBlog(updated);
    if (error) {
      return res.status(400).json({ error });
    }
    const blog = await store.update((state) => {
      const index = state.blogs.findIndex((item) => String(item.id) === req.params.id);
      state.blogs[index] = {
        ...state.blogs[index],
        title: updated.title.trim(),
        slug: updated.slug?.trim() || slugify(updated.title.trim()),
        author: updated.author.trim(),
        category: updated.category.trim(),
        body: updated.body.trim(),
        excerpt: updated.excerpt?.trim() || updated.body.trim().slice(0, 180),
        tags: updated.tags || [],
        metaTitle: updated.metaTitle?.trim() || "",
        metaDescription: updated.metaDescription?.trim() || "",
        ogImage: updated.ogImage?.trim() || "",
        featuredImage: updated.featuredImage?.trim() || "",
        scheduledAt: updated.scheduledAt || null,
        status: updated.status,
        published: updated.status === "published",
        updatedAt: new Date().toISOString(),
      };
      for (const tag of updated.tags) {
        if (!state.tags.some((item) => item.name.toLowerCase() === tag.toLowerCase())) {
          state.tags.push({ id: randomUUID(), name: tag, slug: slugify(tag) });
        }
      }
      return state.blogs[index];
    });
    return res.json(blog);
  }));

  app.delete("/api/admin/blogs/:id", ...requireAdministrator, asyncRoute(async (req, res) => {
    const removed = await store.update((data) => {
      const index = data.blogs.findIndex((item) => String(item.id) === req.params.id);
      return index < 0 ? false : Boolean(data.blogs.splice(index, 1).length);
    });
    if (!removed) {
      return res.status(404).json({ error: "This story could not be found." });
    }
    return res.status(204).end();
  }));

  app.get("/api/admin/users", ...requireAdministrator, asyncRoute(async (_req, res) => {
    const data = await store.getData();
    return res.json(data.users.map(safeUser).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  }));

  app.get("/api/admin/comments", ...requireAdministrator, asyncRoute(async (_req, res) => {
    const data = await store.getData();
    return res.json([...data.comments]
      .map((comment) => ({
        ...comment,
        postTitle: data.blogs.find((blog) => String(blog.id) === String(comment.postId))?.title || "Deleted post",
      }))
      .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt)));
  }));

  app.get("/api/admin/subscribers", ...requireAdministrator, asyncRoute(async (_req, res) => {
    const data = await store.getData();
    return res.json(data.subscribers.map((subscriber) => {
      const safeSubscriber = { ...subscriber };
      delete safeSubscriber.unsubscribeToken;
      return safeSubscriber;
    })
      .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt)));
  }));

  app.patch("/api/admin/subscribers/:id", ...requireAdministrator, asyncRoute(async (req, res) => {
    if (!["active", "pending", "unsubscribed"].includes(req.body.status)) {
      return res.status(400).json({ error: "Choose a valid subscriber status." });
    }
    const updated = await store.update((data) => {
      const subscriber = data.subscribers.find((item) => item.id === req.params.id);
      if (!subscriber) return null;
      subscriber.status = req.body.status;
      subscriber.updatedAt = new Date().toISOString();
      return subscriber;
    });
    if (!updated) return res.status(404).json({ error: "This subscriber could not be found." });
    const safeSubscriber = { ...updated };
    delete safeSubscriber.unsubscribeToken;
    return res.json(safeSubscriber);
  }));

  app.delete("/api/admin/subscribers/:id", ...requireAdministrator, asyncRoute(async (req, res) => {
    const removed = await store.update((data) => {
      const before = data.subscribers.length;
      data.subscribers = data.subscribers.filter((item) => item.id !== req.params.id);
      return before !== data.subscribers.length;
    });
    if (!removed) return res.status(404).json({ error: "This subscriber could not be found." });
    return res.status(204).end();
  }));

  app.get("/api/admin/newsletters", ...requireAdministrator, asyncRoute(async (_req, res) => {
    const data = await store.getData();
    return res.json([...data.newsletters].sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt)));
  }));

  app.post("/api/admin/newsletters", ...requireAdministrator, asyncRoute(async (req, res) => {
    const subject = typeof req.body.subject === "string" ? req.body.subject.trim() : "";
    const body = typeof req.body.body === "string" ? req.body.body.trim() : "";
    if (subject.length < 3 || subject.length > 160 || body.length < 10 || body.length > 20000) {
      return res.status(400).json({ error: "Subject must be 3–160 characters and message 10–20,000 characters." });
    }
    const now = new Date().toISOString();
    const newsletter = {
      id: randomUUID(),
      subject,
      body,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    };
    await store.update((data) => data.newsletters.push(newsletter));
    return res.status(201).json(newsletter);
  }));

  app.patch("/api/admin/newsletters/:id", ...requireAdministrator, asyncRoute(async (req, res) => {
    const subject = typeof req.body.subject === "string" ? req.body.subject.trim() : "";
    const body = typeof req.body.body === "string" ? req.body.body.trim() : "";
    if (subject.length < 3 || subject.length > 160 || body.length < 10 || body.length > 20000) {
      return res.status(400).json({ error: "Subject must be 3–160 characters and message 10–20,000 characters." });
    }
    const updated = await store.update((data) => {
      const item = data.newsletters.find((newsletter) => newsletter.id === req.params.id);
      if (!item) return null;
      if (item.status === "sent") return false;
      item.subject = subject;
      item.body = body;
      item.updatedAt = new Date().toISOString();
      return item;
    });
    if (updated === false) return res.status(409).json({ error: "Sent newsletters cannot be edited." });
    if (!updated) return res.status(404).json({ error: "This newsletter could not be found." });
    return res.json(updated);
  }));

  app.delete("/api/admin/newsletters/:id", ...requireAdministrator, asyncRoute(async (req, res) => {
    const result = await store.update((data) => {
      const index = data.newsletters.findIndex((item) => item.id === req.params.id);
      if (index < 0) return "missing";
      if (data.newsletters[index].status === "sent") return "sent";
      data.newsletters.splice(index, 1);
      return "deleted";
    });
    if (result === "missing") return res.status(404).json({ error: "This newsletter could not be found." });
    if (result === "sent") return res.status(409).json({ error: "Sent newsletters cannot be deleted." });
    return res.status(204).end();
  }));

  app.post("/api/admin/newsletters/:id/send", ...requireAdministrator, (_req, res) => {
    return res.status(503).json({ error: "Newsletter delivery is not configured. Add a server-side email provider before sending." });
  });

  app.get("/api/admin/pages", ...requireAdministrator, asyncRoute(async (_req, res) => {
    return res.json((await store.getData()).pages);
  }));

  const mediaDirectory = path.resolve(path.dirname(store.filePath), "media");
  const mediaTypes = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
  const isImageBuffer = (type, buffer) => {
    if (type === "image/jpeg") return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    if (type === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (type === "image/gif") return buffer.subarray(0, 3).toString() === "GIF";
    return type === "image/webp" && buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP";
  };
  app.get("/api/admin/media", ...requireAdministrator, asyncRoute(async (_req, res) => {
    return res.json([...(await store.getData()).media].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt)));
  }));
  app.post("/api/admin/media", ...requireAdministrator, express.raw({ type: "image/*", limit: "5mb" }), asyncRoute(async (req, res) => {
    const type = req.headers["content-type"]?.split(";")[0].toLowerCase();
    const extension = mediaTypes[type];
    if (!extension || !Buffer.isBuffer(req.body) || !isImageBuffer(type, req.body)) {
      return res.status(400).json({ error: "Upload a non-empty JPEG, PNG, WebP, or GIF image." });
    }
    const altText = typeof req.headers["x-alt-text"] === "string" ? req.headers["x-alt-text"].trim().slice(0, 300) : "";
    const id = randomUUID();
    const filename = `${id}.${extension}`;
    await mkdir(mediaDirectory, { recursive: true });
    await writeFile(path.join(mediaDirectory, filename), req.body, { flag: "wx", mode: 0o600 });
    const item = {
      id,
      filename,
      mimeType: type,
      size: req.body.length,
      altText,
      url: `/api/media/${id}/file`,
      createdAt: new Date().toISOString(),
    };
    try {
      await store.update((data) => data.media.unshift(item));
    } catch (error) {
      await unlink(path.join(mediaDirectory, filename));
      throw error;
    }
    return res.status(201).json(item);
  }));
  app.patch("/api/admin/media/:id", ...requireAdministrator, asyncRoute(async (req, res) => {
    if (typeof req.body.altText !== "string" || req.body.altText.length > 300) {
      return res.status(400).json({ error: "Alt text must be 300 characters or fewer." });
    }
    const item = await store.update((data) => {
      const current = data.media.find((entry) => entry.id === req.params.id);
      if (!current) return null;
      current.altText = req.body.altText.trim();
      return current;
    });
    if (!item) return res.status(404).json({ error: "This media item could not be found." });
    return res.json(item);
  }));
  app.delete("/api/admin/media/:id", ...requireAdministrator, asyncRoute(async (req, res) => {
    const item = await store.update((data) => {
      const index = data.media.findIndex((entry) => entry.id === req.params.id);
      if (index < 0) return null;
      return data.media.splice(index, 1)[0];
    });
    if (!item) return res.status(404).json({ error: "This media item could not be found." });
    try {
      await unlink(path.join(mediaDirectory, item.filename));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    return res.status(204).end();
  }));
  app.get("/api/media/:id/file", asyncRoute(async (req, res) => {
    const item = (await store.getData()).media.find((entry) => entry.id === req.params.id);
    if (!item || !mediaTypes[item.mimeType]) return res.status(404).json({ error: "This media item could not be found." });
    res.set("Content-Type", item.mimeType);
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Cache-Control", "public, max-age=86400");
    return res.sendFile(path.join(mediaDirectory, item.filename));
  }));

  const validatePage = (body) => {
    if (typeof body.title !== "string" || body.title.trim().length < 2 || body.title.trim().length > 120) {
      return "Page title must be between 2 and 120 characters.";
    }
    if (typeof body.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug) || body.slug.length > 120) {
      return "Enter a valid page slug.";
    }
    if (typeof body.body !== "string" || body.body.length > 100000) {
      return "Page content cannot exceed 100,000 characters.";
    }
    if (!["draft", "published"].includes(body.status)) {
      return "Page status must be draft or published.";
    }
    return null;
  };

  app.post("/api/admin/pages", ...requireAdministrator, asyncRoute(async (req, res) => {
    const error = validatePage(req.body);
    if (error) return res.status(400).json({ error });
    const page = { id: randomUUID(), title: req.body.title.trim(), slug: req.body.slug, body: req.body.body, status: req.body.status, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const result = await store.update((data) => {
      if (data.pages.some((item) => item.slug === page.slug)) return false;
      data.pages.unshift(page);
      return page;
    });
    if (!result) return res.status(409).json({ error: "A page with this slug already exists." });
    return res.status(201).json(result);
  }));

  app.patch("/api/admin/pages/:id", ...requireAdministrator, asyncRoute(async (req, res) => {
    const error = validatePage(req.body);
    if (error) return res.status(400).json({ error });
    const result = await store.update((data) => {
      const current = data.pages.find((item) => item.id === req.params.id);
      if (!current) return "missing";
      if (data.pages.some((item) => item.id !== current.id && item.slug === req.body.slug)) return "duplicate";
      Object.assign(current, { title: req.body.title.trim(), slug: req.body.slug, body: req.body.body, status: req.body.status, updatedAt: new Date().toISOString() });
      return current;
    });
    if (result === "missing") return res.status(404).json({ error: "This page could not be found." });
    if (result === "duplicate") return res.status(409).json({ error: "A page with this slug already exists." });
    return res.json(result);
  }));

  app.delete("/api/admin/pages/:id", ...requireAdministrator, asyncRoute(async (req, res) => {
    const removed = await store.update((data) => {
      const before = data.pages.length;
      data.pages = data.pages.filter((item) => item.id !== req.params.id);
      return before !== data.pages.length;
    });
    if (!removed) return res.status(404).json({ error: "This page could not be found." });
    return res.status(204).end();
  }));

  app.get("/api/admin/settings", ...requireAdministrator, asyncRoute(async (_req, res) => {
    return res.json((await store.getData()).settings);
  }));

  app.patch("/api/admin/settings", ...requireAdministrator, asyncRoute(async (req, res) => {
    const { siteName, tagline, logo, favicon, seoTitle, seoDescription, socialLinks, commentsEnabled, maintenanceMode, navigation, footerLinks } = req.body;
    if (typeof siteName !== "string" || siteName.trim().length < 2 || siteName.length > 120) return res.status(400).json({ error: "Site name must be between 2 and 120 characters." });
    if (typeof tagline !== "string" || tagline.length > 240) return res.status(400).json({ error: "Tagline cannot exceed 240 characters." });
    const validAsset = (value) => typeof value === "string" && value.length <= 500 && (!value || value.startsWith("/api/media/") || /^https?:\/\//i.test(value));
    if (!validAsset(logo) || !validAsset(favicon)) return res.status(400).json({ error: "Logo and favicon must be a media URL or an HTTP(S) URL." });
    if (typeof seoTitle !== "string" || seoTitle.length > 160 || typeof seoDescription !== "string" || seoDescription.length > 320) return res.status(400).json({ error: "SEO defaults are too long." });
    if (typeof commentsEnabled !== "boolean" || typeof maintenanceMode !== "boolean") return res.status(400).json({ error: "Comment and maintenance settings must be enabled or disabled." });
    const validLinks = (links) => Array.isArray(links) && links.length <= 20 && links.every((link) =>
      link && typeof link.label === "string" && link.label.trim().length >= 1 && link.label.length <= 60 &&
      typeof link.href === "string" && link.href.length <= 300 &&
      (link.href.startsWith("/") || /^https?:\/\//i.test(link.href))
    );
    if (!socialLinks || typeof socialLinks !== "object" || Array.isArray(socialLinks) ||
      Object.values(socialLinks).some((value) => typeof value !== "string" || value.length > 300 || (value && !/^https?:\/\//i.test(value))) ||
      !validLinks(navigation) || !validLinks(footerLinks)) {
      return res.status(400).json({ error: "Enter valid social URLs and navigation links." });
    }
    const settings = await store.update((data) => {
      data.settings = { ...data.settings, siteName: siteName.trim(), tagline: tagline.trim(), logo, favicon, seoTitle: seoTitle.trim(), seoDescription: seoDescription.trim(), socialLinks, commentsEnabled, maintenanceMode, navigation, footerLinks };
      return data.settings;
    });
    return res.json(settings);
  }));

  app.patch("/api/admin/comments/bulk", ...requireAdministrator, asyncRoute(async (req, res) => {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || ids.length > 100 || !["approved", "rejected", "spam"].includes(status)) {
      return res.status(400).json({ error: "Choose up to 100 comments and a valid moderation status." });
    }
    const updated = await store.update((data) => {
      for (const comment of data.comments) if (ids.includes(comment.id)) comment.status = status;
      return data.comments.filter((comment) => ids.includes(comment.id));
    });
    return res.json(updated);
  }));

  app.delete("/api/admin/comments/bulk", ...requireAdministrator, asyncRoute(async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length > 100) {
      return res.status(400).json({ error: "Choose up to 100 comments to delete." });
    }
    await store.update((data) => {
      data.comments = data.comments.filter((comment) => !ids.includes(comment.id));
    });
    return res.status(204).end();
  }));

  app.patch("/api/admin/comments/:id", ...requireAdministrator, asyncRoute(async (req, res) => {
    if (req.body.status !== undefined && !["pending", "approved", "rejected", "spam"].includes(req.body.status)) {
      return res.status(400).json({ error: "Choose a valid moderation status." });
    }
    if (req.body.reply !== undefined && (typeof req.body.reply !== "string" || req.body.reply.length > 2000)) {
      return res.status(400).json({ error: "Replies cannot exceed 2,000 characters." });
    }
    const comment = await store.update((data) => {
      const item = data.comments.find((entry) => entry.id === req.params.id);
      if (!item) return null;
      if (req.body.status !== undefined) item.status = req.body.status;
      if (req.body.reply !== undefined) item.reply = req.body.reply.trim();
      return item;
    });
    if (!comment) return res.status(404).json({ error: "This comment could not be found." });
    return res.json({ ...comment, postTitle: (await store.getData()).blogs.find((blog) => String(blog.id) === String(comment.postId))?.title || "Deleted post" });
  }));

  app.delete("/api/admin/comments/:id", ...requireAdministrator, asyncRoute(async (req, res) => {
    const removed = await store.update((data) => {
      const before = data.comments.length;
      data.comments = data.comments.filter((comment) => comment.id !== req.params.id);
      return before !== data.comments.length;
    });
    if (!removed) return res.status(404).json({ error: "This comment could not be found." });
    return res.status(204).end();
  }));

  app.patch("/api/admin/users/:id", ...requireAdministrator, asyncRoute(async (req, res) => {
    if (req.body.role !== undefined && !["reader", "admin"].includes(req.body.role)) {
      return res.status(400).json({ error: "Role must be reader or admin." });
    }
    if (req.body.status !== undefined && !["active", "suspended", "banned"].includes(req.body.status)) {
      return res.status(400).json({ error: "Status must be active, suspended, or banned." });
    }
    if (req.body.role === undefined && req.body.status === undefined) {
      return res.status(400).json({ error: "Provide a role or account status to update." });
    }
    if (req.params.id === req.user.id && (req.body.role !== undefined || req.body.status !== undefined && req.body.status !== "active")) {
      return res.status(400).json({ error: "You cannot change your own administrator account." });
    }

    const updated = await store.update((data) => {
      const user = data.users.find((item) => item.id === req.params.id);
      if (!user) {
        return null;
      }
      if (user.isSystemAdmin && (req.body.role === "reader" || ["suspended", "banned"].includes(req.body.status))) {
        return false;
      }
      if (req.body.role !== undefined) user.role = req.body.role;
      if (req.body.status !== undefined) user.status = req.body.status;
      if (req.body.role === "reader" || ["suspended", "banned"].includes(req.body.status)) {
        data.sessions = data.sessions.filter((session) => session.userId !== user.id);
      }
      return user;
    });
    if (updated === false) {
      return res.status(400).json({ error: "The configured administrator cannot be demoted or suspended." });
    }
    if (!updated) {
      return res.status(404).json({ error: "This user could not be found." });
    }
    return res.json(safeUser(updated));
  }));

  app.delete("/api/admin/users/:id", ...requireAdministrator, asyncRoute(async (req, res) => {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: "You cannot delete your own account." });
    }
    const removed = await store.update((data) => {
      const user = data.users.find((item) => item.id === req.params.id);
      if (!user) {
        return "missing";
      }
      if (user.isSystemAdmin) {
        return "protected";
      }
      if (user.role === "admin" && data.users.filter((item) => item.role === "admin").length <= 1) {
        return "last-admin";
      }
      data.users = data.users.filter((item) => item.id !== user.id);
      data.sessions = data.sessions.filter((session) => session.userId !== user.id);
      return "deleted";
    });
    if (removed !== "deleted") {
      const messages = {
        missing: [404, "This user could not be found."],
        protected: [400, "The configured administrator cannot be deleted."],
        "last-admin": [400, "The last administrator cannot be deleted."],
      };
      const [status, error] = messages[removed];
      return res.status(status).json({ error });
    }
    return res.status(204).end();
  }));

  const taxonomyList = (data, key) => data[key].map((item) => ({
    ...item,
    postCount: data.blogs.filter((blog) => key === "categories"
      ? blog.category === item.name
      : (blog.tags || []).includes(item.name)).length,
  })).sort((left, right) => left.name.localeCompare(right.name));
  const validateTaxonomy = (body) => {
    if (typeof body.name !== "string" || body.name.trim().length < 2 || body.name.trim().length > 60) {
      return "Name must be between 2 and 60 characters.";
    }
    return null;
  };
  for (const key of ["categories", "tags"]) {
    const route = key === "categories" ? "categories" : "tags";
    app.get(`/api/admin/${route}`, ...requireAdministrator, asyncRoute(async (_req, res) => {
      return res.json(taxonomyList(await store.getData(), key));
    }));
    app.post(`/api/admin/${route}`, ...requireAdministrator, asyncRoute(async (req, res) => {
      const error = validateTaxonomy(req.body);
      if (error) return res.status(400).json({ error });
      const name = req.body.name.trim();
      const item = await store.update((data) => {
        if (data[key].some((entry) => entry.name.toLowerCase() === name.toLowerCase())) return null;
        const created = { id: randomUUID(), name, slug: slugify(name) };
        data[key].push(created);
        return created;
      });
      if (!item) return res.status(409).json({ error: `A ${key === "categories" ? "category" : "tag"} with that name already exists.` });
      return res.status(201).json({ ...item, postCount: 0 });
    }));
    app.patch(`/api/admin/${route}/:id`, ...requireAdministrator, asyncRoute(async (req, res) => {
      const error = validateTaxonomy(req.body);
      if (error) return res.status(400).json({ error });
      const name = req.body.name.trim();
      const item = await store.update((data) => {
        const current = data[key].find((entry) => entry.id === req.params.id);
        if (!current) return "missing";
        if (data[key].some((entry) => entry.id !== current.id && entry.name.toLowerCase() === name.toLowerCase())) return "duplicate";
        const previousName = current.name;
        current.name = name;
        current.slug = slugify(name);
        if (key === "categories") {
          for (const blog of data.blogs) if (blog.category === previousName) blog.category = name;
        } else {
          for (const blog of data.blogs) blog.tags = (blog.tags || []).map((tag) => tag === previousName ? name : tag);
        }
        return current;
      });
      if (item === "missing") return res.status(404).json({ error: "This item could not be found." });
      if (item === "duplicate") return res.status(409).json({ error: "An item with that name already exists." });
      const data = await store.getData();
      return res.json({ ...item, postCount: taxonomyList(data, key).find((entry) => entry.id === item.id)?.postCount || 0 });
    }));
    app.delete(`/api/admin/${route}/:id`, ...requireAdministrator, asyncRoute(async (req, res) => {
      const result = await store.update((data) => {
        const index = data[key].findIndex((entry) => entry.id === req.params.id);
        if (index < 0) return "missing";
        const item = data[key][index];
        const count = key === "categories"
          ? data.blogs.filter((blog) => blog.category === item.name).length
          : data.blogs.filter((blog) => (blog.tags || []).includes(item.name)).length;
        if (key === "categories" && count > 0) return "in-use";
        data[key].splice(index, 1);
        if (key === "tags") {
          for (const blog of data.blogs) blog.tags = (blog.tags || []).filter((tag) => tag !== item.name);
        }
        return "deleted";
      });
      if (result === "missing") return res.status(404).json({ error: "This item could not be found." });
      if (result === "in-use") return res.status(409).json({ error: "This category is used by posts. Reassign those posts before deleting it." });
      return res.status(204).end();
    }));
  }

  app.use((req, res) => res.status(404).json({ error: "Route not found." }));
  app.use((error, _req, res, _next) => {
    void _next;
    console.error(error);
    if (res.headersSent) {
      return;
    }
    if (error.type === "entity.parse.failed") {
      return res.status(400).json({ error: "Request body must be valid JSON." });
    }
    return res.status(500).json({ error: "An unexpected server error occurred." });
  });
  return app;
}

async function start() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword || !passwordPattern.test(adminPassword)) {
    throw new Error("Set ADMIN_EMAIL and an ADMIN_PASSWORD of 8 to 128 characters before starting the server.");
  }

  const store = new JsonStore(dataPath, seedPath);
  await store.init();
  await provisionAdmin(store, adminEmail, adminPassword);
  const port = Number(process.env.API_PORT || 8000);
  createApp(store).listen(port, () => {
    console.log(`BEYOND API listening on http://localhost:${port}`);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  start().catch((error) => {
    console.error("API startup failed:", error.message);
    process.exitCode = 1;
  });
}
