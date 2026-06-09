import { promises as fs } from "node:fs";
import path from "node:path";
import type { Dataset } from "./types";

/** Pluggable persistence for the single dataset document. */
export interface Storage {
  read(): Promise<Dataset | null>;
  write(dataset: Dataset): Promise<void>;
}

const BLOB_PATH = "tms/dataset.json";

/** Local-file backend for development (no Blob token). Gitignored file. */
function fileStorage(): Storage {
  const file = path.join(process.cwd(), "data", "dataset.local.json");
  return {
    async read() {
      try {
        return JSON.parse(await fs.readFile(file, "utf8")) as Dataset;
      } catch {
        return null;
      }
    },
    async write(dataset) {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, JSON.stringify(dataset, null, 2), "utf8");
    },
  };
}

/** Vercel Blob backend for production. */
function blobStorage(): Storage {
  return {
    async read() {
      const { list } = await import("@vercel/blob");
      const { blobs } = await list({ prefix: BLOB_PATH });
      const found = blobs.find((b) => b.pathname === BLOB_PATH);
      if (!found) return null;
      const res = await fetch(found.url, { cache: "no-store" });
      if (!res.ok) return null;
      return (await res.json()) as Dataset;
    },
    async write(dataset) {
      const { put } = await import("@vercel/blob");
      await put(BLOB_PATH, JSON.stringify(dataset), {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
    },
  };
}

/**
 * GitHub Gist backend — alternative to Vercel Blob.
 * Requires env vars: GIST_ID and GITHUB_TOKEN (classic PAT with "gist" scope).
 * Setup: https://gist.github.com → create secret gist with one file "dataset.json"
 *        containing {} → copy the gist ID from the URL.
 */
function gistStorage(gistId: string, token: string): Storage {
  const API = `https://api.github.com/gists/${gistId}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
  return {
    async read() {
      try {
        const res = await fetch(API, { headers, cache: "no-store" });
        if (!res.ok) return null;
        const gist = (await res.json()) as { files: Record<string, { content: string }> };
        const content = gist.files["dataset.json"]?.content;
        if (!content || content.trim() === "{}") return null;
        return JSON.parse(content) as Dataset;
      } catch {
        return null;
      }
    },
    async write(dataset) {
      const res = await fetch(API, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          files: { "dataset.json": { content: JSON.stringify(dataset) } },
        }),
      });
      if (!res.ok) {
        const err = await res.text().catch(() => res.statusText);
        throw new Error(`Gist write failed (${res.status}): ${err}`);
      }
    },
  };
}

export function getStorage(): Storage {
  if (process.env.BLOB_READ_WRITE_TOKEN) return blobStorage();
  if (process.env.GIST_ID && process.env.GITHUB_TOKEN)
    return gistStorage(process.env.GIST_ID, process.env.GITHUB_TOKEN);
  return fileStorage();
}
