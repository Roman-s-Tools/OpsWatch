function initializeCrewStaffingInline() {
  const frame = document.getElementById("crewStaffingFrame");
  if (!frame) return;

  const crewHtml = `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><style>${CREW_STAFFING_STYLE}</style></head><body>${CREW_STAFFING_BODY}<script>${CREW_STAFFING_SCRIPT}<\/script></body></html>`;
  frame.srcdoc = crewHtml;
}

const STORAGE_KEY = "romans-resource-tracker-v1";
const RADII_STORAGE_KEY = "romans-resource-radii-v1";
const RESOURCE_STATUSES = ["Available", "Assigned", "Enroute", "Onscene", "Offline"];

const TYPE_COLORS = {
  Ground: "#2563eb",
  sUAS: "#7c3aed",
  Air: "#dc2626",
  Vehicle: "#ea580c"
};

const CREW_STAFFING_STYLE = String.raw`:root { --bg: #f6f7fb; --panel: #ffffff; --text: #111827; --muted: #5f6b7a; --border: #dfe4ec; --border-strong: #c7d0dd; --primary: #1f2937; --primary-hover: #111827; --accent: #2563eb; --shadow: 0 18px 50px rgba(15, 23, 42, 0.08); --radius-lg: 24px; --radius-md: 16px; --radius-sm: 10px; }
* { box-sizing: border-box; }
body { margin: 0; background: radial-gradient(circle at top left, rgba(37, 99, 235, 0.08), transparent 34rem), var(--bg); color: var(--text); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.5; }
button, input, select, textarea { font: inherit; }
button { cursor: pointer; }
.container { width: min(1180px, calc(100% - 32px)); margin: 0 auto; }
.site-header { padding: 48px 0 28px; }
.header-grid { display: grid; grid-template-columns: 1fr; gap: 22px; align-items: end; }
.eyebrow { margin: 0 0 8px; color: var(--muted); font-size: 0.82rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
h1, h2, h3, p { margin-top: 0; }
h1 { margin-bottom: 12px; font-size: clamp(2.2rem, 5vw, 4.25rem); line-height: 0.95; letter-spacing: -0.06em; }
h2 { margin-bottom: 6px; font-size: 1.35rem; letter-spacing: -0.03em; }
h3 { margin-bottom: 6px; font-size: 1.1rem; }
.lede { max-width: 760px; margin-bottom: 0; color: var(--muted); font-size: 1.05rem; }
.header-actions, .filters, .resource-actions { display: flex; flex-wrap: wrap; gap: 10px; }
.button, .filter { display: inline-flex; align-items: center; justify-content: center; min-height: 42px; border: 1px solid transparent; border-radius: 999px; padding: 0 16px; font-weight: 750; text-decoration: none; transition: 160ms ease; }
.button.primary { background: var(--primary); color: #fff; }
.button.primary:hover { background: var(--primary-hover); transform: translateY(-1px); }
.button.secondary, .filter { background: #fff; color: var(--primary); border-color: var(--border); }
.button.secondary:hover, .filter:hover { border-color: var(--border-strong); transform: translateY(-1px); }
.filter.active { background: var(--primary); color: #fff; border-color: var(--primary); }
.file-button input { display: none; }
.full-width { width: 100%; }
.main-grid { display: grid; grid-template-columns: 1fr; gap: 22px; align-items: start; }
.workspace { display: grid; gap: 22px; }
.panel { background: rgba(255, 255, 255, 0.92); border: 1px solid rgba(223, 228, 236, 0.9); border-radius: var(--radius-lg); box-shadow: var(--shadow); padding: 22px; backdrop-filter: blur(10px); }
.panel-heading { margin-bottom: 16px; }
.panel-heading p, .toolbar p { margin-bottom: 0; color: var(--muted); }
.resource-form { display: grid; gap: 15px; }
label { display: grid; gap: 6px; color: #344054; font-size: 0.92rem; font-weight: 750; }
input, select, textarea { width: 100%; border: 1px solid var(--border); border-radius: var(--radius-md); background: #fff; color: var(--text); padding: 12px 13px; outline: none; transition: border-color 140ms ease, box-shadow 140ms ease; }
textarea { min-height: 108px; resize: vertical; }
input:focus, select:focus, textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12); }
.two-column { display: grid; grid-template-columns: 1fr; gap: 12px; }
.toolbar { display: grid; gap: 14px; margin-bottom: 16px; }
.search-label { min-width: min(100%, 320px); }
.filters { margin-bottom: 16px; }
.resource-list { display: grid; gap: 12px; }
.resource-card { display: grid; gap: 14px; padding: 16px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: #fff; }
.badges { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
.badge { display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--border); border-radius: 999px; padding: 4px 9px; font-size: 0.78rem; font-weight: 850; }
.badge.section { background: #f8fafc; color: #334155; }
.badge.status-assigned { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
.badge.status-available { background: #ecfdf3; color: #067647; border-color: #abefc6; }
.badge.status-enroute { background: #fffbeb; color: #b45309; border-color: #fde68a; }
.badge.status-onscene { background: #f5f3ff; color: #6d28d9; border-color: #ddd6fe; }
.badge.status-released, .badge.status-unavailable { background: #f1f5f9; color: #475569; border-color: #cbd5e1; }
.resource-notes { margin-bottom: 8px; color: var(--muted); }
.resource-meta { margin-bottom: 0; color: #344054; font-size: 0.93rem; font-weight: 700; }
.resource-actions button, .resource-actions select { border: 1px solid var(--border); border-radius: 999px; background: #fff; color: var(--primary); padding: 9px 12px; font-size: 0.88rem; font-weight: 800; text-decoration: none; }
.resource-actions button:hover { border-color: var(--border-strong); background: #f8fafc; }
.resource-actions .danger { color: #b42318; border-color: #fecaca; }
.empty-state { border: 1px dashed var(--border-strong); border-radius: var(--radius-lg); padding: 28px; color: var(--muted); text-align: center; }
.ics-header { display: flex; justify-content: space-between; gap: 16px; align-items: start; border-bottom: 2px solid var(--primary); padding-bottom: 12px; margin-bottom: 14px; }
.form-number { margin: 0; color: var(--muted); font-weight: 900; letter-spacing: 0.08em; }
.ics-meta { display: grid; grid-template-columns: 1fr; border: 1px solid var(--border-strong); border-radius: var(--radius-md); overflow: hidden; margin-bottom: 16px; }
.meta-cell { padding: 10px 12px; border-bottom: 1px solid var(--border); background: #fff; }
.meta-cell:last-child { border-bottom: 0; }
.meta-label { display: block; color: var(--muted); font-size: 0.75rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; }
.meta-value { display: block; font-weight: 800; }
.ics-sections { display: grid; gap: 16px; }
.chain-panel { border: 1px solid var(--border-strong); border-radius: var(--radius-md); padding: 12px; margin-bottom: 16px; background: #fcfdff; }
.chain-panel h3 { margin: 0 0 10px; font-size: 1rem; }
.chain-grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
.chain-card { border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px; background: #fff; }
.chain-slot { margin: 0 0 4px; font-size: 0.75rem; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.chain-person { margin: 0 0 4px; font-weight: 850; }
.chain-role { margin: 0; color: #344054; font-size: 0.88rem; }
.ics-section { border: 1px solid var(--border-strong); border-radius: var(--radius-md); overflow: hidden; background: #fff; }
.ics-section h3 { margin: 0; padding: 10px 12px; background: #f8fafc; border-bottom: 1px solid var(--border); }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 9px 10px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; font-size: 0.92rem; }
th { color: #344054; background: #fcfcfd; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.06em; }
tr:last-child td { border-bottom: 0; }
.site-footer { padding: 26px 0 42px; color: var(--muted); font-size: 0.92rem; }
.site-footer p { margin-bottom: 6px; }
.version { font-weight: 800; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@media (min-width: 720px) { .header-grid { grid-template-columns: 1fr auto; } .toolbar { grid-template-columns: 1fr auto; align-items: center; } .two-column { grid-template-columns: 1fr 1fr; } .resource-card { grid-template-columns: 1fr auto; align-items: start; } .ics-meta { grid-template-columns: repeat(2, 1fr); } .meta-cell:nth-last-child(2) { border-bottom: 0; } }
@media (min-width: 980px) { .main-grid { grid-template-columns: 370px 1fr; } .site-header { padding-top: 64px; } }
@media print { body { background: #fff; } .site-header, .main-grid > .panel:first-child, .workspace > .panel:first-child, .workspace > .panel:nth-child(2), .site-footer { display: none !important; } .container, .main-grid { width: 100%; margin: 0; display: block; } .panel { box-shadow: none; border: 0; border-radius: 0; padding: 0; } .printable-panel { display: block !important; } th, td { font-size: 10pt; } }


body.embed-mode {
  background: transparent;
}

body.embed-mode .site-header,
body.embed-mode .site-footer {
  display: none;
}

body.embed-mode .container {
  width: 100%;
  margin: 0;
}

body.embed-mode .main-grid {
  padding: 0;
}

body.embed-mode .panel {
  border-radius: 18px;
}
`;
const CREW_STAFFING_SCRIPT = String.raw`const STORAGE_KEY = "romans-assignment-roster-v1";
const INCIDENT_KEY = "romans-assignment-roster-incident-v1";
const STATUSES = ["Assigned", "Available", "Enroute", "Onscene", "Released", "Unavailable"];
const SECTIONS = ["Command Staff", "Operations Section", "Planning Section", "Logistics Section", "Finance/Admin Section", "Air Operations", "Ground Operations", "Mission Base", "Other"];

let people = loadPeople();
let incident = loadIncident();
let currentFilter = "All";
let searchQuery = "";

const els = {
  incidentForm: document.getElementById("incidentForm"),
  incidentName: document.getElementById("incidentName"),
  missionNumber: document.getElementById("missionNumber"),
  operationalPeriod: document.getElementById("operationalPeriod"),
  preparedBy: document.getElementById("preparedBy"),
  preparedAt: document.getElementById("preparedAt"),
  form: document.getElementById("personForm"),
  name: document.getElementById("personName"),
  capid: document.getElementById("capid"),
  section: document.getElementById("section"),
  position: document.getElementById("position"),
  assignment: document.getElementById("assignment"),
  status: document.getElementById("status"),
  notes: document.getElementById("notes"),
  list: document.getElementById("rosterList"),
  count: document.getElementById("personCount"),
  search: document.getElementById("searchInput"),
  copySummaryBtn: document.getElementById("copySummaryBtn"),
  printBtn: document.getElementById("printBtn"),
  exportBtn: document.getElementById("exportBtn"),
  importInput: document.getElementById("importInput"),
  clearPageBtn: document.getElementById("clearPageBtn"),
  icsMeta: document.getElementById("icsMeta"),
  icsSections: document.getElementById("icsSections"),
  chainOfCommand: document.getElementById("chainOfCommand")
};

const CHAIN_OF_COMMAND_ORDER = [
  ["Incident Commander", ["Incident Commander"]],
  ["Deputy Incident Commander", ["Deputy Incident Commander"]],
  ["Command Staff", ["Safety Officer", "Public Information Officer", "Liaison Officer"]],
  ["Operations", ["Operations Section Chief", "Air Operations Branch Director", "Ground Branch Director"]],
  ["Planning", ["Planning Section Chief", "Resources Unit Leader", "Situation Unit Leader"]],
  ["Logistics", ["Logistics Section Chief", "Communications Unit Leader", "Medical Unit Leader"]],
  ["Finance/Admin", ["Finance/Admin Section Chief", "Time Unit Leader", "Procurement Unit Leader"]]
];

document.addEventListener("DOMContentLoaded", () => {
  applyEmbedMode();
  hydrateIncidentForm();
  bindEvents();
  render();
});


function applyEmbedMode() {
  const isEmbedded = new URLSearchParams(window.location.search).get("embed") === "1";
  if (isEmbedded) {
    document.body.classList.add("embed-mode");
  }
}

function bindEvents() {
  els.form.addEventListener("submit", addPerson);
  els.incidentForm.addEventListener("input", saveIncidentFromForm);
  els.search.addEventListener("input", event => {
    searchQuery = event.target.value.trim().toLowerCase();
    render();
  });
  document.querySelectorAll(".filter").forEach(button => {
    button.addEventListener("click", () => {
      currentFilter = button.dataset.filter;
      document.querySelectorAll(".filter").forEach(item => item.classList.remove("active"));
      button.classList.add("active");
      render();
    });
  });
  els.copySummaryBtn.addEventListener("click", copySummary);
  els.printBtn.addEventListener("click", () => window.print());
  els.exportBtn.addEventListener("click", exportJson);
  els.importInput.addEventListener("change", importJson);
  els.clearPageBtn.addEventListener("click", clearEntirePage);
}

function hydrateIncidentForm() {
  els.incidentName.value = incident.incidentName || "";
  els.missionNumber.value = incident.missionNumber || "";
  els.operationalPeriod.value = incident.operationalPeriod || "";
  els.preparedBy.value = incident.preparedBy || "";
  els.preparedAt.value = incident.preparedAt || new Date().toLocaleString();
  saveIncidentFromForm();
}

function saveIncidentFromForm() {
  incident = {
    incidentName: els.incidentName.value.trim(),
    missionNumber: els.missionNumber.value.trim(),
    operationalPeriod: els.operationalPeriod.value.trim(),
    preparedBy: els.preparedBy.value.trim(),
    preparedAt: els.preparedAt.value.trim()
  };
  localStorage.setItem(INCIDENT_KEY, JSON.stringify(incident));
  renderIcsView();
}

function addPerson(event) {
  event.preventDefault();
  const person = {
    id: crypto.randomUUID(),
    name: els.name.value.trim(),
    capid: els.capid.value.trim(),
    section: els.section.value,
    position: els.position.value.trim(),
    assignment: els.assignment.value.trim(),
    status: els.status.value,
    notes: els.notes.value.trim()
  };
  if (!person.name || !person.capid || !person.position || !person.assignment) return;
  people.push(person);
  savePeople();
  els.form.reset();
  els.section.value = "Command Staff";
  els.status.value = "Assigned";
  render();
}

function render() {
  const visible = getVisiblePeople();
  renderList(visible);
  renderIcsView();
  els.count.textContent = \`\${visible.length} visible of \${people.length} total\`;
}

function getVisiblePeople() {
  return people.filter(person => {
    const matchesFilter = currentFilter === "All" || person.section === currentFilter;
    const text = [person.name, person.capid, person.section, person.position, person.assignment, person.status, person.notes].join(" ").toLowerCase();
    return matchesFilter && text.includes(searchQuery);
  });
}

function renderList(visible) {
  els.list.innerHTML = "";
  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No people match the current filters.";
    els.list.appendChild(empty);
    return;
  }
  const template = document.getElementById("personCardTemplate");
  visible.forEach(person => {
    const card = template.content.firstElementChild.cloneNode(true);
    const badges = card.querySelector(".badges");
    badges.appendChild(makeBadge(person.section, "section"));
    badges.appendChild(makeBadge(person.status, \`status-\${slug(person.status)}\`));
    card.querySelector("h3").textContent = person.name;
    card.querySelector(".resource-notes").textContent = person.notes || "No notes entered.";
    card.querySelector(".resource-meta").textContent = \`CAPID: \${person.capid} · \${person.position} · \${person.assignment}\`;
    const actions = card.querySelector(".resource-actions");
    const statusSelect = document.createElement("select");
    STATUSES.forEach(status => {
      const option = document.createElement("option");
      option.value = status;
      option.textContent = status;
      option.selected = status === person.status;
      statusSelect.appendChild(option);
    });
    statusSelect.addEventListener("change", event => updateStatus(person.id, event.target.value));
    actions.appendChild(statusSelect);
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => editPerson(person.id));
    actions.appendChild(edit);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => removePerson(person.id));
    actions.appendChild(remove);
    els.list.appendChild(card);
  });
}

function renderIcsView() {
  els.icsMeta.innerHTML = "";
  [
    ["Incident / Mission", incident.incidentName || "Not specified"],
    ["Mission Number", incident.missionNumber || "Not specified"],
    ["Operational Period", incident.operationalPeriod || "Not specified"],
    ["Prepared By / Date", \`\${incident.preparedBy || "Not specified"} · \${incident.preparedAt || "Not specified"}\`]
  ].forEach(([label, value]) => {
    const cell = document.createElement("div");
    cell.className = "meta-cell";
    cell.innerHTML = \`<span class="meta-label">\${escapeHtml(label)}</span><span class="meta-value">\${escapeHtml(value)}</span>\`;
    els.icsMeta.appendChild(cell);
  });

  els.icsSections.innerHTML = "";
  renderChainOfCommand();
  const sectionsToShow = SECTIONS.filter(section => people.some(person => person.section === section));
  if (!sectionsToShow.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Add people to populate the organization assignment list.";
    els.icsSections.appendChild(empty);
    return;
  }
  sectionsToShow.forEach(section => {
    const sectionPeople = people.filter(person => person.section === section).sort((a, b) => a.assignment.localeCompare(b.assignment) || a.position.localeCompare(b.position));
    const wrap = document.createElement("section");
    wrap.className = "ics-section";
    wrap.innerHTML = \`<h3>\${escapeHtml(section)}</h3><table><thead><tr><th>Assignment</th><th>Position</th><th>Name</th><th>CAPID</th><th>Status</th><th>Notes</th></tr></thead><tbody></tbody></table>\`;
    const tbody = wrap.querySelector("tbody");
    sectionPeople.forEach(person => {
      const row = document.createElement("tr");
      row.innerHTML = \`<td>\${escapeHtml(person.assignment)}</td><td>\${escapeHtml(person.position)}</td><td>\${escapeHtml(person.name)}</td><td>\${escapeHtml(person.capid)}</td><td>\${escapeHtml(person.status)}</td><td>\${escapeHtml(person.notes || "")}</td>\`;
      tbody.appendChild(row);
    });
    els.icsSections.appendChild(wrap);
  });
}

function renderChainOfCommand() {
  els.chainOfCommand.innerHTML = "";
  CHAIN_OF_COMMAND_ORDER.forEach(([slot, positions]) => {
    const match = people.find(person => positions.some(position => person.position.toLowerCase() === position.toLowerCase()));
    const card = document.createElement("article");
    card.className = "chain-card";
    card.innerHTML = \`<p class="chain-slot">\${escapeHtml(slot)}</p><p class="chain-person">\${escapeHtml(match ? match.name : "Unassigned")}</p><p class="chain-role">\${escapeHtml(match ? \`\${match.position} · \${match.assignment}\` : "Add a matching position to auto-populate")}</p>\`;
    els.chainOfCommand.appendChild(card);
  });
}

function editPerson(id) {
  const person = people.find(item => item.id === id);
  if (!person) return;
  els.name.value = person.name;
  els.capid.value = person.capid;
  els.section.value = person.section;
  els.position.value = person.position;
  els.assignment.value = person.assignment;
  els.status.value = person.status;
  els.notes.value = person.notes;
  people = people.filter(item => item.id !== id);
  savePeople();
  render();
  els.name.focus();
}

function updateStatus(id, status) {
  const person = people.find(item => item.id === id);
  if (!person || !STATUSES.includes(status)) return;
  person.status = status;
  savePeople();
  render();
}

function removePerson(id) {
  people = people.filter(person => person.id !== id);
  savePeople();
  render();
}


function clearEntirePage() {
  const confirmed = window.confirm("Clear all people, incident info, and saved local data for this page?");
  if (!confirmed) return;
  people = [];
  incident = {};
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(INCIDENT_KEY);
  currentFilter = "All";
  searchQuery = "";
  els.search.value = "";
  document.querySelectorAll(".filter").forEach(item => item.classList.toggle("active", item.dataset.filter === "All"));
  els.form.reset();
  els.incidentForm.reset();
  hydrateIncidentForm();
  render();
}

function copySummary() {
  const text = buildSummary();
  navigator.clipboard.writeText(text).then(() => {
    els.copySummaryBtn.textContent = "Copied";
    setTimeout(() => { els.copySummaryBtn.textContent = "Copy Summary"; }, 1200);
  }).catch(() => alert(text));
}

function buildSummary() {
  const lines = [];
  lines.push("ICS 203-STYLE ORGANIZATION ASSIGNMENT LIST");
  lines.push(\`Incident / Mission: \${incident.incidentName || "Not specified"}\`);
  lines.push(\`Mission Number: \${incident.missionNumber || "Not specified"}\`);
  lines.push(\`Operational Period: \${incident.operationalPeriod || "Not specified"}\`);
  lines.push(\`Prepared By / Date: \${incident.preparedBy || "Not specified"} · \${incident.preparedAt || "Not specified"}\`);
  lines.push("");
  SECTIONS.forEach(section => {
    const sectionPeople = people.filter(person => person.section === section);
    if (!sectionPeople.length) return;
    lines.push(section.toUpperCase());
    sectionPeople.forEach(person => {
      lines.push(\`- \${person.assignment}: \${person.position} — \${person.name} (\${person.capid}) [\${person.status}]\${person.notes ? \` — \${person.notes}\` : ""}\`);
    });
    lines.push("");
  });
  return lines.join("\n").trim();
}

function exportJson() {
  const payload = { exportedAt: new Date().toISOString(), incident, people };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = \`assignment-roster-\${new Date().toISOString().slice(0, 10)}.json\`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(String(reader.result));
      const importedPeople = Array.isArray(imported) ? imported : imported.people;
      if (!Array.isArray(importedPeople)) throw new Error("Missing people array.");
      people = importedPeople.map(normalizePerson);
      incident = imported.incident ? { ...loadIncident(), ...imported.incident } : incident;
      savePeople();
      localStorage.setItem(INCIDENT_KEY, JSON.stringify(incident));
      hydrateIncidentForm();
      render();
    } catch (error) {
      alert("Could not import this file. Exported Assignment Roster JSON is expected.");
    } finally {
      els.importInput.value = "";
    }
  };
  reader.readAsText(file);
}

function normalizePerson(person) {
  return {
    id: person.id || crypto.randomUUID(),
    name: person.name || "Unnamed Person",
    capid: person.capid || "",
    section: SECTIONS.includes(person.section) ? person.section : "Other",
    position: person.position || person.role || "Unassigned",
    assignment: person.assignment || "Unassigned",
    status: STATUSES.includes(person.status) ? person.status : "Assigned",
    notes: person.notes || ""
  };
}

function loadPeople() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(stored) ? stored.map(normalizePerson) : [];
  } catch { return []; }
}

function savePeople() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(people));
}

function loadIncident() {
  try { return JSON.parse(localStorage.getItem(INCIDENT_KEY) || "{}"); }
  catch { return {}; }
}

function makeBadge(text, className) {
  const badge = document.createElement("span");
  badge.className = \`badge \${className}\`;
  badge.textContent = text;
  return badge;
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}
`;
const CREW_STAFFING_BODY = String.raw`
  <header class="site-header">
    <div class="container header-grid">
      <div>
        <p class="eyebrow">Roman's Toolbox</p>
        <h1>Staff Watch</h1>
        <p class="lede">Log personnel by name, CAPID, role, and assignment. Build an ICS 203-style organization/loadout record that can be copied, printed, exported, and restored later.</p>
      </div>
      <div class="header-actions">
        <button class="button primary" id="copySummaryBtn" type="button">Copy Summary</button>
        <button class="button secondary" id="printBtn" type="button">Print / PDF</button>
        <button class="button secondary" id="exportBtn" type="button">Export JSON</button>
        <label class="button secondary file-button">Import JSON<input id="importInput" type="file" accept="application/json" /></label>
        <button class="button secondary" id="clearPageBtn" type="button">Clear Page</button>
      </div>
    </div>
  </header>

  <main class="container main-grid">
    <section class="panel">
      <div class="panel-heading">
        <h2>Incident / Mission Info</h2>
        <p>These fields appear at the top of the generated roster.</p>
      </div>
      <form id="incidentForm" class="resource-form">
        <label>Incident / Mission Name<input id="incidentName" autocomplete="off" placeholder="Mission Base Operations" /></label>
        <div class="two-column">
          <label>Mission Number<input id="missionNumber" autocomplete="off" placeholder="25-M-0000" /></label>
          <label>Operational Period<input id="operationalPeriod" autocomplete="off" placeholder="11 May 2026, 0800-1800" /></label>
        </div>
        <div class="two-column">
          <label>Prepared By<input id="preparedBy" autocomplete="off" /></label>
          <label>Date / Time Prepared<input id="preparedAt" autocomplete="off" /></label>
        </div>
      </form>
    </section>

    <section class="workspace">
      <section class="panel">
        <div class="panel-heading">
          <h2>Add Person</h2>
          <p>Create records by name, CAPID, assignment, and ICS-style position.</p>
        </div>
        <form id="personForm" class="resource-form">
          <div class="two-column">
            <label>Name<input id="personName" required autocomplete="off" placeholder="Jane Smith" /></label>
            <label>CAPID<input id="capid" required inputmode="numeric" autocomplete="off" placeholder="123456" /></label>
          </div>
          <div class="two-column">
            <label>ICS Section
              <select id="section">
                <option>Command Staff</option>
                <option>Operations Section</option>
                <option>Planning Section</option>
                <option>Logistics Section</option>
                <option>Finance/Admin Section</option>
                <option>Air Operations</option>
                <option>Ground Operations</option>
                <option>Mission Base</option>
                <option>Other</option>
              </select>
            </label>
            <label>Position / Role<input id="position" required autocomplete="off" placeholder="Ground Branch Director" /></label>
          </div>
          <div class="two-column">
            <label>Assignment / Team<input id="assignment" required autocomplete="off" placeholder="Ground Team 1" /></label>
            <label>Status
              <select id="status">
                <option>Assigned</option>
                <option>Available</option>
                <option>Enroute</option>
                <option>Onscene</option>
                <option>Released</option>
                <option>Unavailable</option>
              </select>
            </label>
          </div>
          <label>Notes<textarea id="notes" placeholder="Phone, qualifications, vehicle, radio call sign, special equipment, etc."></textarea></label>
          <button class="button primary full-width" type="submit">Add Person</button>
        </form>
      </section>

      <section class="panel">
        <div class="toolbar">
          <div>
            <h2>Organization / Loadout</h2>
            <p><span id="personCount">0 people</span></p>
          </div>
          <label class="search-label"><span class="sr-only">Search people</span><input id="searchInput" type="search" placeholder="Search name, CAPID, assignment, role, notes" /></label>
        </div>
        <div class="filters" aria-label="Roster filters">
          <button class="filter active" type="button" data-filter="All">All</button>
          <button class="filter" type="button" data-filter="Command Staff">Command</button>
          <button class="filter" type="button" data-filter="Operations Section">Operations</button>
          <button class="filter" type="button" data-filter="Planning Section">Planning</button>
          <button class="filter" type="button" data-filter="Logistics Section">Logistics</button>
          <button class="filter" type="button" data-filter="Finance/Admin Section">Finance/Admin</button>
        </div>
        <div id="rosterList" class="resource-list"></div>
      </section>

      <section class="panel printable-panel" id="ics203Panel">
        <div class="ics-header">
          <div>
            <p class="eyebrow">ICS 203-style</p>
            <h2>Organization Assignment List</h2>
          </div>
          <p class="form-number">ICS 203</p>
        </div>
        <div class="ics-meta" id="icsMeta"></div>
        <section class="chain-panel" aria-label="Operational chain of command">
          <h3>Operational Chain of Command (ICS 207-style)</h3>
          <div id="chainOfCommand" class="chain-grid"></div>
        </section>
        <div id="icsSections" class="ics-sections"></div>
      </section>
    </section>
  </main>

  <footer class="site-footer">
    <div class="container">
      <p>Operational note: this tool saves data in your browser using local storage. Export JSON when you need to preserve or transfer a roster.</p>
      <p class="version">Version 1. Last updated May 11, 2026.</p>
    </div>
  </footer>

  <template id="personCardTemplate">
    <article class="resource-card">
      <div>
        <div class="badges"></div>
        <h3></h3>
        <p class="resource-notes"></p>
        <p class="resource-meta"></p>
      </div>
      <div class="resource-actions"></div>
    </article>
  </template>

  
`;

