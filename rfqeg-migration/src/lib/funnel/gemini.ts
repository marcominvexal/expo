/** Funnel Gemini extraction (Expo 16-rule prompt + circuits schema). */

import { GoogleGenerativeAI, SchemaType, type ResponseSchema } from "@google/generative-ai";

const MODEL = process.env.FUNNEL_GEMINI_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash";
const RETRY_LIMIT_MS = 60_000;

export interface FunnelCircuit {
  "Quote ID"?: string;
  "Opportunity Date"?: string;
  "Proposal Date"?: string;
  "Partner Name"?: string;
  "End Customer"?: string;
  "Site A"?: string;
  "Site A City"?: string;
  "Site B"?: string;
  "Site B City"?: string;
  Technology?: string;
  "Service/Product"?: string;
  "Capacity / Quantity"?: string;
  NRC?: string;
  MRC?: string;
  "Contract Terms"?: string;
  "Sales Effort By"?: string;
  Comments?: string;
  POC?: string;
  "Contact Email Address"?: string;
  "On-Net/Off-Net"?: string;
  "LM Infra Details"?: string;
  "Last Mile Protection"?: string;
  "Wet Segment Protection"?: string;
  "XC Included/Excluded"?: string;
  "Offered Us"?: string;
}

export interface FunnelExtraction {
  circuits: FunnelCircuit[];
}

const CIRCUITS_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    circuits: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          "Quote ID": { type: SchemaType.STRING },
          "Opportunity Date": { type: SchemaType.STRING },
          "Proposal Date": { type: SchemaType.STRING },
          "Partner Name": { type: SchemaType.STRING },
          "End Customer": { type: SchemaType.STRING },
          "Site A": { type: SchemaType.STRING },
          "Site A City": { type: SchemaType.STRING },
          "Site B": { type: SchemaType.STRING },
          "Site B City": { type: SchemaType.STRING },
          Technology: { type: SchemaType.STRING },
          "Service/Product": { type: SchemaType.STRING },
          "Capacity / Quantity": { type: SchemaType.STRING },
          NRC: { type: SchemaType.STRING },
          MRC: { type: SchemaType.STRING },
          "Contract Terms": { type: SchemaType.STRING },
          "Sales Effort By": { type: SchemaType.STRING },
          Comments: { type: SchemaType.STRING },
          POC: { type: SchemaType.STRING },
          "Contact Email Address": { type: SchemaType.STRING },
          "On-Net/Off-Net": { type: SchemaType.STRING },
          "LM Infra Details": { type: SchemaType.STRING },
          "Last Mile Protection": { type: SchemaType.STRING },
          "Wet Segment Protection": { type: SchemaType.STRING },
          "XC Included/Excluded": { type: SchemaType.STRING },
          "Offered Us": { type: SchemaType.STRING },
        },
        required: [
          "Quote ID",
          "Opportunity Date",
          "Proposal Date",
          "Partner Name",
          "Technology",
          "Service/Product",
          "Capacity / Quantity",
          "NRC",
          "MRC",
          "LM Infra Details",
        ],
      },
    },
  },
  required: ["circuits"],
};

