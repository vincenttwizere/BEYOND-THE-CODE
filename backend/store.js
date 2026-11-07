import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const clone = (value) => structuredClone(value);

export class JsonStore {
  constructor(filePath, seedPath) {
    this.filePath = filePath;
    this.seedPath = seedPath;
    this.data = null;
    this.queue = Promise.resolve();
  }

  async init() {
    await mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      this.data = JSON.parse(await readFile(this.filePath, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }

      let seed = { blogs: [] };
      try {
        seed = JSON.parse(await readFile(this.seedPath, "utf8"));
      } catch (seedError) {
        if (seedError.code !== "ENOENT") {
          throw seedError;
        }
      }

      const now = new Date().toISOString();
      this.data = {
        blogs: (seed.blogs || []).map((blog) => ({
          ...blog,
          id: blog.id ?? randomUUID(),
          published: true,
          createdAt: blog.createdAt || now,
          updatedAt: blog.updatedAt || now,
        })),
        users: [],
        sessions: [],
      };
      await this.write(this.data);
    }

    this.data.blogs ||= [];
    this.data.users ||= [];
    this.data.sessions ||= [];
  }

  async getData() {
    return clone(this.data);
  }

  async update(mutator) {
    const operation = this.queue.then(async () => {
      const next = clone(this.data);
      const result = await mutator(next);
      await this.write(next);
      this.data = next;
      return clone(result);
    });

    this.queue = operation.catch(() => {});
    return operation;
  }

  async write(data) {
    const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
    await rename(temporaryPath, this.filePath);
  }
}
