export type CustomizationKind = "Theme" | "Add-on" | "Mod";

export interface CatalogItem {
  id: string;
  name: string;
  kind: CustomizationKind;
  description: string;
  author: string;
  version: string;
  accent: string;
  featured?: boolean;
}

export const catalog: CatalogItem[] = [
  {
    id: "pure-black",
    name: "Pure Black",
    kind: "Theme",
    description: "True-black surfaces, crisp neutral type, and cozy spacing for a distraction-free workspace.",
    author: "You",
    version: "1.0.0",
    accent: "#ffffff",
  },
  {
    id: "galaxy",
    name: "Galaxy",
    kind: "Theme",
    description: "Midnight-indigo surfaces, starlight type, and a vivid nebula accent for a cozy cosmic workspace.",
    author: "You",
    version: "1.0.0",
    accent: "#c084fc",
  },
  {
    id: "graphite",
    name: "Graphite",
    kind: "Theme",
    description: "The quiet, high-contrast Blackbox foundation with a cool blue accent.",
    author: "Blackbox",
    version: "1.2.0",
    accent: "#8eb8ff",
    featured: true,
  },
  {
    id: "paper",
    name: "Paper",
    kind: "Theme",
    description: "A warm light canvas designed for long reading and writing sessions.",
    author: "Mara Studio",
    version: "1.0.4",
    accent: "#7568ff",
    featured: true,
  },
  {
    id: "aurora",
    name: "Aurora",
    kind: "Theme",
    description: "Deep navy surfaces with a focused mint highlight.",
    author: "Northstar",
    version: "2.1.1",
    accent: "#65d7b0",
  },
  {
    id: "quiet-composer",
    name: "Quiet composer",
    kind: "Mod",
    description: "Keeps model controls out of the way until the composer is focused.",
    author: "Blackbox",
    version: "1.1.0",
    accent: "#d4a5ff",
  },
  {
    id: "task-notes",
    name: "Task notes",
    kind: "Add-on",
    description: "Pin lightweight notes to a project without interrupting the current chat.",
    author: "Fieldwork",
    version: "0.8.3",
    accent: "#ffbc70",
    featured: true,
  },
  {
    id: "focus-timer",
    name: "Focus timer",
    kind: "Add-on",
    description: "A small project timer with local session history and no cloud account.",
    author: "Made Local",
    version: "1.4.2",
    accent: "#ff7b93",
  },
  {
    id: "snake-break",
    name: "Snake break",
    kind: "Add-on",
    description: "Adds a cozy sidebar shortcut for a quick, keyboard-friendly game of Snake.",
    author: "You",
    version: "1.0.0",
    accent: "#8fcf9b",
  },
];

export const defaultInstalledIds = ["pure-black", "galaxy", "graphite", "quiet-composer", "snake-break"];
export const defaultEnabledIds = ["galaxy", "quiet-composer", "snake-break"];

export function getInstalledItems(ids: string[]) {
  const installed = new Set(ids);
  return catalog.filter((item) => installed.has(item.id));
}

export function searchCatalog(query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return catalog;
  return catalog.filter((item) =>
    [item.name, item.kind, item.description, item.author]
      .join(" ")
      .toLocaleLowerCase()
      .includes(normalized),
  );
}

export function customizationPrompt(item: CatalogItem) {
  return `Customize the ${item.name} ${item.kind.toLocaleLowerCase()}. Read docs/ADDON_AUTHORING.md first, use its fast path, keep the result registered in my Library, preserve an easy remove path, and verify the result.`;
}

export function publishPrompt() {
  return "Read docs/ADDON_AUTHORING.md, then package one of my Library customizations for the Marketplace. Validate its manifest, add a clear preview and description, and prepare it to share.";
}
