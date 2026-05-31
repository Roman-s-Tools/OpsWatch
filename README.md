# OpsWatch Unified Workspace

OpsWatch is a browser-based multi-tool operations workspace that combines six functions in one interface:

1. **Ops Watch** (resource map + tracking board)
2. **Crew Staffing** (embedded staffing tool from `./crew-staffing`)
3. **Assignment Board** (drag-and-drop IMT position assignment)
4. **Field Notes** (timestamped operational note log)
5. **Activity Log** (automatic ICS-214-style history of resource changes)
6. **Command Panel** (incident metadata, status board, and printable ICS forms)

The app is fully client-side and stores data in browser local storage.

## What’s Included

### 1) Ops Watch (Map + Resource Board)
Use Ops Watch to create and manage operational resources across a live map and list view.

- Add and track:
  - Ground
  - sUAS
  - Air
  - Vehicle
  - Incident Command Post
  - Staging Area
- Drag map markers to update current location in real time.
- Filter by resource type and search by text.
- Capture crew, status, notes, labels, and location metadata.
- **Edit** any existing resource in place (not just add/remove).
- Each resource tracks a **"last updated" timestamp**, shown as a relative time on its card and refreshed on edit, status change, or move.
- **Check-in alerting:** resources not updated within 30 minutes get a "Check-in overdue" badge, and the Command panel shows a live overdue count. The list re-evaluates on a timer so badges stay current.
- **GPS self-tracking:** the **Track Me** button follows your device location, drops a live "you are here" marker, and draws a breadcrumb trail (with total distance). **Clear Trail** resets it. The trail is stored locally and is not shared over live links.
- Tail number support for air assets and vehicle number support for vehicles.
- Copy summary, export JSON, import JSON (vehicle numbers are preserved on import).
- Draw and clear map radii.
- Upload and clear KML overlays.
- Seed demo data for training/review workflows.
- Open a read-only **Dashboard** window (map + resources + command snapshot) for a second screen or projector.
- Generate a **Share Live Link** to broadcast live updates to viewers over WebRTC.
- One-click **Clear Resources + People** to reset Ops Watch resources, signed-in personnel, and assignment slots.

### 2) Crew Staffing (Embedded)
Crew Staffing is loaded in an embedded frame from:

```text
./crew-staffing/index.html
```

Available workspace controls for the embedded tool:
- Print/PDF
- Export JSON
- Import JSON
- Clear page

### 3) Assignment Board
The Assignment Board allows you to place signed-in personnel into Incident Management Team positions.

- Reload personnel from Crew Staffing data.
- Drag personnel from roster onto assignment slots.
- Upload prefill JSON.
- Clear assignments.
- Uses local storage for persistent workspace state.

### 4) Field Notes
Field Notes provides a quick operational note capture workflow.

- Record **Name**, **Role**, and **Note**.
- Auto timestamps each entry.
- Shows notes count and recorded log.
- Print Notes / PDF support.
- **Export / Import JSON** for backup, transfer, or merging notes between devices.

### 5) Activity Log
The Activity Log records an automatic, timestamped history of every resource
change for after-action review and accountability.

- Captures **add, edit, status change, move, and remove** events with the resource name, type, and a change detail (e.g. `Available → Onscene`).
- Newest-first list with a running event count (capped at the most recent 500 events).
- **Export JSON** for backup, or **Print ICS-214** for a unit-log document.
- Syncs over live share links alongside the rest of the workspace.

### 6) Command Panel
Command Panel provides mission-level context that stays visible alongside operational tools.

- Track incident name, mission number, operational period, and prepared-by metadata.
- Manage a simple status board for command-level updates.
- KPI tiles for people signed in, vehicles, aircraft, and **check-in-overdue** resources.
- **Printable ICS forms** generated from current workspace data:
  - **ICS-201** Incident Briefing (objectives + resource summary)
  - **ICS-203** Organization Assignment List (IMT positions + assigned personnel)
  - **ICS-214** Activity Log (from the Activity Log tab)
