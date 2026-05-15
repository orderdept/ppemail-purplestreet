import { readFile } from "node:fs/promises";
import path from "node:path";
import tls from "node:tls";

import { getConvexSuppressions, replaceConvexSuppressions, type SuppressionSource } from "./convex-server";

const DEFAULT_SMTP_USER = "support@purpleprices.com";
const DELAYED_SUBJECT = "Delayed Mail (still being retried)";
const BOUNCED_FOLDER = "BOUNCED";
const DELAYED_FOLDER = "DELAYED";
const UNSUB_FOLDER = "UNSUB";
const BOUNCED_SUBJECT_PREFIXES = [
  "undeliver",
  "mail system error - returned mail with subject:",
];
const BOUNCED_SUBJECT_EXACT = new Set([
  "failure notice",
  "delivery status notification (failure)",
]);

type SuppressionMap = Map<
  string,
  { email: string; source: SuppressionSource; note?: string }
>;

function currentDataRoot() {
  return path.join(process.cwd(), "data", "purple-prices");
}

function normalizeEmail(value: string) {
  const trimmed = String(value || "").trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed) ? trimmed : "";
}

function headerValue(rawHeaders: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = rawHeaders.match(new RegExp(`^${escaped}:\\s*([\\s\\S]*?)(?:\\r?\\n[^ \\t]|$)`, "im"));
  if (!match) return "";
  return match[1].replace(/\r?\n[ \t]+/g, " ").trim();
}

function classifyNoticeSubject(subject: string) {
  const value = String(subject || "").trim();
  const lowered = value.toLowerCase();
  if (lowered === DELAYED_SUBJECT.toLowerCase()) return DELAYED_FOLDER;
  if (/\bunsubscribe\b/i.test(value)) return UNSUB_FOLDER;
  if (BOUNCED_SUBJECT_EXACT.has(lowered)) return BOUNCED_FOLDER;
  if (BOUNCED_SUBJECT_PREFIXES.some((prefix) => lowered.startsWith(prefix))) return BOUNCED_FOLDER;
  return "";
}

function candidateEmails(value: string) {
  const matches = String(value || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  return matches.map(normalizeEmail).filter(Boolean);
}

function firstEmailInText(value: string) {
  return candidateEmails(value)[0] || "";
}

function extractFailedRecipients(rawMessage: string) {
  const recipients: string[] = [];
  const seen = new Set<string>();
  const remember = (email: string) => {
    const normalized = normalizeEmail(email);
    if (
      !normalized ||
      normalized === DEFAULT_SMTP_USER ||
      normalized.startsWith("postmaster@") ||
      normalized.startsWith("mailer-daemon@") ||
      seen.has(normalized)
    ) {
      return;
    }
    seen.add(normalized);
    recipients.push(normalized);
  };

  const chunks = rawMessage.split(/\r?\n\r?\n/);
  for (const chunk of chunks) {
    const action = chunk.match(/Action:\s*([A-Za-z-]+)/i)?.[1]?.toLowerCase();
    if (action !== "failed") continue;
    for (const pattern of [
      /(?:Final|Original)-Recipient:\s*rfc822;\s*([^\s]+)/gi,
      /X-Failed-Recipients:\s*([^\r\n]+)/gi,
    ]) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(chunk))) {
        for (const email of candidateEmails(match[1])) remember(email);
      }
    }
  }

  for (const pattern of [
    /<([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})>:\s*(?:\r?\n|$)/gi,
    /^\s*To:\s*(.+)$/gim,
  ]) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(rawMessage))) {
      for (const email of candidateEmails(match[1])) remember(email);
    }
  }

  if (recipients.length) return recipients;

  for (const email of candidateEmails(rawMessage)) {
    const [localPart, domain = ""] = email.split("@");
    if (domain.endsWith(".internal")) continue;
    if (/^[0-9]{8,}(?:\.[A-Z0-9_-]+)?$/i.test(localPart)) continue;
    remember(email);
  }

  return recipients;
}

class SimpleImapClient {
  private socket: tls.TLSSocket | null = null;
  private buffer = Buffer.alloc(0);
  private tag = 0;