const defaultResources = [
  {
    id: crypto.randomUUID(),
    type: "Ground",
    name: "Ground Team 1",
    label: "GT-1",
    status: "Available",
    lat: 29.7604,
    lng: -95.3698,
    notes: "Example ground resource",
    crew: "Alpha Crew",
    tail: "",
    vehicleNumber: ""
  },
  {
    id: crypto.randomUUID(),
    type: "sUAS",
    name: "Drone Team Alpha",
    label: "UAS-A",
    status: "Assigned",
    lat: 29.752,
    lng: -95.352,
    notes: "Example sUAS resource",
    crew: "UAS Team 1",
    tail: "",
    vehicleNumber: ""
  }
];

let resources = loadResources().map(normalizeResource);
let currentFilter = "All";
let searchQuery = "";
let map;
let markersLayer;
let radiiLayer;
let userCoords = null;
let radii = loadRadii();
let isDrawRadiusMode = false;
let activeRadius = null;
let draftCircle = null;
let movingRadiusId = null;
let movingRadiusOffset = null;
let kmlLayer = null;

const els = {
  form: document.getElementById("resourceForm"),
  type: document.getElementById("resourceType"),
  name: document.getElementById("resourceName"),
  crew: document.getElementById("resourceCrew"),
  label: document.getElementById("resourceLabel"),
  lat: document.getElementById("latitude"),
  lng: document.getElementById("longitude"),
  tail: document.getElementById("tailNumber"),
  status: document.getElementById("status"),
  vehicleNumber: document.getElementById("vehicleNumber"),
  notes: document.getElementById("notes"),
  mapFields: document.getElementById("mapFields"),
  airFields: document.getElementById("airFields"),
  vehicleFields: document.getElementById("vehicleFields"),
  useLocationBtn: document.getElementById("useLocationBtn"),
  list: document.getElementById("resourceList"),
  count: document.getElementById("resourceCount"),
  search: document.getElementById("searchInput"),
  exportBtn: document.getElementById("exportBtn"),
  importInput: document.getElementById("importInput"),
  copySummaryBtn: document.getElementById("copySummaryBtn"),
  drawRadiusBtn: document.getElementById("drawRadiusBtn"),
  clearRadiiBtn: document.getElementById("clearRadiiBtn"),
  kmlInput: document.getElementById("kmlInput"),
  clearKmlBtn: document.getElementById("clearKmlBtn"),
  toolTabs: Array.from(document.querySelectorAll(".tool-tab")),
  opswatchPanel: document.getElementById("opswatchApp"),
  crewStaffingPanel: document.getElementById("crewstaffingApp")
};

