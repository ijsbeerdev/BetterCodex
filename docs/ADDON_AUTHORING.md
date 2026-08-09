# Fast add-on authoring

Use this guide for every Blackbox theme, add-on, or mod. It is deliberately short: read it once, make the smallest coherent change, and verify it.

## Architecture map

| Concern | File | Change only when |
| --- | --- | --- |
| Catalog metadata and install defaults | `src/lib/catalog.ts` | Adding, renaming, or publishing an item |
| Library, Marketplace, chat, and behavior | `src/components/Workspace.tsx` | The customization changes interaction |
| Visual tokens and component styling | `src/styles/global.css` | The customization changes appearance |
| Interaction coverage | `src/components/Workspace.test.tsx` | User-visible behavior changes |
| Catalog coverage | `src/lib/catalog.test.ts` | Catalog data or prompts change |

The browser-to-Codex transport in `server/` is stable infrastructure. Do not audit or rewrite it for a normal customization.

## Fast path

1. Find the closest existing catalog item and UI pattern.
2. Add or update one `CatalogItem` with a stable kebab-case `id`.
3. Keep installed state separate from enabled state. Installation puts the item in Library; Enabled/Disabled controls whether it runs.
4. Put behavior behind that enabled id. Themes set semantic CSS tokens; mods use a root data attribute; add-ons render a focused component.
5. Reuse existing cozy spacing, typography, buttons, menus, dialogs, and cards.
6. Add one direct regression test for the changed behavior.
7. Run `npm test` and `npm run build`.

## Definition of done

- The item appears in Marketplace or the default Library as intended.
- Install adds it to Library and enables it.
- Library can customize, enable/disable, and remove it.
- Removing it leaves no active behavior behind.
- Mobile has no horizontal overflow.
- No new settings drawer or alternate density is introduced.

Avoid broad refactors, new state libraries, backend work, or new dependencies unless the customization truly needs them.
