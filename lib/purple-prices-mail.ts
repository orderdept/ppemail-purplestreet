import crypto from "node:crypto";
import net from "node:net";
import tls from "node:tls";

import { type CampaignDraft, type CampaignMessage } from "./purple-prices-types";

type SecurityMode = "ssl" | "starttls";

type MailRecipient = {
  email: string;
  name: string;
};

type HostedSmtpConfig = {
  host: string;
  port: number;
  security: SecurityMode;
  username: string;
  password: string;
  fromName: string;
};

type SocketLike = net.Socket | tls.TLSSocket;

function base64(value: string) {
  return Buffer.from(value, "utf8").toString("base64");
}

function personalize(template: string, contact: MailRecipient) {
  const name = contact.name || contact.email.split("@")[0] || "Purple Peeps";
  return String(template || "")
    .replaceAll("{{name}}", name)
    .replaceAll("{{email}}", contact.email);
}

function htmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function htmlParagraphs(text: string) {
  return String(text || "")
    .trim()
    .split(/\n\s*\n+/)
    .filter(Boolean)
    .map((block) => {
      const lines = block
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => htmlEscape(line))
        .join("<br />");
      return `<p style="margin:0 0 14px 0;">${lines}</p>`;
    })
    .join("");
}

function buildHtmlBody(message: CampaignMessage, contact: MailRecipient) {
  const preview = htmlEscape(message.previewText || "");
  const body = htmlParagraphs(personalize(message.body, contact));
  const address = String(message.mailingAddress || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => htmlEscape(line))
    .join("<br />");

  return `<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; color: #201725; line-height: 1.45; margin:0; padding:0;">
    <span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${preview}</span>
    ${body}
    <hr style="border:0;border-top:1px solid #eadfed;margin:22px 0;" />
    <div style="font-size:12px;color:#63566b;line-height:1.45;">
      <p style="margin:0 0 10px 0;">You are receiving this because you are on the Purple Prices customer list.</p>
      <p style="margin:0 0 10px 0;">To unsubscribe, reply with UNSUBSCRIBE in the subject line.</p>
      <p style="margin:0;">${address}</p>
    </div>
  </body>
</html>`;
}

function buildTextBody(message: CampaignMessage, contact: MailRecipient) {
  return [
    personalize(message.body, contact).trim(),
    "",
    "You are receiving this because you are on the Purple Prices customer list.",
    "",
    "To unsubscribe, reply with UNSUBSCRIBE in the subject line.",
    "",
    message.mailingAddress.trim(),
  ].join("\n");
}

function dotStuff(value: string) {
  return value.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
}