document.addEventListener("DOMContentLoaded", () => {
  initMap();
  bindEvents();
  bindToolTabs();
  render();
});

  initializeCrewStaffingInline();

function bindToolTabs() {
  if (!els.toolTabs.length) return;

  els.toolTabs.forEach(button => {
    button.addEventListener("click", () => setActiveTool(button.dataset.tool));
  });
}

function setActiveTool(tool) {
  const opswatchActive = tool === "opswatch";
  els.opswatchPanel.classList.toggle("active", opswatchActive);
  els.crewStaffingPanel.classList.toggle("active", !opswatchActive);
  els.opswatchPanel.hidden = !opswatchActive;
  els.crewStaffingPanel.hidden = opswatchActive;

  els.toolTabs.forEach(button => {
    const active = button.dataset.tool === tool;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });

  if (opswatchActive && map) {
    setTimeout(() => map.invalidateSize(), 50);
  }
}

function bindEvents() {
  els.type.addEventListener("change", toggleResourceFields);
  els.form.addEventListener("submit", addResource);
  els.useLocationBtn.addEventListener("click", useCurrentLocation);
  els.search.addEventListener("input", event => {
    searchQuery = event.target.value.trim().toLowerCase();
    render();
  });

  document.querySelectorAll(".filter").forEach(button => {
    button.addEventListener("click", () => {
      currentFilter = button.dataset.filter;
      document.querySelectorAll(".filter").forEach(item => item.classList.remove("active"));
      button.classList.add("active");
      render();
    });
  });

  els.exportBtn.addEventListener("click", exportJson);
  els.importInput.addEventListener("change", importJson);
  els.copySummaryBtn.addEventListener("click", copySummary);
  els.drawRadiusBtn.addEventListener("click", toggleRadiusMode);
  els.clearRadiiBtn.addEventListener("click", clearRadii);
  els.kmlInput.addEventListener("change", importKml);
  els.clearKmlBtn.addEventListener("click", clearKml);
}