- Included in workspace persistence alongside resources, assignments, and notes.

## Live Sharing (Viewers + Co-Editors)
Click **Share Live Link** for a **read-only viewer** link, or **Share Editable Link**
to invite **co-editors**. The host page always keeps full editing rights.

```text
index.html?live=<room>&view=1#k=<password>   # read-only viewer
index.html?live=<room>#k=<password>          # co-editor
```

- Sync runs peer-to-peer over WebRTC (Yjs + y-webrtc).
- A one-time **password** is generated and kept in the URL fragment (`#k=`), so it
  never reaches the signaling server. It encrypts peer-to-peer sync traffic.
- Viewers opening a `view=1` link get a read-only board: editing controls are hidden,
  a banner is shown, and their changes are never published back.
- **Co-editing:** workspace state is synced as **per-section keys** (resources, radii,
  field notes, assignments, command, activity log, …) with last-writer-wins applied
  per key, so two editors working on different sections don't clobber each other.
- **Presence:** editors are prompted for a name/callsign; the status line lists who is
  connected and how many are editing.
- A live status line reports connection state and how many other peers are connected.

> Note: WebRTC signaling uses public y-webrtc servers. Treat this as a convenience
> for situational awareness, not a channel for sensitive data.

## Offline / Install (PWA)
The workspace ships a web app manifest and a service worker (`sw.js`), so when served
over HTTP(S) it can be installed and used offline:

- The app shell (HTML/CSS/JS and the embedded Crew Staffing tool) is precached.
- Leaflet/Yjs libraries and map tiles are cached on first use; tiles already viewed
  remain available offline.

(Service workers do not register from `file://`; serve the directory — see **Local Run**.)

## Safety / Disclaimer Workflow
On first load, users must acknowledge the WMIRS disclaimer modal before proceeding. A “Disclaimer” button remains available to reopen it later.

## Data Persistence
Workspace data is stored in browser local storage (including resources, assignments, field notes, activity log, and command panel data). Export JSON for backup or transfer when needed. If browser storage fills up, OpsWatch surfaces a non-blocking warning instead of silently dropping saves — export your data and clear unused entries when you see it.

## Local Run
No build step is required.

1. Open `index.html` directly in a browser, **or**
2. Serve the directory with a static web server.

Example:

```bash
python3 -m http.server 8080
```

Then browse to `http://localhost:8080`.

## Repository Layout

```text
/                       # OpsWatch workspace shell
├── index.html          # Unified multi-tool interface
├── script.js           # OpsWatch + tool switching + integrations (including Command Panel)
├── ops-utils.js        # Shared, dependency-free helpers (also unit-tested)
├── style.css           # Shared workspace styling
├── sw.js               # Service worker (offline app shell + tile caching)
├── manifest.webmanifest
├── icon.svg
├── package.json        # Dev tooling (tests + lint)
├── eslint.config.mjs
├── vitest.config.mjs
├── tests/
│   └── ops-utils.test.js
└── crew-staffing/
    ├── index.html
    ├── script.js
    ├── style.css
    ├── readme.md
    └── ics203.docx
```

## Development

The app itself needs no build step. Dev tooling is optional and used only for tests
and linting:

```bash
npm install     # install dev dependencies (vitest, eslint, jsdom)
npm test        # run the unit test suite (vitest)
npm run lint    # run eslint
```

Pure helpers live in `ops-utils.js` (shared by the app and the pop-out dashboard) and
are covered by `tests/ops-utils.test.js` — including staleness detection, activity-log
line formatting, breadcrumb distance, and the ICS-203 row builder. Keeping this logic
pure and tested is the strategy for growing coverage without a heavyweight DOM test
harness. A `SessionStart` hook in `.claude/settings.json` installs dependencies
automatically in Claude Code web sessions.

## Notes
- This tool supplements WMIRS workflows and does not replace WMIRS as system of record.
- Aircraft visibility depends on external public tracking source availability.
