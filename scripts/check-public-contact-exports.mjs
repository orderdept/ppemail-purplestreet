import { readdir } from "node:fs/promises";
import path from "node:path";

// Fail closed even for ignored files: Vercel also accepts local CLI uploads.
async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true }).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  })) {
    if (entry.name === "exports" || /suppressed[-_]addresses|campaign[-_]recipients|suppressions/i.test(entry.name)) {
      throw new Error("Public contact-list artifact detected; remove it before building.");
    }
    if (entry.isDirectory()) await check(path.join(directory, entry.name));
  }
}
await check(path.join(process.cwd(), "public"));
console.log("Public contact-list export guard passed.");