  async connect() {
    const host = process.env.PP_EMAIL_IMAP_HOST || "imap.qboxmail.com";
    const port = Number(process.env.PP_EMAIL_IMAP_PORT || "993");
    const username = process.env.PP_EMAIL_IMAP_USERNAME || DEFAULT_SMTP_USER;
    const password = process.env.PP_EMAIL_IMAP_PASSWORD || "";
    if (!password) {
      throw new Error("PP_EMAIL_IMAP_PASSWORD is not configured.");
    }

    this.socket = tls.connect({
      host,
      port,
      servername: host,
    });
    this.socket.on("data", (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
    });

    await new Promise<void>((resolve, reject) => {
      this.socket?.once("secureConnect", () => resolve());
      this.socket?.once("error", reject);
    });
    await this.readGreeting();
    await this.command(`LOGIN ${this.quote(username)} ${this.quote(password)}`);
  }

  async ensureFolder(folderName: string) {
    const list = await this.command("LIST \"\" *");
    const exists = list.lines.some((line) => line.includes(`"${folderName}"`) || line.endsWith(` ${folderName}`));
    if (!exists) {
      try {
        await this.command(`CREATE ${this.quote(folderName)}`);
      } catch {
        // Folder may have raced into existence.
      }
    }
  }

  async select(mailbox: string) {
    await this.command(`SELECT ${this.quote(mailbox)}`);
  }

