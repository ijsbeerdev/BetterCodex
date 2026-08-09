import { describe, expect, it } from "vitest";
import { catalog, customizationPrompt, defaultEnabledIds, defaultInstalledIds, getInstalledItems, searchCatalog } from "./catalog";

describe("customization catalog", () => {
  it("returns installed items in stable catalog order", () => {
    expect(getInstalledItems(["quiet-composer", "graphite"]).map((item) => item.id)).toEqual(["graphite", "quiet-composer"]);
  });

  it("registers the Galaxy theme as enabled in the default Library", () => {
    const galaxy = catalog.find((item) => item.id === "galaxy");
    expect(galaxy).toMatchObject({ name: "Galaxy", kind: "Theme", author: "You", accent: "#c084fc" });
    expect(defaultInstalledIds).toContain("galaxy");
    expect(defaultEnabledIds).toContain("galaxy");
  });

  it("searches across name, type, description, and author", () => {
    expect(searchCatalog("theme").every((item) => item.kind === "Theme")).toBe(true);
    expect(searchCatalog("fieldwork").map((item) => item.id)).toEqual(["task-notes"]);
    expect(searchCatalog("")).toHaveLength(catalog.length);
  });

  it("creates a library-aware customization prompt", () => {
    const prompt = customizationPrompt(catalog[0]);
    expect(prompt).toContain("Customize the Pure Black theme");
    expect(prompt).toContain("Library");
    expect(prompt).toContain("remove");
    expect(prompt).toContain("docs/ADDON_AUTHORING.md");
  });
});
