# OpsWatch Unified Workspace

This repository now acts as a **single launcher/workspace** for both:
- **Ops Watch** (native app in this repo)
- **Crew Staffing** (loaded from `./crew-staffing/index.html`)

## How the unified swap works

Use the **Tool Mode** tabs at the top of the page to switch seamlessly between:
1. `Ops Watch`
2. `Crew Staffing`

Ops Watch remains fully functional in this repo, and Crew Staffing appears inside an embedded frame so users can move between tools without leaving the workspace.

## Add the Crew Staffing repository

Because this environment could not access GitHub directly during this run, place the Crew Staffing repo manually at:

```text
/workspace/OpsWatch/crew-staffing
```

Expected entry file:

```text
/workspace/OpsWatch/crew-staffing/index.html
```

Once present, refresh OpsWatch and switch to the Crew Staffing tab.
