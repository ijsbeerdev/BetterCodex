# Blackbox

Blackbox is a local-first, fully customizable Codex client. It starts with a familiar task-oriented interface, but the interface is source code in your own workspace: if you dislike a workflow, prompt Codex to change it.

## Why this architecture

- **Astro + React islands** keep the shell fast and make every visual surface easy to replace.
- **Tailwind CSS v4** is available for rapid composition, while a focused semantic-token layer keeps spacing, type, and themes consistent.
- **Codex App Server** remains the system of record for authentication, threads, models, approvals, tools, and streamed agent events.
- **The local gateway** translates browser WebSocket messages to App Server's stable stdio JSON-RPC transport. It binds to loopback only and accepts local browser origins only.

The gateway does not store OpenAI credentials or copy conversation history into another database. It launches the locally installed `codex app-server`, so Blackbox uses the same Codex account and local state as the CLI and official clients.

## Run it

Requirements: Node.js 20+ and an installed, authenticated Codex CLI.

```bash
npm install
npm run dev
```

Open the Astro URL shown in the terminal, normally `http://127.0.0.1:4321`.

For a production-style local run, build once and launch the bundled frontend and gateway together:

```bash
npm run build
npm run preview
```

Run `codex login` first if Codex is not authenticated. The gateway defaults to `ws://127.0.0.1:8787`; copy `.env.example` to `.env` to override it.

Run the automated interaction and catalog tests with:

```bash
npm test
```

## What works in this foundation

- New and existing Codex threads
- Automatic recovery of paginated Codex history, grouped into projects by each thread's working directory
- Live sidebar and active-chat reconciliation for changes made from another Codex client
- Five-at-a-time project/recent lists with ordering controls and running-task indicators
- Live model discovery and model selection
- Custom model, reasoning-effort, and approval-policy dropdowns whose choices survive refreshes
- Capability-aware Fast mode using Codex service tiers
- Streaming assistant output and task activity
- Turn interruption
- Server-initiated approval prompts
- Chat-first customization with no separate settings drawer
- A local Library for installed themes, add-ons, and mods, including explicit Enabled/Disabled toggles plus edit and remove actions
- A searchable Marketplace whose installations always flow into the Library
- Right-click project and chat menus for rename, project customization, and real App Server chat archiving
- Refresh-safe workspace continuity for the active chat, current view, drafts, expanded projects, ordering, transcript, and composer options
- A modal global search with `Ctrl/Cmd + K` and Escape support
- Offline preview when the gateway is not running
- Responsive desktop and mobile layouts

## The customization contract

Customization begins in chat. Blackbox adds the requirements that every user-visible change stays cozy, is registered in Library, and retains a clear edit/remove path. The catalog model and Marketplace seed data live in `src/lib/catalog.ts`; installed state is local-first. Visual foundations live in `src/styles/global.css`, while product behavior lives in `src/components/Workspace.tsx`.

Agents creating a theme, add-on, or mod should start with `docs/ADDON_AUTHORING.md`. The root `AGENTS.md` points them there automatically and defines the shortest supported implementation and verification path.

The Codex boundary remains intentionally tiny: `server/index.ts` forwards JSON-RPC without inventing a competing backend model.

That makes prompts such as these practical:

- “Replace the sidebar with a command palette.”
- “Create a warm reading theme and add it to my Library.”
- “Add a terminal dock and a files inspector.”
- “Package my task-notes add-on so I can share it in the Marketplace.”

## Security note

The gateway binds to `127.0.0.1`, rejects non-local browser origins, and launches one App Server process per browser connection. Do not expose it to a network as-is. A remote version needs TLS, authentication, origin policy, and isolation around the workspace and Codex process.