function initMap() {
  map = L.map("map").setView([29.7604, -95.3698], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
  radiiLayer = L.layerGroup().addTo(map);
  bindRadiusDrawingEvents();
  refreshUserCoords();
}

function toggleResourceFields() {
  const isAir = els.type.value === "Air";
  const isVehicle = els.type.value === "Vehicle";
  els.airFields.classList.toggle("hidden", !isAir);
  els.vehicleFields.classList.toggle("hidden", !isVehicle);
  els.lat.required = true;
  els.lng.required = true;
  els.tail.required = isAir;
  els.vehicleNumber.required = isVehicle;
}

function addResource(event) {
  event.preventDefault();

  const type = els.type.value;
  const resource = {
    id: crypto.randomUUID(),
    type,
    name: els.name.value.trim(),
    label: els.label.value.trim() || els.name.value.trim(),
    status: els.status.value,
    lat: Number(els.lat.value),
    lng: Number(els.lng.value),
    notes: els.notes.value.trim(),
    crew: els.crew.value.trim(),
    tail: type === "Air" ? normalizeTail(els.tail.value) : "",
    vehicleNumber: type === "Vehicle" ? els.vehicleNumber.value.trim() : ""
  };

  if (!resource.name) return;

  if (!Number.isFinite(resource.lat) || !Number.isFinite(resource.lng)) {
    alert("All resources need valid latitude and longitude to place a map icon.");
    return;
  }

  if (type === "Air" && !resource.tail) {
    alert("Air resources need a tail number or registration.");
    return;
  }

  if (type === "Vehicle" && !resource.vehicleNumber) {
    alert("Vehicle resources need a vehicle number.");
    return;
  }

  resources.push(resource);
  saveResources();
  els.form.reset();
  els.type.value = "Ground";
  toggleResourceFields();
  render();
}

function render() {
  const visible = getVisibleResources();
  renderList(visible);
  queueMapRender(visible);
  els.count.textContent = `${visible.length} visible of ${resources.length} total`;
}

function queueMapRender(visible) {
  renderMap(visible);
}

function getVisibleResources() {
  return resources.filter(resource => {
    const matchesFilter = currentFilter === "All" || resource.type === currentFilter;
    const text = [
      resource.type,
      resource.name,
      resource.label,
      resource.status,
      resource.notes,
      resource.crew,
      resource.tail,
      resource.vehicleNumber,
      resource.lat,
      resource.lng
    ].join(" ").toLowerCase();

    return matchesFilter && text.includes(searchQuery);
  });
}

function renderList(visible) {
  els.list.innerHTML = "";

  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No resources match the current filters.";
    els.list.appendChild(empty);
    return;
  }

  const template = document.getElementById("resourceCardTemplate");

  visible.forEach(resource => {
    const card = template.content.firstElementChild.cloneNode(true);

    const badges = card.querySelector(".badges");
    badges.appendChild(makeBadge(resource.type, "type"));
    badges.appendChild(makeBadge(resource.status, `status-${slug(resource.status)}`));

    card.querySelector("h3").textContent = resource.name;
    card.querySelector(".resource-notes").textContent = resource.notes || "No notes entered.";

    const meta = card.querySelector(".resource-meta");
    const crewText = resource.crew || "No crew listed";
    if (resource.type === "Air") {
      meta.textContent = `Crew: ${crewText} · Tail / Registration: ${resource.tail}`;
    } else if (resource.type === "Vehicle") {
      meta.textContent = `Crew: ${crewText} · Vehicle Number: ${resource.vehicleNumber || "Not provided"} · ${resource.lat}, ${resource.lng}`;
    } else {
      meta.textContent = `Crew: ${crewText} · ${resource.label} · ${resource.lat}, ${resource.lng}`;
    }

    const actions = card.querySelector(".resource-actions");


    const statusSelect = document.createElement("select");
    statusSelect.className = "status-select";

    RESOURCE_STATUSES.forEach(statusOption => {
      const option = document.createElement("option");
      option.value = statusOption;
      option.textContent = statusOption;
      option.selected = statusOption === resource.status;
      statusSelect.appendChild(option);
    });

    statusSelect.addEventListener("change", event => {
      updateResourceStatus(resource.id, event.target.value);
    });
    actions.appendChild(statusSelect);

    if (resource.type === "Air") {
      actions.appendChild(makeLink("FlightAware", buildFlightAwareUrl(resource.tail)));
      actions.appendChild(makeLink("Flightradar24", buildFlightRadarUrl(resource.tail)));
    } else {
      actions.appendChild(makeLink("Open Map", buildMapUrl(resource.lat, resource.lng)));
    }

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => removeResource(resource.id));
    actions.appendChild(remove);

    els.list.appendChild(card);
  });
}