  async searchAllUids() {
    const result = await this.command("UID SEARCH ALL");
    const searchLine = result.lines.find((line) => line.startsWith("* SEARCH")) || "";
    return searchLine
      .replace("* SEARCH", "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  }

  async fetchMessage(uid: string) {
    const result = await this.command(`UID FETCH ${uid} (BODY.PEEK[])`);
    return result.literals.join("");
  }

  async move(uidSet: string, folderName: string) {
    try {
      await this.command(`UID MOVE ${uidSet} ${this.quote(folderName)}`);
    } catch {
      await this.command(`UID COPY ${uidSet} ${this.quote(folderName)}`);
      await this.command(`UID STORE ${uidSet} +FLAGS.SILENT (\\Deleted)`);
      await this.command("EXPUNGE");
    }
  }

  async logout() {
    if (!this.socket) return;
    try {
      await this.command("LOGOUT");
    } catch {
      // Ignore logout issues.
    }
    this.socket.end();
    this.socket.destroy();
    this.socket = null;
  }

  private quote(value: string) {
    return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }

  private async readGreeting() {
    while (true) {
      const line = await this.readLine();
      if (line.startsWith("* ")) return;
    }
  }

  private async command(command: string) {
    if (!this.socket) throw new Error("IMAP socket is not connected.");
    const tag = `A${String(++this.tag).padStart(4, "0")}`;
    this.socket.write(`${tag} ${command}\r\n`);
    return await this.readResponse(tag);
  }

  private async readResponse(tag: string) {
    const lines: string[] = [];
    const literals: string[] = [];

    while (true) {
      const line = await this.readLine();
      lines.push(line);
      const literalMatch = line.match(/\{(\d+)\}$/);
      if (literalMatch) {
        literals.push((await this.readBytes(Number(literalMatch[1]))).toString("utf8"));
      }
      if (line.startsWith(`${tag} `)) {
        if (!/\bOK\b/i.test(line)) {
          throw new Error(line);
        }
        return { lines, literals };
      }
    }
  }

  private async readLine() {
    while (true) {
      const index = this.buffer.indexOf("\r\n");
      if (index >= 0) {
        const line = this.buffer.subarray(0, index).toString("utf8");
        this.buffer = this.buffer.subarray(index + 2);
        return line;
      }
      await this.waitForData();
    }
  }

  private async readBytes(length: number) {
    while (this.buffer.length < length) {
      await this.waitForData();
    }
    const chunk = this.buffer.subarray(0, length);
    this.buffer = this.buffer.subarray(length);
    return chunk;
  }

  private async waitForData() {
    await new Promise<void>((resolve, reject) => {
      if (!this.socket) {
        reject(new Error("IMAP socket is not connected."));
        return;
      }
      const onData = () => {
        cleanup();
        resolve();
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const onClose = () => {
        cleanup();
        reject(new Error("IMAP connection closed."));
      };
      const cleanup = () => {
        this.socket?.off("data", onData);
        this.socket?.off("error", onError);
        this.socket?.off("close", onClose);
      };
      this.socket.on("data", onData);
      this.socket.once("error", onError);
      this.socket.once("close", onClose);
    });
  }
}

async function fileSuppressionsMap() {
  const raw = await readFile(path.join(currentDataRoot(), "suppressions.json"), "utf8");
  const items = JSON.parse(raw) as string[];
  const map: SuppressionMap = new Map();
  for (const email of items.map(normalizeEmail).filter(Boolean)) {
    map.set(email, { email, source: "import" });
  }
  return map;
}

async function mergedSuppressionMap() {
  const map = await fileSuppressionsMap();
  const live = await getConvexSuppressions();
  for (const row of live || []) {
    map.set(row.email, {
      email: row.email,
      source: row.source,
      note: row.note,
    });
  }
  return map;
}

export async function runPurplePricesBounceImport() {
  const suppressions = await mergedSuppressionMap();
  const client = new SimpleImapClient();
  let bounceCount = 0;
  let delayedCount = 0;
  let unsubscribeCount = 0;
  let movedCount = 0;
  let movedDelayedCount = 0;
  let movedUnsubCount = 0;

  try {
    await client.connect();
    await client.ensureFolder(BOUNCED_FOLDER);
    await client.ensureFolder(DELAYED_FOLDER);
    await client.ensureFolder(UNSUB_FOLDER);
    await client.select("INBOX");
    const uids = await client.searchAllUids();

    const buckets: Record<string, string[]> = {
      [BOUNCED_FOLDER]: [],
      [DELAYED_FOLDER]: [],
      [UNSUB_FOLDER]: [],
    };

    for (const uid of uids) {
      const rawMessage = await client.fetchMessage(uid);
      const [rawHeaders] = rawMessage.split(/\r?\n\r?\n/, 1);
      const subject = headerValue(rawHeaders || rawMessage, "Subject");
      const folderName = classifyNoticeSubject(subject);
      if (!folderName) continue;

      buckets[folderName].push(uid);

      if (folderName === BOUNCED_FOLDER) {
        const recipients = extractFailedRecipients(rawMessage);
        for (const email of recipients) {
          suppressions.set(email, { email, source: "bounce" });
        }
        bounceCount += recipients.length;
      }

      if (folderName === DELAYED_FOLDER) {
        delayedCount += 1;
      }

      if (folderName === UNSUB_FOLDER) {
        const email =
          firstEmailInText(headerValue(rawHeaders || rawMessage, "Reply-To")) ||
          firstEmailInText(headerValue(rawHeaders || rawMessage, "From")) ||
          firstEmailInText(headerValue(rawHeaders || rawMessage, "Sender"));
        if (email && email !== DEFAULT_SMTP_USER) {
          suppressions.set(email, {
            email,
            source: "unsubscribe",
            note: "Reply with UNSUBSCRIBE in subject",
          });
          unsubscribeCount += 1;
        }
      }
    }

    if (buckets[BOUNCED_FOLDER].length) {
      await client.move(buckets[BOUNCED_FOLDER].join(","), BOUNCED_FOLDER);
      movedCount = buckets[BOUNCED_FOLDER].length;
    }
    if (buckets[DELAYED_FOLDER].length) {
      await client.move(buckets[DELAYED_FOLDER].join(","), DELAYED_FOLDER);
      movedDelayedCount = buckets[DELAYED_FOLDER].length;
    }
    if (buckets[UNSUB_FOLDER].length) {
      await client.move(buckets[UNSUB_FOLDER].join(","), UNSUB_FOLDER);
      movedUnsubCount = buckets[UNSUB_FOLDER].length;
    }

    const suppressionItems = [...suppressions.values()].sort((left, right) =>
      left.email.localeCompare(right.email),
    );
    await replaceConvexSuppressions(suppressionItems);

    return {
      suppressionCount: suppressionItems.length,
      bounceCount,
      delayedCount,
      unsubscribeCount,
      movedCount,
      movedDelayedCount,
      movedUnsubCount,
    };
  } finally {
    await client.logout();
  }
}
