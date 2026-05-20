#!/usr/bin/env node

import { createServer } from "node:http";
import { spawnSync } from "node:child_process";

const PORT = Number(process.env.PP_EMAIL_KEYCHAIN_PORT || 8787);
const SERVICE = "Purple Prices Email SMTP";
const DEFAULT_USERNAME = "support@purpleprices.com";
const ALLOWED_ORIGINS = new Set([
  "https://ppemail.purplestreet.com",
  "https://ppemail-purplestreet.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

function corsHeaders(origin) {
  const allowOrigin = ALLOWED_ORIGINS.has(origin || "") ? origin : "https://ppemail.purplestreet.com";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function normalizeUsername(value) {
  return String(value || DEFAULT_USERNAME).trim().toLowerCase() || DEFAULT_USERNAME;
}

function sendJson(response, origin, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    ...corsHeaders(origin),
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

function keychainHas(username) {
  const result = spawnSync("security", ["find-generic-password", "-s", SERVICE, "-a", username], {
    stdio: "ignore",
  });
  return result.status === 0;
}

function keychainGet(username) {
  const result = spawnSync("security", ["find-generic-password", "-s", SERVICE, "-a", username, "-w"], {
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout.replace(/\n$/, "") : "";
}

function keychainSave(username, password) {
  if (!password) {
    throw new Error("Enter the mailbox password first.");
  }
  const result = spawnSync(
    "security",
    ["add-generic-password", "-U", "-s", SERVICE, "-a", username, "-w", password],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "Could not save the password to Mac Keychain.");
  }
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin || "";

  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders(origin));
    response.end();
    return;
  }

  try {
    const url = new URL(request.url || "/", `http://127.0.0.1:${PORT}`);

    if (request.method === "GET" && url.pathname === "/status") {
      const username = normalizeUsername(url.searchParams.get("username"));
      sendJson(response, origin, 200, { ok: true, service: SERVICE, username, hasPassword: keychainHas(username) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/save") {
      const body = await readBody(request);
      const username = normalizeUsername(body.username);
      keychainSave(username, String(body.password || ""));
      sendJson(response, origin, 200, { ok: true, username, hasPassword: true });
      return;
    }

    if (request.method === "POST" && url.pathname === "/load") {
      const body = await readBody(request);
      const username = normalizeUsername(body.username);
      const password = keychainGet(username);
      if (!password) {
        sendJson(response, origin, 404, { ok: false, error: `No saved Keychain password found for ${username}.` });
        return;
      }
      sendJson(response, origin, 200, { ok: true, username, password });
      return;
    }

    sendJson(response, origin, 404, { ok: false, error: "Unknown Keychain helper route." });
  } catch (error) {
    sendJson(response, origin, 400, { ok: false, error: error instanceof Error ? error.message : "Keychain helper failed." });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Purple Prices Keychain helper running on http://127.0.0.1:${PORT}`);
  console.log(`Keychain service: ${SERVICE}`);
});
