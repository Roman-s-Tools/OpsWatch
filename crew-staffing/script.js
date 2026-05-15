const STORAGE_KEY = "romans-assignment-roster-v1";
const INCIDENT_KEY = "romans-assignment-roster-incident-v1";
const STATUSES = ["Assigned", "Available", "Enroute", "Onscene", "Released", "Unavailable"];
const SECTIONS = ["Command Staff", "Operations Section", "Planning Section", "Logistics Section", "Finance/Admin Section", "Air Operations", "Ground Operations", "Mission Base", "Other"];
const POSITIONS_BY_SECTION = {
  "Command Staff": ["Incident Commander", "Deputy Incident Commander", "Safety Officer", "Public Information Officer", "Liaison Officer"],
  "Planning Section": ["Planning Section Chief", "Planning Section Deputy Chief", "Resources Unit", "Situation Unit", "Documentation Unit", "Demobilization Unit", "Technical Specialist"],
  "Operations Section": ["Operations Section Chief", "Operations Section Deputy Chief", "Staging Area Manager"],
  "Logistics Section": ["Logistics Section Chief", "Logistics Section Deputy Chief", "Supply Unit", "Facilities Unit", "Ground Support Unit", "Communications Unit", "Medical Unit", "Food Unit"],
  "Finance/Admin Section": ["Finance/Admin Section Chief", "Finance/Admin Section Deputy Chief", "Time Unit", "Procurement Unit", "Comp/Claims Unit", "Cost Unit"],
  "Ground Operations": ["Ground Branch Director", "Ground Branch Deputy Director", "Ground Team Leader", "Ground Team Member", "sUAS Team", "UDF Team", "POD Team"],
  "Air Operations": ["Air Operations Branch Director", "Air Operations Branch Deputy Director", "Flight Release Officer", "Senior Flight Release Officer", "Aircrew"]
};

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
  positionSelect: document.getElementById("positionSelect"),
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
  bindParentMessages();
  updatePositionField();
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
  els.section.addEventListener("change", updatePositionField);
  els.positionSelect.addEventListener("change", () => {
    els.position.value = els.positionSelect.value;
  });
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

function bindParentMessages() {
  window.addEventListener("message", event => {
    if (event.origin !== window.location.origin || !event.data || typeof event.data !== "object") return;
    const { type, text } = event.data;
    if (type === "crewstaffing:print") {
      window.print();
      return;
    }
    if (type === "crewstaffing:export") {
      exportJson();
      return;
    }
    if (type === "crewstaffing:clear") {
      clearEntirePage();
      return;
    }
    if (type === "crewstaffing:import" && typeof text === "string") {
      importJsonText(text);
    }
  });
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
  notifyParentStateChanged();
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
  updatePositionField();
  els.status.value = "Assigned";
  render();
}

function updatePositionField() {
  const selectedSection = els.section.value;
  const positions = POSITIONS_BY_SECTION[selectedSection] || [];
  const allowFreeText = selectedSection === "Other" || !positions.length;

  els.positionSelect.innerHTML = "";
  if (allowFreeText) {
    els.positionSelect.disabled = true;
    els.positionSelect.hidden = true;
    els.position.hidden = false;
    els.position.placeholder = "Enter custom position / role";
    return;
  }

  positions.forEach((position, index) => {
    const option = document.createElement("option");
    option.value = position;
    option.textContent = position;
    if (index === 0) option.selected = true;
    els.positionSelect.appendChild(option);
  });

  els.positionSelect.disabled = false;
  els.positionSelect.hidden = false;
  els.position.hidden = true;
  els.position.value = els.positionSelect.value;
}

