# OpsWatch Unified Workspace

OpsWatch is a browser-based multi-tool operations workspace that combines five functions in one interface:

1. **Ops Watch** (resource map + tracking board)
2. **Crew Staffing** (embedded staffing tool from `./crew-staffing`)
3. **Assignment Board** (drag-and-drop IMT position assignment)
4. **Field Notes** (timestamped operational note log)
5. **Command Panel** (incident metadata and status board)

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
- Tail number support for air assets and vehicle number support for vehicles.
- Copy summary, export JSON, import JSON.
- Draw and clear map radii.
- Upload and clear KML overlays.
- Seed demo data for training/review workflows.

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

### 5) Command Panel
Command Panel provides mission-level context that stays visible alongside operational tools.

- Track incident name, mission number, operational period, and prepared-by metadata.
- Manage a simple status board for command-level updates.
- Included in workspace persistence alongside resources, assignments, and notes.

## Safety / Disclaimer Workflow
On first load, users must acknowledge the WMIRS disclaimer modal before proceeding. A “Disclaimer” button remains available to reopen it later.

## Data Persistence
Workspace data is stored in browser local storage (including resources, assignments, field notes, and command panel data). Export JSON for backup or transfer when needed.

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
/               # OpsWatch workspace shell
├── index.html  # Unified multi-tool interface
├── script.js   # OpsWatch + tool switching + integrations (including Command Panel)
├── style.css   # Shared workspace styling
└── crew-staffing/
    ├── index.html
    ├── script.js
    ├── style.css
    ├── readme.md
    └── ics203.docx
```

## Notes
- This tool supplements WMIRS workflows and does not replace WMIRS as system of record.
- Aircraft visibility depends on external public tracking source availability.