function buildPrompt(emailBody: string, emailUser: string): string {
  return `
    You are an expert telecom data verification engine. Analyze the email thread and extract quoting matrix rows into clean structured objects.

    CRITICAL ALIGNMENT & TAXONOMY RULES:
    1. Quote ID (STRICT — Exponentia internal tracking ONLY):
       - MUST match EXACTLY ^[IF][0-9]{1,5}-[0-9]{2}$ — only forms like 'I835-26', 'I673-26', 'F780-23', 'I698-26'.
       - Source: ONLY the email BODY (never the Subject line). Look in the newest tip for 'Add and archive' / 'Add & archive' / 'Quote ID: I###-##'.
       - NEVER use Subject-line tokens such as 'QTE-260713-12907-6128b' or '20260710081136-5'.
       - NEVER use older 'Reference taken from I###-##' IDs, earlier thread Quote IDs, or any partner/system RFQ refs (QTE-*, long numeric IDs, PID/BID/SP).
       - If one email has multiple priced circuits/rows, repeat that SAME Exponentia Quote ID on every circuit object.

    2. Opportunity Date (HYPER-MINIMAL TAT LOGIC):
       - OBJECTIVE: Calculate the absolute lowest logically defensible Turnaround Time (TAT) for our sales engineering execution.
       - RULE A (Scope Isolation): Look at the exact circuits listed in the final pricing table. If the email thread began days or weeks earlier discussing a completely different country, city, or independent RFQ scope, you MUST completely ignore those older dates.
       - RULE B (The Actionable Milestone Pivot): Do NOT default to the initial incoming email if our team was operationally blocked. If our team replied asking for missing prerequisites (like LPOC details, specific customer names, or explicit capacities) to proceed, the clock does NOT start at the beginning. Instead, set the 'Opportunity Date' to the exact date when the requirement became actively scoped, or when the customer provided the final clarity needed to process the engineering feasibility.
       - RULE C (Eliminate Trailing Idle Days): Ensure no dead time spent waiting on customer definition parameters is unfairly charged against our turnaround performance metric.
       - Format strictly as YYYY-MM-DD.

    3. Proposal Date: Contextually find the date/timestamp when our team (${emailUser}) sent the final completed pricing/proposal response. If no pricing has been sent yet, fallback to the opportunity date. Format strictly as YYYY-MM-DD.

    4. Capacity / Quantity: State the metric unit explicitly (e.g., '50 Mbps', '20 Gbps').
    5. Currency Formatting: Ensure NRC and MRC fields include the '$' symbol and correct commas (e.g., '$1,500.00'). If none, write '-'.
    6. Strict Tech/Service Taxonomy Mapping:
       - If Service is DIA or BIA -> Technology MUST be 'Internet'
       - If Service is L2VPN, MPLS, or EVPL Linear -> Technology MUST be 'Ethernet'
       - If Service is IPLC, IEPL, EoSDH, DPLC, or DEPL -> Technology MUST be 'TDM'
       - If Service is Colocation + PWR -> Technology MUST be 'Datacenter'
       - If Service is Cross Connects, Equipment, or Field Support -> Technology MUST be 'Managed Services / Hardware'
    7. End Customer: The final client organization the partner is quoting for (e.g., 'Baker Hughes'). If not mentioned anywhere, use 'Unknown'.
    8. On-Net/Off-Net: If the email does not explicitly state off-net, use 'On-Net'.
    9. Contract Terms: ALWAYS express duration in months with the word 'Months' (e.g., '12 Months', '24 Months', '36 Months'). Never use years-only labels.
       - If a single table row lists multiple contract terms (e.g. columns for 12, 24, and 36 months), output a SEPARATE object for EACH term.
    10. LM Infra Details (column after On-Net/Off-Net): MUST be exactly 'Fiber' or 'Wireless' — the last-mile physical media type. NEVER put terms & conditions, contract text, SLAs, or unrelated notes here.
    11. Last Mile Protection: MUST be exactly one of 'Protected', 'Unprotected', or 'N/A'.
    12. Wet Segment Protection: MUST be exactly one of 'Protected', 'Unprotected', or 'N/A'. This is protection status only — NOT fiber/wireless media.
    13. XC Included/Excluded: Cross-connect status — exactly one of 'Included', 'Excluded', or 'N/A'. For Internet/DIA/BIA services, this must be set strictly to '-'.
    14. Offered Us: What we offered (e.g., 'New Service', 'Renewal', 'Upgrade'). Default to 'New Service' if unclear.
    15. Partner Name vs End Customer:
       - Partner Name: The external entity emailing Exponentia Global to request a quote (e.g., 'Noor Data Network'). NEVER set this to 'Exponentia Global'.
    16. Site B & Site B City for Internet: If Technology or Service is Internet/DIA/BIA, set both 'Site B' and 'Site B City' fields strictly to '-'.

    EMAIL THREAD FOR PROCESSING:
    ${emailBody}
    `;
}

function isRetryableGeminiError(err: unknown): boolean {
  const s = String(err).toUpperCase();
  return ["503", "UNAVAILABLE", "429", "RESOURCE_EXHAUSTED"].some((t) => s.includes(t));
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function funnelGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export async function extractFunnelCircuits(
  emailBody: string,
  emailUser: string
): Promise<FunnelExtraction> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured");

  const ai = new GoogleGenerativeAI(key);
  const model = ai.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: CIRCUITS_SCHEMA,
      temperature: 0.2,
    },
  });

  const prompt = buildPrompt(emailBody, emailUser);
  const started = Date.now();
  let attempt = 0;

  while (Date.now() - started < RETRY_LIMIT_MS) {
    try {
      const res = await model.generateContent(prompt);
      const text = res.response.text();
      const parsed = JSON.parse(text) as FunnelExtraction;
      let circuits = parsed?.circuits ?? [];
      if (!Array.isArray(circuits) && circuits && typeof circuits === "object") {
        circuits = [circuits as FunnelCircuit];
      }
      return { circuits: Array.isArray(circuits) ? circuits : [] };
    } catch (err) {
      if (!isRetryableGeminiError(err)) throw err;
      const elapsed = Date.now() - started;
      const remaining = RETRY_LIMIT_MS - elapsed;
      if (remaining <= 0) throw err;
      const wait = Math.min(5000 + attempt * 2000, remaining);
      attempt += 1;
      await sleep(wait);
    }
  }

  throw new Error(
    "Gemini Engine overloaded. System timed out automatically after retrying for 1 minute."
  );
}
