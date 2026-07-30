/** Contained Sales Funnel Bot — constants (ported from Expo Streamlit app). */

export const FUNNEL_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
] as const;

export const DEFAULT_SPREADSHEET_ID =
  process.env.FUNNEL_SPREADSHEET_ID || "1E9gYdeZUwMEmnwe164io7E47QuXnBfYcELdulUroN_4";

export const FUNNEL_WORKSHEET_GID = Number(process.env.FUNNEL_WORKSHEET_GID || 0);

export const SHEET_URL = `https://docs.google.com/spreadsheets/d/${DEFAULT_SPREADSHEET_ID}/edit#gid=${FUNNEL_WORKSHEET_GID}`;

export const SHEET_DATE_FORMAT = "dd-MMMM-yyyy"; // date-fns pattern ≈ 19-May-2026
export const SHEET_DATE_COLUMN_INDICES = [2, 15] as const; // Opportunity, Proposal
export const FUNNEL_COL_LM_INFRA = "Z";

export const FUNNEL_COLUMN_HEADERS = [
  "S.NO",
  "Quote ID",
  "Opportunity date",
  "Partner name",
  "End customer",
  "Site A",
  "Site A City",
  "Site B",
  "Site B city",
  "Technology",
  "Service/Products",
  "Capacity/Quantity",
  "NRC",
  "MRC",
  "Mode of Communication",
  "Proposal Date",
  "Contract Term",
  "Sales Effort by",
  "Comments",
  "Status",
  "Sub-status",
  "POC",
  "Contact Email Address",
  "TAT",
  "On-Net/ Off-Net",
  "LM Infra details",
  "Last mile protection",
  "Wet Segment protection status",
  "XC included/excluded",
  "Holidays",
  "Offered us",
] as const;

export const FUNNEL_COLUMN_COUNT = FUNNEL_COLUMN_HEADERS.length;

export const MEDIA_FIBER = "Fiber";
export const MEDIA_WIRELESS = "Wireless";
export const DEFAULT_END_CUSTOMER = "Unknown";
export const DEFAULT_ON_NET = "On-Net";
export const DEFAULT_OFFERED_US = "New Service";

export const EXPONENTIA_NAMES = [
  "exponentia global",
  "exponentia",
  "exponentiaglobal",
  "exponentia global llc",
] as const;

export const EXPONENTIA_EMAIL_DOMAINS = [
  "exponentiaglobal.com",
  "exponentia.com",
] as const;
