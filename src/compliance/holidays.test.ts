import { describe, expect, it } from "vitest";
import { easterSunday, holidaysFor } from "./holidays";

describe("Ostersonntag", () => {
  it.each([
    [2024, "2024-03-31"],
    [2025, "2025-04-20"],
    [2026, "2026-04-05"],
    [2027, "2027-03-28"],
    [2038, "2038-04-25"],
  ])("%i → %s", (y, d) => expect(easterSunday(y)).toBe(d));
});

describe("Feiertage 2026", () => {
  const dates = (s: Parameters<typeof holidaysFor>[1]) => holidaysFor(2026, s).map((h) => h.date);

  it("bundesweit: 9 Feiertage überall", () => {
    for (const s of ["HB", "HH", "NI", "SH"] as const) expect(dates(s)).toHaveLength(10); // 9 + Reformationstag
    expect(dates("BE")).toHaveLength(10); // 9 + Frauentag
  });
  it("NRW hat Fronleichnam und Allerheiligen", () => {
    expect(dates("NW")).toContain("2026-06-04");
    expect(dates("NW")).toContain("2026-11-01");
    expect(dates("NW")).not.toContain("2026-10-31");
  });
  it("Bayern hat die meisten landesweiten Feiertage", () => {
    expect(dates("BY")).toHaveLength(12);
  });
  it("bewegliche Feiertage 2026", () => {
    const by = dates("BY");
    expect(by).toContain("2026-04-03"); // Karfreitag
    expect(by).toContain("2026-04-06"); // Ostermontag
    expect(by).toContain("2026-05-14"); // Himmelfahrt
    expect(by).toContain("2026-05-25"); // Pfingstmontag
  });
  it("Sachsen: Buß- und Bettag", () => {
    expect(dates("SN")).toContain("2026-11-18");
    expect(holidaysFor(2027, "SN").map((h) => h.date)).toContain("2027-11-17");
    expect(holidaysFor(2022, "SN").map((h) => h.date)).toContain("2022-11-16");
  });
  it("Brandenburg: Oster- und Pfingstsonntag", () => {
    expect(dates("BB")).toContain("2026-04-05");
    expect(dates("BB")).toContain("2026-05-24");
  });
  it("Thüringen: Weltkindertag", () => {
    expect(dates("TH")).toContain("2026-09-20");
  });
});
