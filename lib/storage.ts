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

export function getStorage(): Storage {
  return process.env.BLOB_READ_WRITE_TOKEN ? blobStorage() : fileStorage();
}