function buildMimeMessage(config: HostedSmtpConfig, message: CampaignMessage, contact: MailRecipient) {
  const boundary = `ppemail-${crypto.randomUUID()}`;
  const subject = personalize(message.subject, contact);
  const htmlBody = buildHtmlBody(message, contact);
  const textBody = buildTextBody(message, contact);
  const messageId = `<${crypto.randomUUID()}@purpleprices.com>`;
  const from = `${config.fromName} <${config.username}>`;

  return [
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    `From: ${from}`,
    `To: ${contact.email}`,
    `Reply-To: ${config.username}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `List-Unsubscribe: <mailto:${config.username}?subject=UNSUBSCRIBE>`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    `Content-Type: text/plain; charset="utf-8"`,
    "Content-Transfer-Encoding: 8bit",
    "",
    textBody,
    "",
    `--${boundary}`,
    `Content-Type: text/html; charset="utf-8"`,
    "Content-Transfer-Encoding: 8bit",
    "",
    htmlBody,
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

class SmtpSession {
  private socket: SocketLike;
  private buffer = "";
  private waiting:
    | {
        resolve: (value: string[]) => void;
        reject: (error: Error) => void;
        lines: string[];
      }
    | null = null;

  private constructor(socket: SocketLike) {
    this.socket = socket;
    this.socket.setEncoding("utf8");
    this.socket.on("data", (chunk: string) => this.handleData(chunk));
    this.socket.on("error", (error) => {
      this.waiting?.reject(error instanceof Error ? error : new Error(String(error)));
      this.waiting = null;
    });
    this.socket.on("close", () => {
      this.waiting?.reject(new Error("SMTP connection closed unexpectedly."));
      this.waiting = null;
    });
  }

  static async connect(config: HostedSmtpConfig) {
    if (config.security === "ssl") {
      const socket = await new Promise<tls.TLSSocket>((resolve, reject) => {
        const connected = tls.connect(
          {
            host: config.host,
            port: config.port,
            servername: config.host,
          },
          () => resolve(connected),
        );
        connected.once("error", reject);
      });
      const session = new SmtpSession(socket);
      await session.readResponse([220]);
      return session;
    }

    const plainSocket = await new Promise<net.Socket>((resolve, reject) => {
      const connected = net.connect({ host: config.host, port: config.port }, () => resolve(connected));
      connected.once("error", reject);
    });
    const plainSession = new SmtpSession(plainSocket);
    await plainSession.readResponse([220]);
    await plainSession.command(`EHLO ${config.host}`, [250]);
    await plainSession.command("STARTTLS", [220]);

    const tlsSocket = await new Promise<tls.TLSSocket>((resolve, reject) => {
      const upgraded = tls.connect(
        {
          socket: plainSocket,
          servername: config.host,
        },
        () => resolve(upgraded),
      );
      upgraded.once("error", reject);
    });

    const secureSession = new SmtpSession(tlsSocket);
    await secureSession.command(`EHLO ${config.host}`, [250]);
    return secureSession;
  }

  private handleData(chunk: string) {
    this.buffer += chunk;
    while (this.buffer.includes("\n")) {
      const newlineIndex = this.buffer.indexOf("\n");
      const rawLine = this.buffer.slice(0, newlineIndex + 1);
      this.buffer = this.buffer.slice(newlineIndex + 1);
      const line = rawLine.replace(/\r?\n$/, "");
      if (!this.waiting) {
        continue;
      }
      this.waiting.lines.push(line);
      if (/^\d{3} /.test(line)) {
        this.waiting.resolve(this.waiting.lines);
        this.waiting = null;
      }
    }
  }

  private async readResponse(expectedCodes: number[]) {
    const lines = await new Promise<string[]>((resolve, reject) => {
      this.waiting = {
        resolve,
        reject,
        lines: [],
      };
    });
    const code = Number(lines[lines.length - 1]?.slice(0, 3));
    if (!expectedCodes.includes(code)) {
      throw new Error(lines.join("\n"));
    }
    return lines;
  }

  async command(command: string, expectedCodes: number[]) {
    this.socket.write(`${command}\r\n`);
    return await this.readResponse(expectedCodes);
  }

  async authLogin(username: string, password: string) {
    await this.command("AUTH LOGIN", [334]);
    await this.command(base64(username), [334]);
    await this.command(base64(password), [235]);
  }

  async sendMail(config: HostedSmtpConfig, message: CampaignMessage, contact: MailRecipient) {
    await this.command(`MAIL FROM:<${config.username}>`, [250]);
    await this.command(`RCPT TO:<${contact.email}>`, [250, 251]);
    await this.command("DATA", [354]);
    const mime = dotStuff(buildMimeMessage(config, message, contact));
    this.socket.write(`${mime}\r\n.\r\n`);
    await this.readResponse([250]);
  }

  async quit() {
    try {
      await this.command("QUIT", [221]);
    } catch {
      // Ignore quit failures during cleanup.
    } finally {
      this.socket.end();
    }
  }
}

export function hostedSmtpConfigFromDraft(draft: CampaignDraft): HostedSmtpConfig {
  const username =
    process.env.PP_EMAIL_SMTP_USERNAME?.trim().toLowerCase() ||
    process.env.PP_EMAIL_IMAP_USERNAME?.trim().toLowerCase() ||
    draft.smtpUsername.trim().toLowerCase();
  const password = process.env.PP_EMAIL_SMTP_PASSWORD || process.env.PP_EMAIL_IMAP_PASSWORD || "";

  if (!username || !password) {
    throw new Error("Hosted SMTP credentials are not configured yet on PS.");
  }

  return {
    host: draft.smtpHost.trim() || "smtp.qboxmail.com",
    port: draft.smtpPort || 465,
    security: draft.smtpSecurity,
    username,
    password,
    fromName: draft.fromName.trim() || "Purple Prices",
  };
}

export async function hostedSmtpLoginTest(draft: CampaignDraft) {
  const config = hostedSmtpConfigFromDraft(draft);
  const session = await SmtpSession.connect(config);
  try {
    if (config.security === "ssl") {
      await session.command(`EHLO ${config.host}`, [250]);
    }
    await session.authLogin(config.username, config.password);
  } finally {
    await session.quit();
  }
  return {
    host: config.host,
    username: config.username,
  };
}

export async function sendHostedPurplePricesTestEmail(draft: CampaignDraft, message: CampaignMessage) {
  const config = hostedSmtpConfigFromDraft(draft);
  const session = await SmtpSession.connect(config);
  const recipient = { email: "oneteam@gmail.com", name: "Dan" };
  try {
    if (config.security === "ssl") {
      await session.command(`EHLO ${config.host}`, [250]);
    }
    await session.authLogin(config.username, config.password);
    await session.sendMail(config, message, recipient);
  } finally {
    await session.quit();
  }

  return {
    to: recipient.email,
    name: recipient.name,
    from: config.username,
  };
}