function renderMap(visible) {
  markersLayer.clearLayers();
  renderRadii();
  const mapResources = visible.filter(resource => Number.isFinite(Number(resource.lat)) && Number.isFinite(Number(resource.lng)));
  if (!mapResources.length) {
    if (userCoords) map.setView([Number(userCoords.lat), Number(userCoords.lng)], 12);
    return;
  }

  const bounds = [];
  mapResources.forEach(resource => {
    const marker = L.marker([Number(resource.lat), Number(resource.lng)], {
      draggable: true,
      icon: createColorMarker(resource.type)
    }).addTo(markersLayer);
    marker.bindPopup(`<strong>${escapeHtml(resource.name)}</strong><br>${escapeHtml(resource.type)} · ${escapeHtml(resource.label || resource.name)}`);
    marker.on("dragend", event => {
      const point = event.target.getLatLng();
      resource.lat = Number(point.lat.toFixed(6));
      resource.lng = Number(point.lng.toFixed(6));
      saveResources();
      renderList(getVisibleResources());
    });
    bounds.push([Number(resource.lat), Number(resource.lng)]);
  });

  map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });
}

function createColorMarker(type) {
  const color = TYPE_COLORS[type] || "#334155";
  return L.divIcon({
    className: "resource-pin-wrapper",
    html: `<span style="display:block;width:14px;height:14px;border-radius:999px;background:${color};border:2px solid #fff;box-shadow:0 0 0 1px rgba(15,23,42,0.35);"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10]
  });
}

function toggleRadiusMode() {
  isDrawRadiusMode = !isDrawRadiusMode;
  els.drawRadiusBtn.classList.toggle("active", isDrawRadiusMode);
  els.drawRadiusBtn.textContent = isDrawRadiusMode ? "Drawing Radius..." : "Draw Radius";
}

function bindRadiusDrawingEvents() {
  map.on("mousedown", event => {
    if (!isDrawRadiusMode) return;
    activeRadius = {
      id: crypto.randomUUID(),
      type: currentFilter === "All" ? "Ground" : currentFilter,
      center: event.latlng,
      radiusMeters: 0
    };
    draftCircle = L.circle(activeRadius.center, {
      radius: 0,
      color: TYPE_COLORS[activeRadius.type] || TYPE_COLORS.Ground,
      weight: 2,
      fillOpacity: 0.08
    }).addTo(radiiLayer);
    map.dragging.disable();
  });

  map.on("mousemove", event => {
    if (movingRadiusId) {
      const radiusToMove = radii.find(item => item.id === movingRadiusId);
      if (!radiusToMove || !movingRadiusOffset) return;

      radiusToMove.center = {
        lat: Number((event.latlng.lat - movingRadiusOffset.lat).toFixed(6)),
        lng: Number((event.latlng.lng - movingRadiusOffset.lng).toFixed(6))
      };
      renderRadii();
      return;
    }

    if (!activeRadius || !draftCircle) return;
    const meters = activeRadius.center.distanceTo(event.latlng);
    activeRadius.radiusMeters = Number(meters.toFixed(1));
    draftCircle.setRadius(activeRadius.radiusMeters);
  });

  map.on("mouseup", () => {
    if (movingRadiusId) {
      movingRadiusId = null;
      movingRadiusOffset = null;
      map.dragging.enable();
      saveRadii();
      return;
    }

    if (!activeRadius || !draftCircle) return;
    map.dragging.enable();
    radii.push({
      id: activeRadius.id,
      type: activeRadius.type,
      center: {
        lat: Number(activeRadius.center.lat.toFixed(6)),
        lng: Number(activeRadius.center.lng.toFixed(6))
      },
      radiusMeters: Math.max(activeRadius.radiusMeters, 1)
    });
    activeRadius = null;
    draftCircle = null;
    saveRadii();
    render();
  });
}

function renderRadii() {
  radiiLayer.clearLayers();
  radii.forEach(item => {
    const circle = L.circle([item.center.lat, item.center.lng], {
      radius: Number(item.radiusMeters),
      color: TYPE_COLORS[item.type] || TYPE_COLORS.Ground,
      weight: 2,
      fillOpacity: 0.08
    }).addTo(radiiLayer);

    circle.on("mousedown", event => {
      if (isDrawRadiusMode) return;
      const center = L.latLng(item.center.lat, item.center.lng);
      movingRadiusId = item.id;
      movingRadiusOffset = {
        lat: event.latlng.lat - center.lat,
        lng: event.latlng.lng - center.lng
      };
      map.dragging.disable();
    });
  });
}

function clearRadii() {
  radii = [];
  saveRadii();
  render();
}


function updateResourceStatus(id, status) {
  const resource = resources.find(item => item.id === id);
  if (!resource || !RESOURCE_STATUSES.includes(status)) return;

  resource.status = status;
  saveResources();
  render();
}

function removeResource(id) {
  resources = resources.filter(resource => resource.id !== id);
  saveResources();
  render();
}

function useCurrentLocation() {
  if (!navigator.geolocation) {
    alert("Geolocation is not available in this browser.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    position => {
      const lat = position.coords.latitude.toFixed(6);
      const lng = position.coords.longitude.toFixed(6);
      els.lat.value = lat;
      els.lng.value = lng;
      userCoords = { lat, lng };
      render();
    },
    () => alert("Could not get your current location.")
  );
}

function refreshUserCoords() {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    position => {
      userCoords = {
        lat: position.coords.latitude.toFixed(6),
        lng: position.coords.longitude.toFixed(6)
      };
      render();
    },
    () => {
      userCoords = null;
    }
  );
}

function exportJson() {
  const blob = new Blob([JSON.stringify(resources, null, 2)], {
    type: "application/json"
  });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `resource-tracker-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();

  URL.revokeObjectURL(link.href);
}

function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const imported = JSON.parse(String(reader.result));
      if (!Array.isArray(imported)) throw new Error("Import must be an array.");

      resources = imported.map(resource => ({
        id: resource.id || crypto.randomUUID(),
        type: resource.type || "Ground",
        name: resource.name || "Unnamed Resource",
        label: resource.label || resource.name || "Resource",
        status: resource.status || "Available",
        lat: resource.lat ?? "",
        lng: resource.lng ?? "",
        notes: resource.notes || "",
        crew: resource.crew || "",
        tail: resource.tail || ""
      }));

      saveResources();
      render();
    } catch (error) {
      alert("Could not import this file. Please upload a valid Resource Tracker JSON export.");
    } finally {
      event.target.value = "";
    }
  };

  reader.readAsText(file);
}

