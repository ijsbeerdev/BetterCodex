# Blackbox agent guidance

For any theme, add-on, mod, Marketplace, Library, or customization request, read `docs/ADDON_AUTHORING.md` before exploring or editing the implementation. Follow its fast path and do not rediscover the architecture from scratch.

Keep the interface cozy-only. Every user-visible customization must be registered in `src/lib/catalog.ts`, manageable from Library, and removable without manually editing storage.

Before handing off changes, run `npm test` and `npm run build`.
