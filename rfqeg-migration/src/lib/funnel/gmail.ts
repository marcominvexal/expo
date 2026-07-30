/**
 * Funnel inbox: fetch ALL unread emails (Expo-style), not only "Solution Request".
 * Reuses IMAP_* or Gmail OAuth credentials already configured for RFQEG.
 */

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { google } from "googleapis";
import { gmailConfigured } from "@/lib/gmail";
import { imapConfigured } from "@/lib/email-imap";

export interface FunnelEmailMessage {
  id: string;
  from: string;
  subject: string;
  /** Prefer text/plain; subject is never included (Quote ID is body-only). */
  body: string;
  date: Date | null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

export function funnelEmailConfigured(): boolean {
  return imapConfigured() || gmailConfigured();
}

export function funnelEmailUser(): string {
  return process.env.IMAP_USER || process.env.GMAIL_USER || "sales";
}

function makeImapClient() {
  return new ImapFlow({
    host: process.env.IMAP_HOST || "imap.gmail.com",
    port: Number(process.env.IMAP_PORT || 993),
    secure: true,
    auth: { user: process.env.IMAP_USER!, pass: process.env.IMAP_PASSWORD! },
    logger: false,
  });
}

async function fetchUnreadImap(): Promise<FunnelEmailMessage[]> {
  const client = makeImapClient();
  const out: FunnelEmailMessage[] = [];
  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids = await client.search({ seen: false }, { uid: true });
      const ids = Array.isArray(uids) ? uids : [];
      for (const uid of ids) {
        const msg = await client.fetchOne(String(uid), { source: true, envelope: true }, { uid: true });
        if (!msg || !("source" in msg) || !msg.source) continue;
        const parsed = await simpleParser(msg.source as Buffer);
        const plain = parsed.text?.toString() || "";
        const html = parsed.html ? String(parsed.html) : "";
        const body = (plain || (html ? stripHtml(html) : "")).trim();
        out.push({
          id: String(uid),
          from: parsed.from?.text || "",
          subject: parsed.subject || "",
          body: body.slice(0, 50000),
          date: parsed.date || null,
        });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
  return out;
}

async function markReadImap(uid: string): Promise<void> {
  const client = makeImapClient();
  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

function gmailOauthClient() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );
  oauth2.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return google.gmail({ version: "v1", auth: oauth2 });
}

function decodeGmailBody(payload: any): string {
  if (!payload) return "";
  const plain: string[] = [];
  const html: string[] = [];
  const walk = (part: any) => {
    if (part.body?.data) {
      const text = Buffer.from(part.body.data, "base64").toString("utf8");
      if (part.mimeType === "text/plain") plain.push(text);
      else if (part.mimeType === "text/html") html.push(text);
    }
    if (part.parts) for (const p of part.parts) walk(p);
  };
  walk(payload);
  if (plain.length) return plain.join("\n");
  if (html.length) return stripHtml(html.join("\n"));
  return "";
}

function header(headers: any[], name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

async function fetchUnreadGmail(): Promise<FunnelEmailMessage[]> {
  const gmail = gmailOauthClient();
  const user = process.env.GMAIL_USER || "me";
  const list = await gmail.users.messages.list({
    userId: user,
    q: "is:unread",
    maxResults: 50,
  });
  const ids = (list.data.messages || []).map((m) => m.id!).filter(Boolean);
  const out: FunnelEmailMessage[] = [];
  for (const id of ids) {
    const msg = await gmail.users.messages.get({ userId: user, id, format: "full" });
    const payload = msg.data.payload;
    const headers = payload?.headers || [];
    out.push({
      id,
      from: header(headers, "From"),
      subject: header(headers, "Subject"),
      body: decodeGmailBody(payload).slice(0, 50000),
      date: msg.data.internalDate ? new Date(Number(msg.data.internalDate)) : null,
    });
  }
  return out;
}

async function markReadGmail(id: string): Promise<void> {
  const gmail = gmailOauthClient();
  const user = process.env.GMAIL_USER || "me";
  await gmail.users.messages.modify({
    userId: user,
    id,
    requestBody: { removeLabelIds: ["UNREAD"] },
  });
}

/** Prefer IMAP when configured (matches Expo Gmail app-password flow). */
export async function fetchUnreadFunnelEmails(): Promise<FunnelEmailMessage[]> {
  if (imapConfigured()) return fetchUnreadImap();
  if (gmailConfigured()) return fetchUnreadGmail();
  throw new Error("Email not configured (set IMAP_* or GMAIL_* env vars)");
}

export async function markFunnelEmailRead(id: string): Promise<void> {
  if (imapConfigured()) return markReadImap(id);
  if (gmailConfigured()) return markReadGmail(id);
}
