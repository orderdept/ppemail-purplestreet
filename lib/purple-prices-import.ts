import { readFile } from "node:fs/promises";
import path from "node:path";
import tls from "node:tls";

import { getConvexSuppressions, replaceConvexSuppressions, type SuppressionSource } from "./convex-server";

const DEFAULT_SMTP_USER = "support@purpleprices.com";
const DELAYED_SUBJECT = "Delayed Mail (still being retried)";
const BOUNCED_FOLDER = "BOUNCED";
const DELAYED_FOLDER = "DELAYED";
const UNSUB_FOLDER = "UNSUB";
const IMAP_READ_TIMEOUT_MS = 25000;
const MAX_IMPORT_SCAN_UIDS = 300;
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

async function readCampaignRecipients() {
  try {
    const raw = await readFile(path.join(currentDataRoot(), "campaign-recipients.json"), "utf8");
    const data = JSON.parse(raw) as { campaignId?: string | null; subject?: string; emails?: string[] };
    return {
      campaignId: data.campaignId || null,
      subject: String(data.subject || ""),
      emails: new Set((data.emails || []).map(normalizeEmail).filter(Boolean)),
    };
  } catch {
    return {
      campaignId: null,
      subject: "",
      emails: new Set<string>(),
    };
  }
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

function campaignSubjectMatchesNotice(rawMessage: string, campaignSubject?: string) {
  const value = String(campaignSubject || "").trim().toLowerCase();
  if (!value) return true;
  const originalSubject = extractOriginalMessageSubject(rawMessage);
  return originalSubject ? originalSubject.toLowerCase() === value : false;
}

function extractOriginalMessageSubject(rawMessage: string) {
  const text = String(rawMessage || "");
  const returnedMailSubject = text.match(/returned mail with subject:\s*(.+)$/im)?.[1]?.trim();
  if (returnedMailSubject) return returnedMailSubject;
  const originalSubject = text.match(/^Original-Subject:\s*(.+)$/im)?.[1]?.trim();
  if (originalSubject) return originalSubject;
  const subjectLines = [...text.matchAll(/^Subject:\s*(.+)$/gim)]
    .map((match) => String(match[1] || "").trim())
    .filter(Boolean);
  return subjectLines[1] || "";
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

  async connect(overrides: { password?: string; username?: string } = {}) {
    const host = process.env.PP_EMAIL_IMAP_HOST || "imap.qboxmail.com";
    const port = Number(process.env.PP_EMAIL_IMAP_PORT || "993");
    const username =
      overrides.username?.trim().toLowerCase() ||
      process.env.PP_EMAIL_IMAP_USERNAME ||
      DEFAULT_SMTP_USER;
    const password = overrides.password?.trim() || process.env.PP_EMAIL_IMAP_PASSWORD || "";
    if (!password) {
      throw new Error("Enter the mailbox password in Step 3 before importing bounces.");
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

  async resolveFolderName(baseName: string) {
    const list = await this.command("LIST \"\" *");
    const inboxFolder = `INBOX.${baseName}`;

    if (list.lines.some((line) => line.includes(`"${inboxFolder}"`) || line.endsWith(` ${inboxFolder}`))) {
      return inboxFolder;
    }
    if (list.lines.some((line) => line.includes(`"${baseName}"`) || line.endsWith(` ${baseName}`))) {
      return baseName;
    }

    const inboxLine = list.lines.find((line) => /\s"INBOX"$/i.test(line) || /\sINBOX$/i.test(line));
    const delimiter = inboxLine?.match(/\* LIST \([^)]+\) "([^"]+)" /)?.[1] || ".";
    if (inboxLine) {
      return `INBOX${delimiter}${baseName}`;
    }

    return baseName;
  }

  async select(mailbox: string) {
    await this.command(`SELECT ${this.quote(mailbox)}`);
  }

  async searchAllUids() {
    const result = await this.command("UID SEARCH ALL");
    const searchLine = result.lines.find((line) => line.startsWith("* SEARCH")) || "";
    const uids = searchLine
      .replace("* SEARCH", "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    return uids.slice(-MAX_IMPORT_SCAN_UIDS);
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
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("IMAP server took too long to respond. Try Import Bounces again in a moment."));
      }, IMAP_READ_TIMEOUT_MS);
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
        clearTimeout(timer);
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

export async function runPurplePricesBounceImport(
  campaignSubject?: string,
  overrides: { password?: string; username?: string } = {},
) {
  const suppressions = await mergedSuppressionMap();
  const campaignRecipients = await readCampaignRecipients();
  const client = new SimpleImapClient();
  let bounceCount = 0;
  let delayedCount = 0;
  let unsubscribeCount = 0;
  let movedCount = 0;
  let movedDelayedCount = 0;
  let movedUnsubCount = 0;

  try {
    await client.connect(overrides);
    const bouncedFolder = await client.resolveFolderName(BOUNCED_FOLDER);
    const delayedFolder = await client.resolveFolderName(DELAYED_FOLDER);
    const unsubFolder = await client.resolveFolderName(UNSUB_FOLDER);
    await client.ensureFolder(bouncedFolder);
    await client.ensureFolder(delayedFolder);
    await client.ensureFolder(unsubFolder);
    await client.select("INBOX");
    const uids = await client.searchAllUids();

    const buckets: Record<string, string[]> = {
      [bouncedFolder]: [],
      [delayedFolder]: [],
      [unsubFolder]: [],
    };

    for (const uid of uids) {
      const rawMessage = await client.fetchMessage(uid);
      const [rawHeaders] = rawMessage.split(/\r?\n\r?\n/, 1);
      const subject = headerValue(rawHeaders || rawMessage, "Subject");
      const noticeType = classifyNoticeSubject(subject);
      if (!noticeType) continue;
      const folderName =
        noticeType === BOUNCED_FOLDER ? bouncedFolder : noticeType === DELAYED_FOLDER ? delayedFolder : unsubFolder;
      if (
        (noticeType === BOUNCED_FOLDER || noticeType === DELAYED_FOLDER) &&
        !campaignSubjectMatchesNotice(rawMessage, campaignSubject)
      ) {
        continue;
      }

      if (noticeType === BOUNCED_FOLDER) {
        const recipients = extractFailedRecipients(rawMessage);
        const campaignOnlyRecipients = campaignRecipients.emails.size
          ? recipients.filter((email) => campaignRecipients.emails.has(email))
          : recipients;
        if (!campaignOnlyRecipients.length) {
          continue;
        }
        buckets[folderName].push(uid);
        for (const email of campaignOnlyRecipients) {
          suppressions.set(email, { email, source: "bounce" });
        }
        bounceCount += campaignOnlyRecipients.length;
      }

      if (noticeType === DELAYED_FOLDER) {
        const recipients = extractFailedRecipients(rawMessage);
        const campaignOnlyRecipients = campaignRecipients.emails.size
          ? recipients.filter((email) => campaignRecipients.emails.has(email))
          : recipients;
        if (!campaignOnlyRecipients.length) {
          continue;
        }
        buckets[folderName].push(uid);
        delayedCount += 1;
      }

      if (noticeType === UNSUB_FOLDER) {
        buckets[folderName].push(uid);
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

    if (buckets[bouncedFolder].length) {
      await client.move(buckets[bouncedFolder].join(","), bouncedFolder);
      movedCount = buckets[bouncedFolder].length;
    }
    if (buckets[delayedFolder].length) {
      await client.move(buckets[delayedFolder].join(","), delayedFolder);
      movedDelayedCount = buckets[delayedFolder].length;
    }
    if (buckets[unsubFolder].length) {
      await client.move(buckets[unsubFolder].join(","), unsubFolder);
      movedUnsubCount = buckets[unsubFolder].length;
    }

    const suppressionItems = [...suppressions.values()].sort((left, right) =>
      left.email.localeCompare(right.email),
    );
    await replaceConvexSuppressions(suppressionItems);

    return {
      suppressionCount: suppressionItems.length,
      campaignSubject: String(campaignSubject || ""),
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