function render() {
  const visible = getVisiblePeople();
  renderList(visible);
  renderIcsView();
  els.count.textContent = `${visible.length} visible of ${people.length} total`;
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
    badges.appendChild(makeBadge(person.status, `status-${slug(person.status)}`));
    card.querySelector("h3").textContent = person.name;
    card.querySelector(".resource-notes").textContent = person.notes || "No notes entered.";
    card.querySelector(".resource-meta").textContent = `CAPID: ${person.capid} · ${person.position} · ${person.assignment}`;
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
    ["Prepared By / Date", `${incident.preparedBy || "Not specified"} · ${incident.preparedAt || "Not specified"}`]
  ].forEach(([label, value]) => {
    const cell = document.createElement("div");
    cell.className = "meta-cell";
    cell.innerHTML = `<span class="meta-label">${escapeHtml(label)}</span><span class="meta-value">${escapeHtml(value)}</span>`;
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
    wrap.innerHTML = `<h3>${escapeHtml(section)}</h3><table><thead><tr><th>Assignment</th><th>Position</th><th>Name</th><th>CAPID</th><th>Status</th><th>Notes</th></tr></thead><tbody></tbody></table>`;
    const tbody = wrap.querySelector("tbody");
    sectionPeople.forEach(person => {
      const row = document.createElement("tr");
      row.innerHTML = `<td>${escapeHtml(person.assignment)}</td><td>${escapeHtml(person.position)}</td><td>${escapeHtml(person.name)}</td><td>${escapeHtml(person.capid)}</td><td>${escapeHtml(person.status)}</td><td>${escapeHtml(person.notes || "")}</td>`;
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
    card.innerHTML = `<p class="chain-slot">${escapeHtml(slot)}</p><p class="chain-person">${escapeHtml(match ? match.name : "Unassigned")}</p><p class="chain-role">${escapeHtml(match ? `${match.position} · ${match.assignment}` : "Add a matching position to auto-populate")}</p>`;
    els.chainOfCommand.appendChild(card);
  });
}

function editPerson(id) {
  const person = people.find(item => item.id === id);
  if (!person) return;
  els.name.value = person.name;
  els.capid.value = person.capid;
  els.section.value = person.section;
  updatePositionField();
  els.position.value = person.position;
  if (!els.positionSelect.disabled) {
    if ([...els.positionSelect.options].some(option => option.value === person.position)) {
      els.positionSelect.value = person.position;
    } else {
      const custom = document.createElement("option");
      custom.value = person.position;
      custom.textContent = `${person.position} (Imported)`;
      els.positionSelect.appendChild(custom);
      els.positionSelect.value = person.position;
    }
  }
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
  lines.push(`Incident / Mission: ${incident.incidentName || "Not specified"}`);
  lines.push(`Mission Number: ${incident.missionNumber || "Not specified"}`);
  lines.push(`Operational Period: ${incident.operationalPeriod || "Not specified"}`);
  lines.push(`Prepared By / Date: ${incident.preparedBy || "Not specified"} · ${incident.preparedAt || "Not specified"}`);
  lines.push("");
  SECTIONS.forEach(section => {
    const sectionPeople = people.filter(person => person.section === section);
    if (!sectionPeople.length) return;
    lines.push(section.toUpperCase());
    sectionPeople.forEach(person => {
      lines.push(`- ${person.assignment}: ${person.position} — ${person.name} (${person.capid}) [${person.status}]${person.notes ? ` — ${person.notes}` : ""}`);
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
  link.download = `assignment-roster-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function importJsonText(text) {
  try {
    const imported = JSON.parse(text);
    const importedPeople = Array.isArray(imported) ? imported : imported.people;
    if (!Array.isArray(importedPeople)) throw new Error("Missing people array.");
    people = importedPeople.map(normalizePerson).filter(Boolean);
    incident = imported && typeof imported === "object" ? normalizeIncident(imported.incident) : loadIncident();
    savePeople();
    localStorage.setItem(INCIDENT_KEY, JSON.stringify(incident));
    hydrateIncidentForm();
    render();
  } catch {
    alert("Could not import this file. Exported Assignment Roster JSON is expected.");
  }
}

function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    importJsonText(String(reader.result || ""));
    els.importInput.value = "";
  };
  reader.readAsText(file);
}

function normalizeIncident(importedIncident) {
  if (!importedIncident || typeof importedIncident !== "object") return loadIncident();
  return { ...loadIncident(), ...importedIncident };
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
  notifyParentStateChanged();
}

function loadIncident() {
  try { return JSON.parse(localStorage.getItem(INCIDENT_KEY) || "{}"); }
  catch { return {}; }
}

function makeBadge(text, className) {
  const badge = document.createElement("span");
  badge.className = `badge ${className}`;
  badge.textContent = text;
  return badge;
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function notifyParentStateChanged() {
  if (window.parent === window) return;
  window.parent.postMessage({ type: "crewstaffing:state:update" }, window.location.origin);
}
