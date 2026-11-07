import dotenv from "dotenv";
import { randomBytes, randomUUID, scrypt as scryptCallback, createHash, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import path from "node:path";
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
const safeUser = ({ id, name, email, role, createdAt, isSystemAdmin = false }) => ({
  id, name, email, role, createdAt, isSystemAdmin,
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

    if (!user) {
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

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

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

    failedLogins.delete(address);
    res.cookie(sessionCookie, await createSession(store, user.id), cookieOptions());
    return res.json({ user: safeUser(user) });
  }));

  app.get("/api/auth/me", requireAuth, (req, res) => res.json({ user: safeUser(req.user) }));

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

  app.get("/api/blogs", asyncRoute(async (req, res) => {
    const data = await store.getData();
    const query = typeof req.query.q === "string" ? req.query.q.trim().toLocaleLowerCase() : "";
    const category = typeof req.query.category === "string" ? req.query.category : "";
    const blogs = data.blogs
      .filter((blog) => blog.published)
      .filter((blog) => !category || blog.category === category)
      .filter((blog) => !query || `${blog.title} ${blog.body} ${blog.author} ${blog.category}`.toLocaleLowerCase().includes(query))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .map(({ body, ...blog }) => ({
        ...blog,
        excerpt: body.length > 220 ? `${body.slice(0, 217).trimEnd()}…` : body,
        readingTime: Math.max(1, Math.ceil(body.trim().split(/\s+/).length / 200)),
      }));
    return res.json(blogs);
  }));

  app.get("/api/blogs/:id", requireAuth, asyncRoute(async (req, res) => {
    const data = await store.getData();
    const blog = data.blogs.find((item) => String(item.id) === req.params.id);
    if (!blog || (!blog.published && req.user.role !== "admin")) {
      return res.status(404).json({ error: "This story could not be found." });
    }
    return res.json(blog);
  }));

  app.get("/api/admin/blogs", ...requireAdministrator, asyncRoute(async (_req, res) => {
    const data = await store.getData();
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
    return null;
  };

  app.post("/api/admin/blogs", ...requireAdministrator, asyncRoute(async (req, res) => {
    const error = validateBlog(req.body);
    if (error) {
      return res.status(400).json({ error });
    }
    const now = new Date().toISOString();
    const blog = {
      id: randomUUID(),
      title: req.body.title.trim(),
      author: req.body.author.trim(),
      category: req.body.category.trim(),
      body: req.body.body.trim(),
      published: req.body.published ?? true,
      createdAt: now,
      updatedAt: now,
    };
    await store.update((data) => data.blogs.push(blog));
    return res.status(201).json(blog);
  }));

  app.patch("/api/admin/blogs/:id", ...requireAdministrator, asyncRoute(async (req, res) => {
    const data = await store.getData();
    const current = data.blogs.find((item) => String(item.id) === req.params.id);
    if (!current) {
      return res.status(404).json({ error: "This story could not be found." });
    }
    const updated = { ...current, ...req.body };
    const error = validateBlog(updated);
    if (error) {
      return res.status(400).json({ error });
    }
    const blog = await store.update((state) => {
      const index = state.blogs.findIndex((item) => String(item.id) === req.params.id);
      state.blogs[index] = {
        ...state.blogs[index],
        title: updated.title.trim(),
        author: updated.author.trim(),
        category: updated.category.trim(),
        body: updated.body.trim(),
        published: updated.published,
        updatedAt: new Date().toISOString(),
      };
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

  app.patch("/api/admin/users/:id", ...requireAdministrator, asyncRoute(async (req, res) => {
    if (!["reader", "admin"].includes(req.body.role)) {
      return res.status(400).json({ error: "Role must be reader or admin." });
    }
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: "You cannot change your own administrator account." });
    }

    const updated = await store.update((data) => {
      const user = data.users.find((item) => item.id === req.params.id);
      if (!user) {
        return null;
      }
      if (user.isSystemAdmin && req.body.role !== "admin") {
        return false;
      }
      user.role = req.body.role;
      if (req.body.role !== "admin") {
        data.sessions = data.sessions.filter((session) => session.userId !== user.id);
      }
      return user;
    });
    if (updated === false) {
      return res.status(400).json({ error: "The configured administrator cannot be demoted." });
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