function copySummary() {
  const summary = resources.map(resource => {
    if (resource.type === "Air") {
      return `${resource.type}: ${resource.name} (${resource.tail}) - Crew: ${resource.crew || "No crew"} - ${resource.status} - ${resource.notes || "No notes"}`;
    }

    return `${resource.type}: ${resource.name} [${resource.label}] - Crew: ${resource.crew || "No crew"} - ${resource.status} - ${resource.lat}, ${resource.lng} - ${resource.notes || "No notes"}`;
  }).join("\n");

  navigator.clipboard.writeText(summary).then(
    () => alert("Resource summary copied."),
    () => alert("Could not copy the summary.")
  );
}


function importKml(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const xml = new DOMParser().parseFromString(String(reader.result), "application/xml");
      if (xml.querySelector("parsererror")) throw new Error("Invalid XML");
      const features = parseKmlFeatures(xml);
      if (!features.length) throw new Error("No supported geometry");

      const geoJson = { type: "FeatureCollection", features };
      if (kmlLayer) map.removeLayer(kmlLayer);
      kmlLayer = L.geoJSON(geoJson, {
        style: { color: "#0f766e", weight: 3, opacity: 0.9, fillOpacity: 0.14 },
        pointToLayer: (_feature, latlng) => L.circleMarker(latlng, { radius: 6, color: "#0f766e", fillColor: "#14b8a6", fillOpacity: 0.9, weight: 2 }),
        onEachFeature: (feature, layer) => {
          const name = feature.properties?.name;
          if (name) layer.bindPopup(`<strong>${escapeHtml(name)}</strong>`);
        }
      }).addTo(map);

      const bounds = kmlLayer.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
    } catch (_error) {
      alert("Could not import this KML file. Please upload a valid Google Earth KML with Point, LineString, or Polygon data.");
    } finally {
      event.target.value = "";
    }
  };

  reader.readAsText(file);
}

