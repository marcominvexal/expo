import { describe, it, expect } from "vitest";
import { findExponentiaQuoteIdsInText, normalizeQuoteId } from "@/lib/funnel/quote-id";
import { computeTatFromDates, loadPublicHolidays } from "@/lib/funnel/tat";
import { resolveTechnology, normalizeLmInfra, normalizePartnerName } from "@/lib/funnel/normalizers";

describe("funnel quote-id", () => {
  it("prefers Quote ID label in tip over subject-like refs", () => {
    const body = `Hi team\nQuote ID: I835-26\npls add & archive\n\nFrom: someone\nSubject: QTE-260713-12907`;
    expect(normalizeQuoteId("QTE-260713", body)).toBe("I835-26");
  });

  it("ignores Reference taken from older IDs when newer label present", () => {
    const body = `Quote ID: I837-26\nReference taken from I829-26`;
    expect(findExponentiaQuoteIdsInText(body)[0]).toBe("I837-26");
  });
});

describe("funnel tat", () => {
  it("excludes weekends and counts holidays", () => {
    const holidays = loadPublicHolidays();
    // 2026-03-20 Fri → 2026-03-24 Tue includes Eid weekend holidays
    const start = new Date(2026, 2, 20);
    const end = new Date(2026, 2, 24);
    const { tat, holidayCount } = computeTatFromDates(start, end, holidays);
    expect(holidayCount).toBeGreaterThan(0);
    expect(tat).toBeGreaterThanOrEqual(0);
  });
});

describe("funnel normalizers", () => {
  it("maps DIA to Internet", () => {
    expect(resolveTechnology("DIA", "Ethernet")).toBe("Internet");
  });

  it("maps wireless media", () => {
    expect(normalizeLmInfra("microwave radio")).toBe("Wireless");
  });

  it("never keeps Exponentia as partner when sender is external", () => {
    expect(normalizePartnerName("Exponentia Global", "Jane <jane@cmcnetworks.net>")).toBe("Jane");
  });
});
