/** Field normalizers for Sales Funnel Bot (ported from Expo). */

import {
  MEDIA_FIBER,
  MEDIA_WIRELESS,
  DEFAULT_END_CUSTOMER,
  DEFAULT_ON_NET,
  DEFAULT_OFFERED_US,
  EXPONENTIA_NAMES,
  EXPONENTIA_EMAIL_DOMAINS,
} from "./constants";

export function parseCurrencyNumber(value: unknown): number | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text || text === "-") return null;
  const cleaned = text.replace(/,/g, "").replace(/[^\d.\-]/g, "");
  if (!cleaned || cleaned === "." || cleaned === "-" || cleaned === "-.") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function formatCurrency(value: unknown): number | string {
  const num = parseCurrencyNumber(value);
  if (num != null) return num;
  const text = value != null ? String(value).trim() : "-";
  if (!text || text === "-") return "-";
  if (text.includes("$")) return text;
  return `$${text}`;
}

export function normalizeLmInfra(value: unknown, fallbackText?: unknown): string {
  const combined = [value, fallbackText].map((p) => String(p ?? "")).join(" ").toLowerCase();
  const wirelessHints = ["wireless", "radio", "microwave", "wifi", "wi-fi", "lte", "5g", "4g", "fixed wireless", "airfiber"];
  const fiberHints = ["fiber", "fibre", "ftth", "fttx", "fttp", "dark fiber", "pon", "gpon"];
  const termsHints = ["terms", "condition", "contract", "liability", "warranty", "sla", "payment", "validity", "quote valid"];

  if (termsHints.some((h) => combined.includes(h)) && !wirelessHints.concat(fiberHints).some((h) => combined.includes(h))) {
    return MEDIA_FIBER;
  }
  if (wirelessHints.some((h) => combined.includes(h))) return MEDIA_WIRELESS;
  if (fiberHints.some((h) => combined.includes(h))) return MEDIA_FIBER;

  const text = String(value ?? "").trim();
  if (text === MEDIA_FIBER || text === MEDIA_WIRELESS) return text;
  if (["fiber", "fibre"].includes(text.toLowerCase())) return MEDIA_FIBER;
  if (text.toLowerCase() === "wireless") return MEDIA_WIRELESS;
  return MEDIA_FIBER;
}

export function normalizeEndCustomer(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text || text === "-") return DEFAULT_END_CUSTOMER;
  return text;
}

export function normalizeOnNetStatus(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text || text === "-") return DEFAULT_ON_NET;
  const compact = text.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (compact.includes("offnet") || compact === "off") return "Off-Net";
  if (compact.includes("onnet") || compact === "on") return DEFAULT_ON_NET;
  return text;
}

export function normalizeContractTerm(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text || text === "-") return "-";
  if (/month/i.test(text)) {
    const match = text.match(/(\d+)/);
    return match ? `${match[1]} Months` : text;
  }
  const match = text.match(/(\d+)/);
  if (match) return `${match[1]} Months`;
  return `${text} Months`;
}

export function normalizeProtectionStatus(value: unknown, defaultValue = "N/A"): string {
  const text = String(value ?? "").trim();
  if (!text || text === "-") return defaultValue;
  const lower = text.toLowerCase();
  if (["n/a", "na", "not applicable"].includes(lower)) return "N/A";
  if (lower.includes("unprotect") || ["no", "n", "unprotected"].includes(lower)) return "Unprotected";
  if (lower.includes("protect") || ["yes", "y", "protected"].includes(lower)) return "Protected";
  return defaultValue;
}

export function normalizeXcStatus(value: unknown, defaultValue = "N/A"): string {
  const text = String(value ?? "").trim();
  if (!text || text === "-") return defaultValue;
  const lower = text.toLowerCase();
  if (["n/a", "na", "not applicable"].includes(lower)) return "N/A";
  if (lower.includes("exclud")) return "Excluded";
  if (lower.includes("includ")) return "Included";
  return defaultValue;
}

export function normalizeOfferedUs(value: unknown): string {
  const text = String(value ?? "").trim();
  return text && text !== "-" ? text : DEFAULT_OFFERED_US;
}

export function resolveTechnology(serviceRaw: unknown, techRaw: unknown): string {
  const serviceNorm = String(serviceRaw ?? "").trim().toUpperCase();
  const techNorm = String(techRaw ?? "-").trim();
  if (serviceNorm === "DIA" || serviceNorm === "BIA") return "Internet";
  if (serviceNorm === "L2VPN" || serviceNorm === "MPLS" || serviceNorm.includes("EVPL")) return "Ethernet";
  if (["IPLC", "IEPL", "EOSDH", "DPLC", "DEPL"].includes(serviceNorm)) return "TDM";
  if (serviceNorm === "COLOCATION + PWR") return "Datacenter";
  if (["CROSS CONNECT", "EQUIPMENT", "FIELD SUPPORT"].some((h) => serviceNorm.includes(h))) {
    return "Managed Services / Hardware";
  }
  return techNorm || "-";
}

export function isExponentiaName(value: unknown): boolean {
  if (!value) return false;
  const normalized = String(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return EXPONENTIA_NAMES.some((name) => normalized.includes(name) || name.includes(normalized));
}

export function isExponentiaEmail(emailAddress: unknown): boolean {
  if (!emailAddress) return false;
  const address = String(emailAddress).toLowerCase().trim();
  return EXPONENTIA_EMAIL_DOMAINS.some((domain) => address.includes(domain));
}

function parseAddr(emailFrom: string): { displayName: string; emailAddress: string } {
  const match = emailFrom.match(/^(?:"?([^"]*)"?\s)?<?([^<>@\s]+@[^<>\s]+)>?$/);
  if (match) {
    return {
      displayName: (match[1] || "").trim().replace(/^["']|["']$/g, ""),
      emailAddress: (match[2] || "").trim().toLowerCase(),
    };
  }
  if (emailFrom.includes("@")) {
    return { displayName: "", emailAddress: emailFrom.trim().toLowerCase() };
  }
  return { displayName: emailFrom.trim(), emailAddress: "" };
}

export function partnerFromEmailSender(emailFrom: string | null | undefined): string | null {
  if (!emailFrom) return null;
  const { displayName, emailAddress } = parseAddr(emailFrom);
  if (isExponentiaEmail(emailAddress) || isExponentiaName(displayName)) return null;
  if (displayName && !isExponentiaName(displayName)) return displayName;
  if (emailAddress && emailAddress.includes("@")) {
    const domainLabel = emailAddress.split("@")[1]?.split(".")[0] || "";
    const generic = new Set(["gmail", "yahoo", "hotmail", "outlook", "live", "icloud"]);
    if (domainLabel && !generic.has(domainLabel) && !isExponentiaName(domainLabel)) {
      return domainLabel.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }
  return null;
}

export function normalizePartnerName(
  partner: unknown,
  emailFrom?: string | null
): string {
  const text = String(partner ?? "").trim();
  if (text && !isExponentiaName(text)) return text;
  const sender = partnerFromEmailSender(emailFrom);
  return sender || "-";
}