function clearKml() {
  if (!kmlLayer) return;
  map.removeLayer(kmlLayer);
  kmlLayer = null;
}

function parseKmlFeatures(xml) {
  const placemarks = Array.from(xml.getElementsByTagName("Placemark"));
  return placemarks.flatMap(placemark => {
    const name = placemark.getElementsByTagName("name")[0]?.textContent?.trim() || "";

    const point = placemark.getElementsByTagName("Point")[0];
    if (point) {
      const coordinates = extractCoordinates(point);
      if (coordinates.length) {
        return [{ type: "Feature", properties: { name }, geometry: { type: "Point", coordinates: coordinates[0] } }];
      }
    }

    const line = placemark.getElementsByTagName("LineString")[0];
    if (line) {
      const coordinates = extractCoordinates(line);
      if (coordinates.length > 1) {
        return [{ type: "Feature", properties: { name }, geometry: { type: "LineString", coordinates } }];
      }
    }

    const polygon = placemark.getElementsByTagName("Polygon")[0];
    if (polygon) {
      const outerBoundary = polygon.getElementsByTagName("outerBoundaryIs")[0] || polygon;
      const ring = extractCoordinates(outerBoundary);
      if (ring.length > 2) {
        return [{ type: "Feature", properties: { name }, geometry: { type: "Polygon", coordinates: [ring] } }];
      }
    }

    return [];
  });
}

