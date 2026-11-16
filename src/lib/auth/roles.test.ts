import { describe, expect, it } from "vitest";
import { canAccessAdmin, homeFor, isOrgAdmin } from "./roles";

describe("Rollen", () => {
  it("nur Owner/Admin/Teamleiter kommen in die Verwaltung", () => {
    expect(canAccessAdmin("owner")).toBe(true);
    expect(canAccessAdmin("admin")).toBe(true);
    expect(canAccessAdmin("team_lead")).toBe(true);
    expect(canAccessAdmin("employee")).toBe(false);
  });
  it("Teamleiter ist kein Firmen-Admin", () => {
    expect(isOrgAdmin("team_lead")).toBe(false);
    expect(isOrgAdmin("owner")).toBe(true);
  });
  it("leitet nach Rolle weiter", () => {
    expect(homeFor(null)).toBe("/onboarding");
    expect(homeFor("employee")).toBe("/app");
    expect(homeFor("team_lead")).toBe("/admin");
  });
});