function extractCoordinates(parent) {
  const text = parent.getElementsByTagName("coordinates")[0]?.textContent || "";
  return text
    .trim()
    .split(/\s+/)
    .map(raw => raw.split(",").map(Number))
    .filter(parts => Number.isFinite(parts[0]) && Number.isFinite(parts[1]))
    .map(parts => [parts[0], parts[1]]);
}

function makeBadge(text, className) {
  const badge = document.createElement("span");
  badge.className = `badge ${className}`;
  badge.textContent = text;
  return badge;
}

function makeLink(text, href) {
  const link = document.createElement("a");
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = text;
  return link;
}

function normalizeTail(tail) {
  return tail.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

function buildFlightAwareUrl(tail) {
  return `https://www.flightaware.com/live/flight/${encodeURIComponent(normalizeTail(tail))}`;
}

function buildFlightRadarUrl(tail) {
  return `https://www.flightradar24.com/data/aircraft/${encodeURIComponent(normalizeTail(tail).toLowerCase())}`;
}

function buildMapUrl(lat, lng) {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
}

function loadResources() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : defaultResources;
  } catch {
    return defaultResources;
  }
}

function saveResources() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(resources));
}

function loadRadii() {
  try {
    const saved = localStorage.getItem(RADII_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveRadii() {
  localStorage.setItem(RADII_STORAGE_KEY, JSON.stringify(radii));
}

function slug(value) {
  return value.toLowerCase().replace(/\s+/g, "-");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function normalizeResource(resource) {
  return {
    ...resource,
    crew: resource.crew || "",
    tail: resource.tail || "",
    vehicleNumber: resource.vehicleNumber || ""
  };
}
