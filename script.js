const STORAGE_KEY = "romans-resource-tracker-v1";
const RADII_STORAGE_KEY = "romans-resource-radii-v1";
const ACTIVITY_LOG_STORAGE_KEY = "romans-activity-log-v1";
const BREADCRUMB_STORAGE_KEY = "romans-breadcrumb-v1";
const LIVE_IDENTITY_STORAGE_KEY = "romans-live-identity-v1";
const WMIRS_DISCLAIMER_ACK_KEY = "romans-wmirs-disclaimer-ack-v1";
const RESOURCE_STATUSES = ["Available", "Assigned", "Enroute", "Onscene", "Offline"];
const STALE_THRESHOLD_MS = 30 * 60 * 1000;
const ACTIVITY_LOG_LIMIT = 500;
const BREADCRUMB_LIMIT = 1000;

const TYPE_COLORS = {
  Ground: "#2563eb",
  sUAS: "#7c3aed",
  Air: "#dc2626",
  Vehicle: "#ea580c",
  "Incident Command Post": "#0f766e",
  "Staging Area": "#9333ea"
};

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
let editingResourceId = null;
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
let lastBoundsKey = null;
let dashboardWindow = null;
let liveSyncProvider = null;
let liveSyncMap = null;
let applyingLiveSync = false;
let receivedRemoteLiveState = false;
let isLiveViewer = false;
let liveSessionPassword = "";
let activityLog = loadActivityLog();
let staleMonitorId = null;
let storageWarned = false;
let trackWatchId = null;
let breadcrumb = loadBreadcrumb();
let breadcrumbLayer = null;

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
  resourceSubmitBtn: document.getElementById("resourceSubmitBtn"),
  resourceCancelEditBtn: document.getElementById("resourceCancelEditBtn"),
  list: document.getElementById("resourceList"),
  count: document.getElementById("resourceCount"),
  search: document.getElementById("searchInput"),
  exportBtn: document.getElementById("exportBtn"),
  importInput: document.getElementById("importInput"),
  openDashboardBtn: document.getElementById("openDashboardBtn"),
  shareLiveBtn: document.getElementById("shareLiveBtn"),
  shareEditableBtn: document.getElementById("shareEditableBtn"),
  liveStatus: document.getElementById("liveStatus"),
  livePeers: document.getElementById("livePeers"),
  trackMeBtn: document.getElementById("trackMeBtn"),
  clearTrailBtn: document.getElementById("clearTrailBtn"),
  showDisclaimerBtn: document.getElementById("showDisclaimerBtn"),
  seedDemoDataBtn: document.getElementById("seedDemoDataBtn"),
  clearResourcesPeopleBtn: document.getElementById("clearResourcesPeopleBtn"),
  copySummaryBtn: document.getElementById("copySummaryBtn"),
  drawRadiusBtn: document.getElementById("drawRadiusBtn"),
  clearRadiiBtn: document.getElementById("clearRadiiBtn"),
  kmlInput: document.getElementById("kmlInput"),
  clearKmlBtn: document.getElementById("clearKmlBtn"),
  toolTabs: Array.from(document.querySelectorAll(".tool-tab")),
  opswatchPanel: document.getElementById("opswatchApp"),
  crewStaffingPanel: document.getElementById("crewstaffingApp"),
  crewStaffingFrame: document.getElementById("crewStaffingFrame"),
  crewPrintBtn: document.getElementById("crewPrintBtn"),
  crewExportBtn: document.getElementById("crewExportBtn"),
  crewImportInput: document.getElementById("crewImportInput"),
  crewClearBtn: document.getElementById("crewClearBtn"),
  wmirsDisclaimerModal: document.getElementById("wmirsDisclaimerModal"),
  wmirsDisclaimerAcknowledgeBtn: document.getElementById("wmirsDisclaimerAcknowledgeBtn"),
  fieldNotesPanel: document.getElementById("fieldNotesApp"),
  fieldNoteForm: document.getElementById("fieldNoteForm"),
  fieldNoteName: document.getElementById("fieldNoteName"),
  fieldNoteRole: document.getElementById("fieldNoteRole"),
  fieldNoteText: document.getElementById("fieldNoteText"),
  fieldNotesList: document.getElementById("fieldNotesList"),
  fieldNotesCount: document.getElementById("fieldNotesCount"),
  fieldNotesPrintBtn: document.getElementById("fieldNotesPrintBtn"),
  fieldNotesExportBtn: document.getElementById("fieldNotesExportBtn"),
  fieldNotesImportInput: document.getElementById("fieldNotesImportInput")
};

document.addEventListener("DOMContentLoaded", () => {
  initLiveSync();
  initWmirsDisclaimer();
  initMap();
  bindEvents();
  bindToolTabs();
  bindCrewStaffingControls();
  bindAssignmentBoardControls();
  bindFieldNotesControls();
  bindActivityControls();
  bindIcsControls();
  bindTrackingControls();
  loadAssignmentPeople();
  render();
  renderAssignmentBoard();
  renderFieldNotes();
  bindCommandControls();
  renderCommandPanel();
  renderActivityLog();
  renderBreadcrumb();
  startStaleMonitor();
});

function initWmirsDisclaimer() {
  if (!els.wmirsDisclaimerModal || !els.wmirsDisclaimerAcknowledgeBtn) return;
  els.wmirsDisclaimerAcknowledgeBtn.addEventListener("click", acknowledgeWmirsDisclaimer);
  const acknowledged = localStorage.getItem(WMIRS_DISCLAIMER_ACK_KEY) === "true";
  if (acknowledged) return;
  els.wmirsDisclaimerModal.classList.remove("hidden");
}

function acknowledgeWmirsDisclaimer() {
  localStorage.setItem(WMIRS_DISCLAIMER_ACK_KEY, "true");
  els.wmirsDisclaimerModal?.classList.add("hidden");
}

function bindCrewStaffingControls() {
  if (!els.crewStaffingFrame) return;
  els.crewPrintBtn?.addEventListener("click", () => sendCrewStaffingMessage({ type: "crewstaffing:print" }));
  els.crewExportBtn?.addEventListener("click", () => sendCrewStaffingMessage({ type: "crewstaffing:export" }));
  els.crewClearBtn?.addEventListener("click", () => sendCrewStaffingMessage({ type: "crewstaffing:clear" }));
  els.crewImportInput?.addEventListener("change", event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      sendCrewStaffingMessage({ type: "crewstaffing:import", text: String(reader.result || "") });
      event.target.value = "";
    };
    reader.readAsText(file);
  });
  window.addEventListener("message", event => {
    if (event.origin !== window.location.origin || !event.data || typeof event.data !== "object") return;
    if (event.data.type !== "crewstaffing:state:update") return;
    loadAssignmentPeople();
    renderAssignmentBoard();
    publishLiveState();
  });
}

function sendCrewStaffingMessage(message) {
  const frameWindow = els.crewStaffingFrame?.contentWindow;
  if (!frameWindow) return;
  frameWindow.postMessage(message, window.location.origin);
}


function bindToolTabs() {
  if (!els.toolTabs.length) return;

  els.toolTabs.forEach(button => {
    button.addEventListener("click", () => setActiveTool(button.dataset.tool));
  });
}

function setActiveTool(tool) {
  const opswatchActive = tool === "opswatch";
  const crewStaffingActive = tool === "crewstaffing";
  const assignmentBoardActive = tool === "assignmentboard";
  const fieldNotesActive = tool === "fieldnotes";
  const activityActive = tool === "activity";
  const commandActive = tool === "command";
  els.opswatchPanel.classList.toggle("active", opswatchActive);
  els.crewStaffingPanel.classList.toggle("active", crewStaffingActive);
  els.assignmentBoardPanel.classList.toggle("active", assignmentBoardActive);
  els.fieldNotesPanel.classList.toggle("active", fieldNotesActive);
  els.activityPanel?.classList.toggle("active", activityActive);
  els.commandPanel.classList.toggle("active", commandActive);
  els.opswatchPanel.hidden = !opswatchActive;
  els.crewStaffingPanel.hidden = !crewStaffingActive;
  els.assignmentBoardPanel.hidden = !assignmentBoardActive;
  els.fieldNotesPanel.hidden = !fieldNotesActive;
  if (els.activityPanel) els.activityPanel.hidden = !activityActive;
  els.commandPanel.hidden = !commandActive;

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
  els.resourceCancelEditBtn?.addEventListener("click", exitEditMode);
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
  els.showDisclaimerBtn?.addEventListener("click", showWmirsDisclaimer);
  els.openDashboardBtn?.addEventListener("click", openDashboardWindow);
  els.shareLiveBtn?.addEventListener("click", () => shareLiveLink({ editable: false }));
  els.shareEditableBtn?.addEventListener("click", () => shareLiveLink({ editable: true }));
  els.seedDemoDataBtn?.addEventListener("click", seedDemoData);
  els.clearResourcesPeopleBtn?.addEventListener("click", clearResourcesAndPeople);
  els.copySummaryBtn.addEventListener("click", copySummary);
  els.drawRadiusBtn.addEventListener("click", toggleRadiusMode);
  els.clearRadiiBtn.addEventListener("click", clearRadii);
  els.kmlInput.addEventListener("change", importKml);
  els.clearKmlBtn.addEventListener("click", clearKml);
}

function initLiveSync() {
  if (!window.Y || !window.WebrtcProvider) return;
  if (liveSyncProvider) return;
  const url = new URL(window.location.href);
  const existingSession = url.searchParams.get("live");
  if (!existingSession) return;

  // A shared link arrives as ?live=<room>&view=1#k=<password>. The password
  // lives in the URL fragment so it is never sent to the signaling server; it
  // encrypts peer-to-peer sync traffic. view=1 marks a read-only viewer.
  isLiveViewer = url.searchParams.get("view") === "1";
  liveSessionPassword = new URLSearchParams(url.hash.replace(/^#/, "")).get("k") || "";

  const roomId = `opswatch-${existingSession}`;
  const ydoc = new window.Y.Doc();
  liveSyncMap = ydoc.getMap("opswatch-state");
  const options = {};
  if (liveSessionPassword) options.password = liveSessionPassword;
  liveSyncProvider = new window.WebrtcProvider(roomId, ydoc, options);

  // State is stored as individual keys on the shared map (one per workspace
  // section) rather than a single blob. With last-writer-wins applied per key,
  // two editors touching different sections (say resources vs. field notes)
  // no longer clobber each other's work.
  liveSyncMap.observe(event => {
    const payload = {};
    let sawState = false;
    event.keysChanged.forEach(key => {
      if (key === "updatedAt") return;
      payload[key] = liveSyncMap.get(key);
      sawState = true;
    });
    if (!sawState) return;
    receivedRemoteLiveState = true;
    applyingLiveSync = true;
    applyLiveState(payload);
    applyingLiveSync = false;
  });

  const awareness = liveSyncProvider.awareness;
  if (awareness) {
    awareness.setLocalStateField("role", isLiveViewer ? "viewer" : "editor");
    awareness.setLocalStateField("name", isLiveViewer ? "" : loadLiveIdentity().name);
    awareness.on("change", updateLiveStatus);
  }
  liveSyncProvider.on("status", updateLiveStatus);

  applyViewerMode();
  updateLiveStatus();

  // Viewers never broadcast; editors seed the room if no one else has yet.
  if (!isLiveViewer) {
    window.setTimeout(() => {
      if (!receivedRemoteLiveState) publishLiveState();
    }, 1200);
  }
}

function applyViewerMode() {
  if (!isLiveViewer) return;
  document.body.classList.add("live-viewer");
  let banner = document.getElementById("liveViewerBanner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "liveViewerBanner";
    banner.textContent = "Read-only live view — changes here are not saved or shared.";
    document.body.prepend(banner);
  }
}

function updateLiveStatus() {
  if (!els.liveStatus) return;
  if (!liveSyncProvider) {
    els.liveStatus.textContent = "";
    els.liveStatus.hidden = true;
    if (els.livePeers) els.livePeers.hidden = true;
    return;
  }
  const awareness = liveSyncProvider.awareness;
  const states = awareness ? Array.from(awareness.getStates().entries()) : [];
  const localId = awareness ? awareness.clientID : null;
  const others = states.filter(([id]) => id !== localId).map(([, state]) => state || {});
  const peers = others.length;
  const editors = others.filter(state => state.role === "editor").length;
  const connected = liveSyncProvider.connected;
  const role = isLiveViewer ? "Viewing" : "Sharing";
  els.liveStatus.hidden = false;
  els.liveStatus.textContent = `● Live ${role} · ${peers} other${peers === 1 ? "" : "s"} connected${editors ? ` (${editors} editing)` : ""}${connected ? "" : " · connecting…"}`;

  if (els.livePeers) {
    const labels = others
      .map(state => {
        const name = state.name || (state.role === "viewer" ? "Viewer" : "Editor");
        return state.role === "viewer" ? `${name} (view)` : name;
      })
      .filter(Boolean);
    els.livePeers.hidden = labels.length === 0;
    els.livePeers.textContent = labels.length ? `Connected: ${labels.join(", ")}` : "";
  }
}

function applyLiveState(payload) {
  if (Array.isArray(payload.resources)) resources = payload.resources.map(normalizeResource);
  if (Array.isArray(payload.radii)) radii = payload.radii;
  if (Array.isArray(payload.assignmentPeople)) assignmentPeople = payload.assignmentPeople;
  if (payload.crewStaffingIncident && typeof payload.crewStaffingIncident === "object") {
    writeJson(CREW_STAFFING_INCIDENT_STORAGE_KEY, payload.crewStaffingIncident);
  }
  if (payload.assignmentSlots && typeof payload.assignmentSlots === "object") assignmentSlots = payload.assignmentSlots;
  if (Array.isArray(payload.fieldNotes)) fieldNotes = payload.fieldNotes;
  if (payload.commandStatuses && typeof payload.commandStatuses === "object") commandStatuses = payload.commandStatuses;
  if (payload.commandBanner && typeof payload.commandBanner === "object") commandBanner = payload.commandBanner;
  if (payload.commandObjectives && typeof payload.commandObjectives === "object") commandObjectives = payload.commandObjectives;
  if (Array.isArray(payload.activityLog)) activityLog = payload.activityLog;

  writeJson(STORAGE_KEY, resources);
  writeJson(RADII_STORAGE_KEY, radii);
  writeJson(CREW_STAFFING_STORAGE_KEY, assignmentPeople);
  writeJson(ASSIGNMENT_BOARD_STORAGE_KEY, assignmentSlots);
  writeJson(FIELD_NOTES_STORAGE_KEY, fieldNotes);
  writeJson(COMMAND_STORAGE_KEY, commandStatuses);
  writeJson(`${COMMAND_STORAGE_KEY}-banner`, commandBanner);
  writeJson(`${COMMAND_STORAGE_KEY}-objectives`, commandObjectives);
  writeJson(ACTIVITY_LOG_STORAGE_KEY, activityLog);
  render();
  renderAssignmentBoard();
  renderFieldNotes();
  renderCommandPanel();
  renderActivityLog();
}

function publishLiveState() {
  if (!liveSyncMap || applyingLiveSync || isLiveViewer) return;
  const snapshot = {
    resources,
    radii,
    assignmentPeople,
    crewStaffingIncident: loadCrewStaffingIncident(),
    assignmentSlots,
    fieldNotes,
    commandStatuses,
    commandBanner,
    commandObjectives,
    activityLog
  };
  // One transaction so peers see a single, atomic update per publish.
  liveSyncMap.doc.transact(() => {
    Object.entries(snapshot).forEach(([key, value]) => liveSyncMap.set(key, value));
    liveSyncMap.set("updatedAt", Date.now());
  });
}

async function shareLiveLink({ editable = false } = {}) {
  if (isLiveViewer) {
    alert("This is a read-only viewer session, so it cannot start a new share.");
    return;
  }

  if (editable) promptForLiveIdentity();

  const url = new URL(window.location.href);
  if (!url.searchParams.get("live")) {
    url.searchParams.set("live", crypto.randomUUID().slice(0, 8));
    // Mint a one-time encryption password and keep it in the fragment so it
    // stays out of the room name / signaling traffic.
    liveSessionPassword = crypto.randomUUID().replace(/-/g, "");
    url.hash = `k=${liveSessionPassword}`;
    window.history.replaceState({}, "", url.toString());
    initLiveSync();
  }
  publishLiveState();

  // Editable links open as co-editors (no view flag); the default link is a
  // read-only viewer. Either way the host keeps full editing rights.
  const shareUrlObj = new URL(url.toString());
  if (editable) shareUrlObj.searchParams.delete("view");
  else shareUrlObj.searchParams.set("view", "1");
  if (liveSessionPassword) shareUrlObj.hash = `k=${liveSessionPassword}`;
  const shareUrl = shareUrlObj.toString();

  const message = editable
    ? "Editable live link copied. Anyone with this link can edit the board with you in real time."
    : "Read-only live link copied. Anyone with this link can watch your board update in real time.";

  try {
    await navigator.clipboard.writeText(shareUrl);
    alert(message);
  } catch {
    window.prompt("Copy this live link:", shareUrl);
  }
  updateLiveStatus();
}

function loadLiveIdentity() {
  const saved = readJson(LIVE_IDENTITY_STORAGE_KEY, {});
  return { name: saved && typeof saved === "object" ? String(saved.name || "") : "" };
}

function promptForLiveIdentity() {
  const current = loadLiveIdentity().name;
  const name = window.prompt("Your name or callsign (shown to other editors):", current);
  if (name === null) return;
  writeJson(LIVE_IDENTITY_STORAGE_KEY, { name: name.trim() });
  const awareness = liveSyncProvider?.awareness;
  if (awareness && !isLiveViewer) awareness.setLocalStateField("name", name.trim());
}

function showWmirsDisclaimer() {
  els.wmirsDisclaimerModal?.classList.remove("hidden");
}


function seedDemoData() {
  const confirmed = window.confirm("Disclaimer: placeholder example resources, incident/mission info, and people assignments will be added for review only. Continue?");
  if (!confirmed) return;

  resources = [
    ...defaultResources.map(normalizeResource),
    { id: crypto.randomUUID(), type: "Air", name: "CAP Cessna 182", label: "AIR-1", status: "Enroute", lat: 29.742, lng: -95.355, notes: "Placeholder air resource for workflow review", crew: "Aircrew 3", tail: "N987CP", vehicleNumber: "" },
    { id: crypto.randomUUID(), type: "Vehicle", name: "Operations SUV", label: "V-12", status: "Assigned", lat: 29.758, lng: -95.371, notes: "Placeholder mission base support", crew: "Logistics", tail: "", vehicleNumber: "Unit 12" },
    { id: crypto.randomUUID(), type: "Incident Command Post", name: "Mission Base ICP", label: "ICP", status: "Onscene", lat: 29.7634, lng: -95.3661, notes: "Placeholder command post", crew: "Command Staff", tail: "", vehicleNumber: "" },
    { id: crypto.randomUUID(), type: "Staging Area", name: "Staging Lot Alpha", label: "STAGE-A", status: "Available", lat: 29.7489, lng: -95.3441, notes: "Placeholder staging area", crew: "Ground Support", tail: "", vehicleNumber: "" }
  ];

  const demoPeople = [
    { id: crypto.randomUUID(), name: "Jordan Lee", capid: "445001", section: "Command Staff", position: "Incident Commander", assignment: "Command", status: "Assigned", notes: "Placeholder" },
    { id: crypto.randomUUID(), name: "Alex Rivera", capid: "445002", section: "Command Staff", position: "Safety Officer", assignment: "Command", status: "Assigned", notes: "Placeholder" },
    { id: crypto.randomUUID(), name: "Taylor Brooks", capid: "445003", section: "Operations Section", position: "Operations Section Chief", assignment: "Ops", status: "Assigned", notes: "Placeholder" },
    { id: crypto.randomUUID(), name: "Morgan Patel", capid: "445004", section: "Air Operations", position: "Air Operations Branch Director", assignment: "Air Branch", status: "Assigned", notes: "Placeholder" },
    { id: crypto.randomUUID(), name: "Casey Nguyen", capid: "445005", section: "Ground Operations", position: "Ground Branch Director", assignment: "Ground Branch", status: "Assigned", notes: "Placeholder" },
    { id: crypto.randomUUID(), name: "Riley Kim", capid: "445006", section: "Planning Section", position: "Planning Section Chief", assignment: "Planning", status: "Assigned", notes: "Placeholder" },
    { id: crypto.randomUUID(), name: "Avery Chen", capid: "445007", section: "Logistics Section", position: "Communications Unit", assignment: "Comms", status: "Assigned", notes: "Placeholder" }
  ];

  const demoIncident = {
    incidentName: "Training Exercise - Example Data",
    missionNumber: "26-T-1001",
    operationalPeriod: "May 12, 2026 0800-1800",
    preparedBy: "Ops Watch Demo",
    preparedAt: new Date().toLocaleString()
  };

  writeJson(CREW_STAFFING_STORAGE_KEY, demoPeople);
  writeJson(CREW_STAFFING_INCIDENT_STORAGE_KEY, demoIncident);

  assignmentPeople = demoPeople.map(person => ({ id: String(person.id), name: String(person.name), capid: String(person.capid) }));
  assignmentSlots = {};
  const byPosition = new Map(assignmentPeople.map(person => [person.name, person.id]));
  assignmentSlots["Incident Commander"] = byPosition.get("Jordan Lee") || "";
  assignmentSlots["Safety Officer"] = byPosition.get("Alex Rivera") || "";
  assignmentSlots["Operations Section Chief"] = byPosition.get("Taylor Brooks") || "";
  assignmentSlots["Air Operations Branch Director"] = byPosition.get("Morgan Patel") || "";
  assignmentSlots["Ground Branch Director"] = byPosition.get("Casey Nguyen") || "";
  assignmentSlots["Planning Section Chief"] = byPosition.get("Riley Kim") || "";
  assignmentSlots["Communications Unit Leader"] = byPosition.get("Avery Chen") || "";

  saveResources();
  saveAssignmentBoard();
  render();
  renderAssignmentBoard();

  sendCrewStaffingMessage({ type: "crewstaffing:import", text: JSON.stringify({ incident: demoIncident, people: demoPeople }) });

  alert("Placeholder demo content has been added for review. Replace or clear this data before operational use.");
}

function clearResourcesAndPeople() {
  const confirmed = window.confirm("Clear all resources and people? This removes Ops Watch resources, signed-in personnel, and assignment slots.");
  if (!confirmed) return;

  resources = [];
  saveResources();

  assignmentPeople = [];
  assignmentSlots = {};
  writeJson(CREW_STAFFING_STORAGE_KEY, assignmentPeople);
  saveAssignmentBoard();

  sendCrewStaffingMessage({ type: "crewstaffing:clear" });
  render();
  renderAssignmentBoard();
  renderCommandPanel();
  alert("All resources and people have been cleared.");
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
    id: editingResourceId || crypto.randomUUID(),
    type,
    name: els.name.value.trim(),
    label: els.label.value.trim() || els.name.value.trim(),
    status: els.status.value,
    lat: Number(els.lat.value),
    lng: Number(els.lng.value),
    notes: els.notes.value.trim(),
    crew: els.crew.value.trim(),
    tail: type === "Air" ? normalizeTail(els.tail.value) : "",
    vehicleNumber: type === "Vehicle" ? els.vehicleNumber.value.trim() : "",
    updatedAt: new Date().toISOString()
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

  const wasEditing = Boolean(editingResourceId);
  if (wasEditing) {
    const index = resources.findIndex(item => item.id === editingResourceId);
    if (index !== -1) resources[index] = resource;
    else resources.push(resource);
  } else {
    resources.push(resource);
  }

  logActivity(wasEditing ? "EDIT" : "ADD", resource, `${resource.type} · ${resource.status}`);
  saveResources();
  exitEditMode();
  render();
}

function startEditResource(id) {
  const resource = resources.find(item => item.id === id);
  if (!resource) return;

  editingResourceId = id;
  els.type.value = resource.type;
  toggleResourceFields();
  els.name.value = resource.name || "";
  els.crew.value = resource.crew || "";
  els.label.value = resource.label || "";
  els.lat.value = resource.lat ?? "";
  els.lng.value = resource.lng ?? "";
  els.tail.value = resource.tail || "";
  els.vehicleNumber.value = resource.vehicleNumber || "";
  els.status.value = resource.status || "Available";
  els.notes.value = resource.notes || "";

  els.resourceSubmitBtn.textContent = "Update Resource";
  els.resourceCancelEditBtn.classList.remove("hidden");
  setActiveTool("opswatch");
  els.name.focus();
  els.form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function exitEditMode() {
  editingResourceId = null;
  els.form.reset();
  els.type.value = "Ground";
  toggleResourceFields();
  els.resourceSubmitBtn.textContent = "Add Resource";
  els.resourceCancelEditBtn.classList.add("hidden");
}

function render() {
  const visible = getVisibleResources();
  renderList(visible);
  renderMap(visible);
  els.count.textContent = `${visible.length} visible of ${resources.length} total`;
  renderCommandPanel();
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
    if (isResourceStale(resource, Date.now(), STALE_THRESHOLD_MS)) {
      const mins = minutesSince(resource.updatedAt, Date.now());
      badges.appendChild(makeBadge(`Check-in overdue${mins != null ? ` · ${mins} min` : ""}`, "stale"));
    }

    card.querySelector("h3").textContent = resource.name;
    card.querySelector(".resource-notes").textContent = resource.notes || "No notes entered.";

    const meta = card.querySelector(".resource-meta");
    const crewText = resource.crew || "No crew listed";
    const updatedText = resource.updatedAt ? ` · Updated ${formatRelativeTime(resource.updatedAt)}` : "";
    if (resource.type === "Air") {
      meta.textContent = `Crew: ${crewText} · Tail / Registration: ${resource.tail}${updatedText}`;
    } else if (resource.type === "Vehicle") {
      meta.textContent = `Crew: ${crewText} · Vehicle Number: ${resource.vehicleNumber || "Not provided"} · ${resource.lat}, ${resource.lng}${updatedText}`;
    } else {
      meta.textContent = `Crew: ${crewText} · ${resource.label} · ${resource.lat}, ${resource.lng}${updatedText}`;
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

    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => startEditResource(resource.id));
    actions.appendChild(edit);

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
  renderBreadcrumb();
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
      resource.updatedAt = new Date().toISOString();
      lastBoundsKey = null;
      logActivity("MOVE", resource, `${resource.lat}, ${resource.lng}`);
      saveResources();
      renderList(getVisibleResources());
    });
    bounds.push([Number(resource.lat), Number(resource.lng)]);
  });

  // Only re-fit the view when the plotted coordinates actually change, so
  // status edits, searches, and other re-renders don't yank the map around.
  const boundsKey = bounds.map(point => point.join(",")).sort().join("|");
  if (boundsKey !== lastBoundsKey) {
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });
    lastBoundsKey = boundsKey;
  }
}

function createColorMarker(type) {
  const spec = resourceIconSpec(type, TYPE_COLORS);
  return L.divIcon({
    className: "resource-pin-wrapper",
    html: spec.html,
    iconSize: spec.iconSize,
    iconAnchor: spec.iconAnchor,
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

  const previous = resource.status;
  resource.status = status;
  resource.updatedAt = new Date().toISOString();
  logActivity("STATUS", resource, `${previous} → ${status}`);
  saveResources();
  render();
}

function removeResource(id) {
  const resource = resources.find(item => item.id === id);
  resources = resources.filter(item => item.id !== id);
  if (resource) logActivity("REMOVE", resource, resource.type);
  if (editingResourceId === id) exitEditMode();
  saveResources();
  render();
}

function formatRelativeTime(isoString) {
  const then = new Date(isoString).getTime();
  if (!Number.isFinite(then)) return "";
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(then).toLocaleDateString();
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

      resources = imported.map(resource => normalizeResource({
        id: resource.id || crypto.randomUUID(),
        type: resource.type || "Ground",
        name: resource.name || "Unnamed Resource",
        label: resource.label || resource.name || "Resource",
        status: resource.status || "Available",
        lat: resource.lat ?? "",
        lng: resource.lng ?? "",
        notes: resource.notes || "",
        crew: resource.crew || "",
        tail: resource.tail || "",
        vehicleNumber: resource.vehicleNumber || ""
      }));

      saveResources();
      render();
    } catch {
      alert("Could not import this file. Please upload a valid Resource Tracker JSON export.");
    } finally {
      event.target.value = "";
    }
  };

  reader.readAsText(file);
}

function copySummary() {
  const summary = resources.map(resource => {
    const crew = resource.crew || "No crew";
    const notes = resource.notes || "No notes";
    if (resource.type === "Air") {
      return `${resource.type}: ${resource.name} (${resource.tail}) - Crew: ${crew} - ${resource.status} - ${notes}`;
    }
    if (resource.type === "Vehicle") {
      return `${resource.type}: ${resource.name} [${resource.vehicleNumber || "No unit #"}] - Crew: ${crew} - ${resource.status} - ${resource.lat}, ${resource.lng} - ${notes}`;
    }

    return `${resource.type}: ${resource.name} [${resource.label}] - Crew: ${crew} - ${resource.status} - ${resource.lat}, ${resource.lng} - ${notes}`;
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

// Small localStorage helpers so every reader/writer shares one JSON-safe path
// instead of repeating try/parse/catch and JSON.stringify all over the file.
function readJson(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved == null ? fallback : JSON.parse(saved);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    // Most commonly a full-storage quota error: surface it once instead of
    // letting saves fail silently and lose data during an incident.
    const quota = error && (error.name === "QuotaExceededError" || error.code === 22 || error.code === 1014);
    if (quota) warnStorageFull();
    else notify("Could not save to browser storage. Export your data to avoid losing it.", "error");
    return false;
  }
}

function warnStorageFull() {
  if (storageWarned) return;
  storageWarned = true;
  notify("Browser storage is full. Export your data (JSON) now to avoid losing changes, then clear old or unused data.", "error", 12000);
}

// Lightweight, non-blocking toast. Used for storage/tracking/live notices where
// a modal alert() would interrupt operational work.
function notify(message, type = "info", timeout = 6000) {
  let host = document.getElementById("toastHost");
  if (!host) {
    host = document.createElement("div");
    host.id = "toastHost";
    host.className = "toast-host";
    document.body.appendChild(host);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  host.appendChild(toast);
  window.setTimeout(() => toast.remove(), timeout);
}

function loadResources() {
  const saved = readJson(STORAGE_KEY, null);
  return Array.isArray(saved) ? saved : defaultResources;
}

function saveResources() {
  writeJson(STORAGE_KEY, resources);
  postDashboardUpdate();
  publishLiveState();
}

function loadRadii() {
  const saved = readJson(RADII_STORAGE_KEY, []);
  return Array.isArray(saved) ? saved : [];
}

function saveRadii() {
  writeJson(RADII_STORAGE_KEY, radii);
  postDashboardUpdate();
  publishLiveState();
}

function getDashboardPayload() {
  return {
    resources: resources.map(normalizeResource),
    radii: Array.isArray(radii) ? radii : [],
    command: buildCommandSnapshot(),
    generatedAt: new Date().toISOString()
  };
}

function postDashboardUpdate() {
  if (!dashboardWindow || dashboardWindow.closed) return;
  dashboardWindow.postMessage({ type: "opswatch:dashboard:update", payload: getDashboardPayload() }, window.location.origin);
}

function openDashboardWindow() {
  if (dashboardWindow && !dashboardWindow.closed) {
    dashboardWindow.focus();
    postDashboardUpdate();
    return;
  }

  dashboardWindow = window.open("", "opswatch-dashboard", "width=1400,height=850");
  if (!dashboardWindow) return;

  dashboardWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ops Watch Dashboard</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    body{margin:0;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;background:#f6f7fb;color:#111827}
    .layout{display:grid;grid-template-columns:320px 1fr 320px;height:100vh;gap:12px;padding:12px}
    .panel{background:#fff;border:1px solid #dfe4ec;border-radius:14px;padding:14px;overflow:auto}
    #dashboardMap{height:calc(100vh - 360px);min-height:360px;border-radius:12px}
    #operationalObjectives{margin-top:12px}
    .objective-item{border:1px solid #e5e7eb;border-radius:10px;padding:10px;margin-bottom:8px}
    h2{margin:0 0 8px;font-size:1.05rem}.muted{color:#6b7280;font-size:.9rem}
    .resource{border:1px solid #e5e7eb;border-radius:10px;padding:10px;margin-bottom:8px}
    .badge{display:inline-block;background:#111827;color:#fff;border-radius:999px;padding:2px 8px;font-size:.75rem}
    .status-green{background:#15803d}
    .status-yellow{background:#ca8a04;color:#111827}
    .status-red{background:#b91c1c}
    .status-black{background:#111827}
    .status{font-weight:700}
    .banner{position:fixed;top:0;left:0;right:0;z-index:20;background:#991b1b;color:#fff;padding:8px 0;overflow:hidden}
    .banner.hidden{display:none}
    .banner div{white-space:nowrap;display:inline-block;padding-left:100%;animation:scroll 20s linear infinite;font-weight:800}
    @keyframes scroll{0%{transform:translateX(0)}100%{transform:translateX(-130%)}}
  </style>
</head>
<body>
  <div id="commandBanner" class="banner hidden"><div id="commandBannerText"></div></div>
  <div class="layout">
    <section class="panel"><h2>Signed-In Resources</h2><p class="muted" id="resourceCount">0 resources</p><div id="resourceList"></div></section>
    <section class="panel"><h2>Ops Watch Map</h2><div id="dashboardMap"></div><section id="operationalObjectives"><h2>Operational Objectives</h2><div id="objectiveList"></div></section></section>
    <section class="panel"><h2>Command Snapshot</h2><p class="muted" id="commandCounts"></p><div id="commandAssignments"></div></section>
  </div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const TYPE_COLORS = ${JSON.stringify(TYPE_COLORS)};
    const COMMAND_STATUS_CLASS = { Green: "status-green", Yellow: "status-yellow", Red: "status-red", Black: "status-black" };
    const esc = value => String(value == null ? "" : value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
    const resourceIconSpec = ${resourceIconSpec.toString()};
    const map = L.map("dashboardMap").setView([29.7604, -95.3698], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
    const markersLayer = L.layerGroup().addTo(map);
    const radiiLayer = L.layerGroup().addTo(map);
    let latestPayload = { resources: [], radii: [] };

    function render(payload) {
      latestPayload = payload || latestPayload;
      const resources = Array.isArray(latestPayload.resources) ? latestPayload.resources : [];
      const radii = Array.isArray(latestPayload.radii) ? latestPayload.radii : [];
      const command = latestPayload.command || { assignments: [], counts: {}, banner: { text: "", enabled: false } };
      const list = document.getElementById("resourceList");
      const count = document.getElementById("resourceCount");
      const commandCounts = document.getElementById("commandCounts");
      const commandAssignments = document.getElementById("commandAssignments");
      const objectiveList = document.getElementById("objectiveList");
      const banner = document.getElementById("commandBanner");
      const bannerText = document.getElementById("commandBannerText");
      list.innerHTML = "";
      commandAssignments.innerHTML = "";
      objectiveList.innerHTML = "";
      count.textContent = resources.length + " resources";
      commandCounts.textContent = "People: " + (command.counts.people || 0) + " · Vehicles: " + (command.counts.vehicles || 0) + " · Aircraft: " + (command.counts.aircraft || 0);
      const showBanner = Boolean(command.banner && command.banner.enabled && command.banner.text);
      const objectives = command.objectives || {};
      [["Primary", objectives.primary], ["Secondary", objectives.secondary], ["Tertiary", objectives.tertiary]].forEach(([label, value]) => {
        if (!value) return;
        const block = document.createElement("article");
        block.className = "objective-item";
        block.innerHTML = "<strong>" + esc(label) + "</strong><div class='muted'>" + esc(value) + "</div>";
        objectiveList.appendChild(block);
      });
      if (!objectiveList.children.length) {
        objectiveList.innerHTML = "<p class='muted'>No operational objectives entered.</p>";
      }
      banner.classList.toggle("hidden", !showBanner);
      bannerText.textContent = showBanner ? command.banner.text : "";

      resources.forEach(resource => {
        const card = document.createElement("article");
        card.className = "resource";
        card.innerHTML = "<div><span class='badge'>" + esc(resource.type || "Unknown") + "</span> <span class='status'>" + esc(resource.status || "Unknown") + "</span></div><strong>" + esc(resource.name || "Unnamed Resource") + "</strong><div class='muted'>" + esc(resource.label || "") + "</div>";
        list.appendChild(card);
      });
      (command.assignments || []).forEach(item => {
        const card = document.createElement("article");
        card.className = "resource";
        const statusLabel = item.status || "Green";
        const statusClass = COMMAND_STATUS_CLASS[statusLabel] || "status-green";
        card.innerHTML = "<div><span class='badge " + statusClass + "'>" + esc(statusLabel) + "</span></div><strong>" + esc(item.name || "Unassigned") + "</strong><div class='muted'>" + esc(item.position || "") + "</div>";
        commandAssignments.appendChild(card);
      });

      markersLayer.clearLayers();
      radiiLayer.clearLayers();
      const bounds = [];

      const createResourceMarkerIcon = type => {
        const spec = resourceIconSpec(type, TYPE_COLORS);
        return L.divIcon({ className: "", html: spec.html, iconSize: spec.iconSize, iconAnchor: spec.iconAnchor });
      };

      resources.forEach(resource => {
        const lat = Number(resource.lat);
        const lng = Number(resource.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        const marker = L.marker([lat, lng], { icon: createResourceMarkerIcon(resource.type) });
        marker.bindPopup("<strong>" + esc(resource.name || "Resource") + "</strong><br>" + esc(resource.status || ""));
        marker.addTo(markersLayer);
        bounds.push([lat, lng]);
      });

      radii.forEach(item => {
        if (!item || !item.center) return;
        L.circle([Number(item.center.lat), Number(item.center.lng)], { radius: Number(item.radiusMeters || 0), color: TYPE_COLORS[item.type] || TYPE_COLORS.Ground || "#2563eb", weight: 2, fillOpacity: 0.08 }).addTo(radiiLayer);
      });

      if (bounds.length) map.fitBounds(bounds, { padding:[20,20], maxZoom:14 });
      setTimeout(() => map.invalidateSize(), 60);
    }

    window.addEventListener("message", event => {
      if (event.origin !== window.location.origin) return;
      if (event.data && event.data.type === "opswatch:dashboard:update") render(event.data.payload);
    });
  </script>
</body>
</html>`);
  dashboardWindow.document.close();
  setTimeout(postDashboardUpdate, 150);
}

const CREW_STAFFING_STORAGE_KEY = "romans-assignment-roster-v1";
const CREW_STAFFING_INCIDENT_STORAGE_KEY = "romans-assignment-roster-incident-v1";
const ASSIGNMENT_BOARD_STORAGE_KEY = "romans-assignment-board-v1";
const FIELD_NOTES_STORAGE_KEY = "romans-field-notes-v1";
const FIELD_NOTES_AUTHOR_STORAGE_KEY = "romans-field-notes-author-v1";
const COMMAND_STORAGE_KEY = "romans-command-status-v1";
const IMT_POSITIONS = [
  "Incident Commander",
  "Deputy Incident Commander",
  "Safety Officer",
  "Public Information Officer",
  "Liaison Officer",
  "Operations Section Chief",
  "Planning Section Chief",
  "Logistics Section Chief",
  "Finance/Admin Section Chief",
  "Air Operations Branch Director",
  "Ground Branch Director",
  "Communications Unit Leader",
  "Medical Unit Leader",
  "Situation Unit Leader",
  "Resource Unit Leader"
];

let assignmentPeople = [];
let assignmentSlots = loadAssignmentBoard();
let fieldNotes = loadFieldNotes();
let commandStatuses = loadCommandStatuses();
let commandBanner = loadCommandBanner();
let commandObjectives = loadCommandObjectives();

Object.assign(els, {
  assignmentBoardPanel: document.getElementById("assignmentBoardApp"),
  assignmentRoster: document.getElementById("assignmentRoster"),
  assignmentGrid: document.getElementById("assignmentGrid"),
  assignmentReloadBtn: document.getElementById("assignmentReloadBtn"),
  assignmentImportInput: document.getElementById("assignmentImportInput"),
  assignmentClearBtn: document.getElementById("assignmentClearBtn"),
  commandPanel: document.getElementById("commandApp"),
  commandPeopleCount: document.getElementById("commandPeopleCount"),
  commandVehicleCount: document.getElementById("commandVehicleCount"),
  commandAircraftCount: document.getElementById("commandAircraftCount"),
  commandStatusList: document.getElementById("commandStatusList"),
  commandBannerText: document.getElementById("commandBannerText"),
  commandBannerEnabled: document.getElementById("commandBannerEnabled"),
  commandObjectivePrimary: document.getElementById("commandObjectivePrimary"),
  commandObjectiveSecondary: document.getElementById("commandObjectiveSecondary"),
  commandObjectiveTertiary: document.getElementById("commandObjectiveTertiary"),
  commandStaleCount: document.getElementById("commandStaleCount"),
  activityPanel: document.getElementById("activityApp"),
  activityList: document.getElementById("activityList"),
  activityCount: document.getElementById("activityCount"),
  activityExportBtn: document.getElementById("activityExportBtn"),
  activityIcs214Btn: document.getElementById("activityIcs214Btn"),
  activityClearBtn: document.getElementById("activityClearBtn"),
  ics201Btn: document.getElementById("ics201Btn"),
  ics203Btn: document.getElementById("ics203Btn"),
  ics214Btn: document.getElementById("ics214Btn")
});



function bindAssignmentBoardControls() {
  els.assignmentReloadBtn?.addEventListener("click", () => {
    loadAssignmentPeople();
    renderAssignmentBoard();
  });
  els.assignmentImportInput?.addEventListener("change", importAssignmentPrefill);
  els.assignmentClearBtn?.addEventListener("click", () => {
    assignmentSlots = {};
    saveAssignmentBoard();
    renderAssignmentBoard();
  });
}


function importAssignmentPrefill(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(String(reader.result || "{}"));
      const importedPeople = Array.isArray(payload.assignmentPeople) ? payload.assignmentPeople : [];
      assignmentPeople = importedPeople.map(person => ({
        id: String(person.id || crypto.randomUUID()),
        name: String(person.name || "Unnamed Person"),
        capid: String(person.capid || "Unknown")
      }));

      const nextSlots = payload.assignmentSlots && typeof payload.assignmentSlots === "object" ? payload.assignmentSlots : {};
      assignmentSlots = {};
      Object.entries(nextSlots).forEach(([position, personId]) => {
        if (!IMT_POSITIONS.includes(position)) return;
        const normalizedId = String(personId || "");
        if (assignmentPeople.some(person => person.id === normalizedId)) {
          assignmentSlots[position] = normalizedId;
        }
      });

      writeJson(CREW_STAFFING_STORAGE_KEY, assignmentPeople);
      saveAssignmentBoard();
      renderAssignmentBoard();
    } catch {
      alert("Could not read assignment prefill JSON. Please upload a valid file.");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function loadAssignmentPeople() {
  const payload = readJson(CREW_STAFFING_STORAGE_KEY, []);
  assignmentPeople = Array.isArray(payload)
    ? payload.map(person => ({
        id: String(person.id || crypto.randomUUID()),
        name: String(person.name || "Unnamed Person"),
        capid: String(person.capid || "Unknown")
      }))
    : [];
}

function loadCrewStaffingIncident() {
  const payload = readJson(CREW_STAFFING_INCIDENT_STORAGE_KEY, {});
  return payload && typeof payload === "object" ? payload : {};
}

function renderAssignmentBoard() {
  if (!els.assignmentRoster || !els.assignmentGrid) return;
  els.assignmentRoster.innerHTML = "";
  els.assignmentGrid.innerHTML = "";

  assignmentPeople.forEach(person => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "assignment-person";
    item.draggable = true;
    item.dataset.personId = person.id;
    item.innerHTML = `<strong>${escapeHtml(person.name)}</strong><span>CAPID: ${escapeHtml(person.capid)}</span>`;
    item.addEventListener("dragstart", event => {
      event.dataTransfer?.setData("text/person-id", person.id);
    });
    els.assignmentRoster.appendChild(item);
  });

  IMT_POSITIONS.forEach(position => {
    const slot = document.createElement("div");
    slot.className = "assignment-slot";
    slot.dataset.position = position;

    const assignedId = assignmentSlots[position] || "";
    const match = assignmentPeople.find(person => person.id === assignedId);

    slot.innerHTML = `<p class="assignment-slot-title">${escapeHtml(position)}</p><div class="assignment-slot-fill">${match ? `<strong>${escapeHtml(match.name)}</strong><span>CAPID: ${escapeHtml(match.capid)}</span>` : "Drop person here"}</div><button type="button" class="button secondary assignment-remove">Clear</button>`;

    slot.addEventListener("dragover", event => {
      event.preventDefault();
      slot.classList.add("drag-over");
    });
    slot.addEventListener("dragleave", () => slot.classList.remove("drag-over"));
    slot.addEventListener("drop", event => {
      event.preventDefault();
      slot.classList.remove("drag-over");
      const personId = event.dataTransfer?.getData("text/person-id");
      if (!personId) return;
      assignmentSlots[position] = personId;
      saveAssignmentBoard();
      renderAssignmentBoard();
    });

    slot.querySelector(".assignment-remove")?.addEventListener("click", () => {
      delete assignmentSlots[position];
      saveAssignmentBoard();
      renderAssignmentBoard();
    });

    els.assignmentGrid.appendChild(slot);
  });

  renderCommandPanel();
  postDashboardUpdate();
}

function loadAssignmentBoard() {
  const saved = readJson(ASSIGNMENT_BOARD_STORAGE_KEY, {});
  return saved && typeof saved === "object" ? saved : {};
}

function saveAssignmentBoard() {
  writeJson(ASSIGNMENT_BOARD_STORAGE_KEY, assignmentSlots);
  postDashboardUpdate();
  publishLiveState();
}

function bindCommandControls() {
  if (els.commandBannerText) els.commandBannerText.value = commandBanner.text || "";
  if (els.commandBannerEnabled) els.commandBannerEnabled.checked = Boolean(commandBanner.enabled);
  if (els.commandObjectivePrimary) els.commandObjectivePrimary.value = commandObjectives.primary || "";
  if (els.commandObjectiveSecondary) els.commandObjectiveSecondary.value = commandObjectives.secondary || "";
  if (els.commandObjectiveTertiary) els.commandObjectiveTertiary.value = commandObjectives.tertiary || "";
  els.commandBannerText?.addEventListener("input", () => {
    commandBanner.text = els.commandBannerText.value.trim();
    saveCommandBanner();
    postDashboardUpdate();
  });
  els.commandBannerEnabled?.addEventListener("change", () => {
    commandBanner.enabled = Boolean(els.commandBannerEnabled.checked);
    saveCommandBanner();
    postDashboardUpdate();
  });

  ["commandObjectivePrimary", "commandObjectiveSecondary", "commandObjectiveTertiary"].forEach((key, index) => {
    const objectiveKey = ["primary", "secondary", "tertiary"][index];
    els[key]?.addEventListener("input", () => {
      commandObjectives[objectiveKey] = els[key].value.trim();
      saveCommandObjectives();
      postDashboardUpdate();
    });
  });
}

function renderCommandPanel() {
  if (!els.commandStatusList) return;
  els.commandPeopleCount.textContent = String(assignmentPeople.length);
  els.commandVehicleCount.textContent = String(resources.filter(resource => resource.type === "Vehicle").length);
  els.commandAircraftCount.textContent = String(resources.filter(resource => resource.type === "Air").length);
  if (els.commandStaleCount) {
    const now = Date.now();
    els.commandStaleCount.textContent = String(resources.filter(resource => isResourceStale(resource, now, STALE_THRESHOLD_MS)).length);
  }
  els.commandStatusList.innerHTML = "";
  IMT_POSITIONS.forEach(position => {
    const personId = assignmentSlots[position] || "";
    const person = assignmentPeople.find(item => item.id === personId);
    if (!person) return;
    const row = document.createElement("article");
    row.className = "command-status-row";
    const status = commandStatuses[position] || "Green";
    row.innerHTML = `<div><strong>${escapeHtml(person.name)}</strong><p>${escapeHtml(position)}</p></div>`;
    const select = document.createElement("select");
    ["Green", "Yellow", "Red", "Black"].forEach(optionValue => {
      const option = document.createElement("option");
      option.value = optionValue;
      option.textContent = optionValue;
      option.selected = optionValue === status;
      select.appendChild(option);
    });
    select.value = status;
    select.addEventListener("change", event => {
      commandStatuses[position] = event.target.value;
      saveCommandStatuses();
      postDashboardUpdate();
    });
    row.appendChild(select);
    els.commandStatusList.appendChild(row);
  });
}

function buildCommandSnapshot() {
  const assignments = IMT_POSITIONS.map(position => {
    const person = assignmentPeople.find(item => item.id === (assignmentSlots[position] || ""));
    if (!person) return null;
    return { position, name: person.name, capid: person.capid, status: commandStatuses[position] || "Green" };
  }).filter(Boolean);
  return {
    assignments,
    counts: {
      people: assignmentPeople.length,
      vehicles: resources.filter(resource => resource.type === "Vehicle").length,
      aircraft: resources.filter(resource => resource.type === "Air").length
    },
    banner: { text: commandBanner.text || "", enabled: Boolean(commandBanner.enabled) },
    objectives: {
      primary: commandObjectives.primary || "",
      secondary: commandObjectives.secondary || "",
      tertiary: commandObjectives.tertiary || ""
    }
  };
}

function loadCommandStatuses() {
  return readJson(COMMAND_STORAGE_KEY, {});
}
function saveCommandStatuses() { writeJson(COMMAND_STORAGE_KEY, commandStatuses); publishLiveState(); }
function loadCommandBanner() {
  return readJson(`${COMMAND_STORAGE_KEY}-banner`, { text: "", enabled: false });
}
function saveCommandBanner() { writeJson(`${COMMAND_STORAGE_KEY}-banner`, commandBanner); publishLiveState(); }
function loadCommandObjectives() {
  return readJson(`${COMMAND_STORAGE_KEY}-objectives`, { primary: "", secondary: "", tertiary: "" });
}
function saveCommandObjectives() { writeJson(`${COMMAND_STORAGE_KEY}-objectives`, commandObjectives); publishLiveState(); }


function bindFieldNotesControls() {
  const author = loadFieldNoteAuthor();
  if (author.name) els.fieldNoteName.value = author.name;
  if (author.role) els.fieldNoteRole.value = author.role;

  els.fieldNoteName?.addEventListener("input", saveFieldNoteAuthor);
  els.fieldNoteRole?.addEventListener("input", saveFieldNoteAuthor);
  els.fieldNoteForm?.addEventListener("submit", addFieldNote);
  els.fieldNotesPrintBtn?.addEventListener("click", printFieldNotes);
  els.fieldNotesExportBtn?.addEventListener("click", exportFieldNotes);
  els.fieldNotesImportInput?.addEventListener("change", importFieldNotes);
}

function exportFieldNotes() {
  const payload = { exportedAt: new Date().toISOString(), fieldNotes };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `field-notes-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function normalizeFieldNote(note) {
  const source = note && typeof note === "object" ? note : {};
  return {
    id: String(source.id || crypto.randomUUID()),
    name: String(source.name || "Unknown"),
    role: String(source.role || "Unknown"),
    text: String(source.text || "").trim(),
    createdAt: source.createdAt || new Date().toISOString()
  };
}

function importFieldNotes(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || "{}"));
      const incoming = Array.isArray(parsed) ? parsed : parsed.fieldNotes;
      if (!Array.isArray(incoming)) throw new Error("Missing fieldNotes array.");

      const normalized = incoming.map(normalizeFieldNote).filter(note => note.text);
      const merge = fieldNotes.length
        ? window.confirm("Merge imported notes with existing notes? Choose Cancel to replace all current notes.")
        : false;

      if (merge) {
        const existingIds = new Set(fieldNotes.map(note => note.id));
        const additions = normalized.filter(note => !existingIds.has(note.id));
        fieldNotes = [...additions, ...fieldNotes];
      } else {
        fieldNotes = normalized;
      }

      fieldNotes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      saveFieldNotes();
      renderFieldNotes();
    } catch {
      alert("Could not import this file. Exported Field Notes JSON is expected.");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function addFieldNote(event) {
  event.preventDefault();
  const name = els.fieldNoteName.value.trim();
  const role = els.fieldNoteRole.value.trim();
  const text = els.fieldNoteText.value.trim();
  if (!name || !role || !text) return;

  fieldNotes.unshift({
    id: crypto.randomUUID(),
    name,
    role,
    text,
    createdAt: new Date().toISOString()
  });

  saveFieldNotes();
  saveFieldNoteAuthor();
  els.fieldNoteText.value = "";
  renderFieldNotes();
}

function renderFieldNotes() {
  if (!els.fieldNotesList || !els.fieldNotesCount) return;
  els.fieldNotesList.innerHTML = "";

  if (!fieldNotes.length) {
    els.fieldNotesList.innerHTML = '<p class="empty-state">No field notes recorded yet.</p>';
  }

  fieldNotes.forEach(note => {
    const card = document.createElement("article");
    card.className = "resource-card";
    const timeLabel = new Date(note.createdAt).toLocaleString();
    card.innerHTML = `<div class="resource-card-main"><div class="badges"><span class="badge">${escapeHtml(note.role)}</span></div><h3>${escapeHtml(note.name)}</h3><p class="resource-notes">${escapeHtml(note.text)}</p><p class="resource-meta">Recorded: ${escapeHtml(timeLabel)}</p></div><div class="resource-actions"><button type="button" class="note-delete-btn" aria-label="Delete field note">✕</button></div>`;
    card.querySelector(".note-delete-btn")?.addEventListener("click", () => deleteFieldNote(note.id));
    els.fieldNotesList.appendChild(card);
  });

  els.fieldNotesCount.textContent = `${fieldNotes.length} ${fieldNotes.length === 1 ? "note" : "notes"} recorded`;
}


function deleteFieldNote(noteId) {
  fieldNotes = fieldNotes.filter(note => note.id !== noteId);
  saveFieldNotes();
  renderFieldNotes();
}

function printFieldNotes() {
  const notesMarkup = fieldNotes.length
    ? fieldNotes
        .map(note => {
          const timeLabel = new Date(note.createdAt).toLocaleString();
          return `<article class="note-print-card"><h3>${escapeHtml(note.name)}</h3><p class="note-print-role">Role: ${escapeHtml(note.role)}</p><p>${escapeHtml(note.text)}</p><p class="note-print-time">Recorded: ${escapeHtml(timeLabel)}</p></article>`;
        })
        .join("")
    : '<p>No field notes recorded yet.</p>';

  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!printWindow) return;

  printWindow.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><title>Field Notes Report</title><style>body{font-family:Inter,Arial,sans-serif;margin:24px;color:#111827}h1{margin-bottom:8px}p{line-height:1.5}.note-print-card{border:1px solid #d1d5db;border-radius:12px;padding:12px 14px;margin-bottom:12px}.note-print-role,.note-print-time{color:#374151;font-size:0.95rem;margin:6px 0}@media print{body{margin:0.5in}}</style></head><body><h1>Field Notes Report</h1><p>Generated: ${escapeHtml(new Date().toLocaleString())}</p>${notesMarkup}</body></html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function loadFieldNotes() {
  const saved = readJson(FIELD_NOTES_STORAGE_KEY, []);
  return Array.isArray(saved) ? saved : [];
}

function saveFieldNotes() {
  writeJson(FIELD_NOTES_STORAGE_KEY, fieldNotes);
  publishLiveState();
}

function loadFieldNoteAuthor() {
  const saved = readJson(FIELD_NOTES_AUTHOR_STORAGE_KEY, {});
  if (!saved || typeof saved !== "object") return { name: "", role: "" };
  return {
    name: String(saved.name || ""),
    role: String(saved.role || "")
  };
}

function saveFieldNoteAuthor() {
  writeJson(FIELD_NOTES_AUTHOR_STORAGE_KEY, {
    name: els.fieldNoteName?.value.trim() || "",
    role: els.fieldNoteRole?.value.trim() || ""
  });
}

/* ---------------------------------------------------------------------------
 * Stale-resource monitor
 * Re-evaluates check-in staleness on a timer so badges, the relative "updated"
 * times, and the Command count stay current without an explicit user action.
 * ------------------------------------------------------------------------- */
function startStaleMonitor() {
  if (staleMonitorId) return;
  staleMonitorId = window.setInterval(() => {
    renderList(getVisibleResources());
    renderCommandPanel();
  }, 60000);
}

/* ---------------------------------------------------------------------------
 * Activity log (ICS-214 style)
 * ------------------------------------------------------------------------- */
function loadActivityLog() {
  const saved = readJson(ACTIVITY_LOG_STORAGE_KEY, []);
  return Array.isArray(saved) ? saved : [];
}

function saveActivityLog() {
  writeJson(ACTIVITY_LOG_STORAGE_KEY, activityLog);
  publishLiveState();
}

function logActivity(kind, resource, detail) {
  const source = resource && typeof resource === "object" ? resource : {};
  activityLog.unshift({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    kind,
    resourceId: source.id || "",
    resourceName: source.name || source.label || "Resource",
    type: source.type || "",
    detail: detail || ""
  });
  if (activityLog.length > ACTIVITY_LOG_LIMIT) activityLog.length = ACTIVITY_LOG_LIMIT;
  saveActivityLog();
  renderActivityLog();
}

function bindActivityControls() {
  els.activityExportBtn?.addEventListener("click", exportActivityLog);
  els.activityIcs214Btn?.addEventListener("click", () => printIcsForm("214"));
  els.activityClearBtn?.addEventListener("click", clearActivityLog);
}

function renderActivityLog() {
  if (!els.activityList || !els.activityCount) return;
  els.activityList.innerHTML = "";

  if (!activityLog.length) {
    els.activityList.innerHTML = '<p class="empty-state">No activity recorded yet. Add, move, or update a resource to start the log.</p>';
  }

  activityLog.forEach(entry => {
    const card = document.createElement("article");
    card.className = "activity-item";
    const time = entry.at ? new Date(entry.at).toLocaleString() : "";
    const detail = entry.detail ? `<span class="activity-detail">${escapeHtml(entry.detail)}</span>` : "";
    card.innerHTML = `<span class="badge activity-kind kind-${slug(entry.kind || "event")}">${escapeHtml(entry.kind || "EVENT")}</span><div class="activity-body"><strong>${escapeHtml(entry.resourceName || "Resource")}</strong>${detail}<span class="activity-time">${escapeHtml(time)}</span></div>`;
    els.activityList.appendChild(card);
  });

  els.activityCount.textContent = `${activityLog.length} event${activityLog.length === 1 ? "" : "s"} recorded`;
}

function exportActivityLog() {
  const payload = { exportedAt: new Date().toISOString(), activityLog };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `activity-log-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function clearActivityLog() {
  if (!activityLog.length) return;
  if (!window.confirm("Clear the entire activity log? Export it first if you need an ICS-214 record.")) return;
  activityLog = [];
  saveActivityLog();
  renderActivityLog();
}

/* ---------------------------------------------------------------------------
 * Printable ICS forms (201 / 203 / 214)
 * ------------------------------------------------------------------------- */
function bindIcsControls() {
  els.ics201Btn?.addEventListener("click", () => printIcsForm("201"));
  els.ics203Btn?.addEventListener("click", () => printIcsForm("203"));
  els.ics214Btn?.addEventListener("click", () => printIcsForm("214"));
}

function incidentHeaderHtml(formTitle) {
  const incident = loadCrewStaffingIncident();
  const rows = [
    ["Incident Name", incident.incidentName],
    ["Mission Number", incident.missionNumber],
    ["Operational Period", incident.operationalPeriod],
    ["Prepared By", incident.preparedBy]
  ]
    .map(([label, value]) => `<div><span class="ics-label">${escapeHtml(label)}</span><span class="ics-value">${escapeHtml(value || "—")}</span></div>`)
    .join("");
  return `<header class="ics-header"><h1>${escapeHtml(formTitle)}</h1><div class="ics-meta">${rows}</div><p class="ics-generated">Generated: ${escapeHtml(new Date().toLocaleString())}</p></header>`;
}

function printIcsForm(kind) {
  if (kind === "201") return openPrintWindow("ICS-201 Incident Briefing", buildIcs201Body());
  if (kind === "203") return openPrintWindow("ICS-203 Organization Assignment List", buildIcs203Body());
  if (kind === "214") return openPrintWindow("ICS-214 Activity Log", buildIcs214Body());
}

function buildIcs201Body() {
  const counts = resourceCounts(resources);
  const countLine = Object.keys(counts).length
    ? Object.entries(counts).map(([type, n]) => `${escapeHtml(type)}: ${n}`).join(" · ")
    : "No resources entered.";
  const objectives = [
    ["Primary", commandObjectives.primary],
    ["Secondary", commandObjectives.secondary],
    ["Tertiary", commandObjectives.tertiary]
  ].filter(([, value]) => value);
  const objectivesHtml = objectives.length
    ? `<ul>${objectives.map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`).join("")}</ul>`
    : "<p>No operational objectives entered.</p>";

  const rows = resources.length
    ? resources
        .map(resource => {
          const ident = resource.type === "Air" ? resource.tail : resource.type === "Vehicle" ? resource.vehicleNumber : resource.label;
          const location = Number.isFinite(Number(resource.lat)) ? `${resource.lat}, ${resource.lng}` : "—";
          return `<tr><td>${escapeHtml(resource.type)}</td><td>${escapeHtml(resource.name)}</td><td>${escapeHtml(ident || "—")}</td><td>${escapeHtml(resource.status)}</td><td>${escapeHtml(resource.crew || "—")}</td><td>${escapeHtml(location)}</td></tr>`;
        })
        .join("")
    : '<tr><td colspan="6">No resources entered.</td></tr>';

  return `${incidentHeaderHtml("ICS-201 Incident Briefing")}
    <section><h2>Current Objectives</h2>${objectivesHtml}</section>
    <section><h2>Resource Summary</h2><p>${countLine}</p>
      <table><thead><tr><th>Type</th><th>Name</th><th>ID</th><th>Status</th><th>Crew</th><th>Location</th></tr></thead><tbody>${rows}</tbody></table>
    </section>`;
}

function buildIcs203Body() {
  const rows = buildIcs203Rows(IMT_POSITIONS, assignmentSlots, assignmentPeople)
    .map(row => `<tr><td>${escapeHtml(row.position)}</td><td>${escapeHtml(row.name || "—")}</td><td>${escapeHtml(row.capid || "—")}</td></tr>`)
    .join("");
  return `${incidentHeaderHtml("ICS-203 Organization Assignment List")}
    <section><table><thead><tr><th>Position</th><th>Name</th><th>CAPID</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}

function buildIcs214Body() {
  const rows = activityLog.length
    ? activityLog
        .map(entry => {
          const time = entry.at ? new Date(entry.at).toLocaleString() : "—";
          const line = buildActivityLine({ ...entry, at: "" }).replace(/^ — /, "");
          return `<tr><td class="ics-time">${escapeHtml(time)}</td><td>${escapeHtml(line)}</td></tr>`;
        })
        .join("")
    : '<tr><td colspan="2">No activity recorded.</td></tr>';
  return `${incidentHeaderHtml("ICS-214 Activity Log")}
    <section><table><thead><tr><th>Date/Time</th><th>Notable Activities</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}

function openPrintWindow(title, bodyHtml) {
  const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=720");
  if (!win) {
    notify("Allow pop-ups for this site to print or export ICS forms.", "error");
    return;
  }
  win.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><title>${escapeHtml(title)}</title><style>
    body{font-family:Inter,Arial,sans-serif;margin:24px;color:#111827}
    h1{margin:0 0 4px;font-size:1.4rem}h2{font-size:1.1rem;margin:18px 0 8px}
    .ics-header{border-bottom:2px solid #111827;padding-bottom:10px;margin-bottom:8px}
    .ics-meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 24px;margin-top:8px}
    .ics-label{display:block;font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;font-weight:800}
    .ics-value{font-weight:700}
    .ics-generated{color:#6b7280;font-size:.85rem;margin:6px 0 0}
    table{width:100%;border-collapse:collapse;margin-top:6px;font-size:.92rem}
    th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left;vertical-align:top}
    th{background:#f1f5f9}
    .ics-time{white-space:nowrap}
    ul{margin:0;padding-left:18px}
    @media print{body{margin:.5in}}
  </style></head><body>${bodyHtml}</body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

/* ---------------------------------------------------------------------------
 * GPS breadcrumb / live self-tracking
 * ------------------------------------------------------------------------- */
function bindTrackingControls() {
  els.trackMeBtn?.addEventListener("click", toggleTracking);
  els.clearTrailBtn?.addEventListener("click", clearTrail);
}

function toggleTracking() {
  if (trackWatchId !== null) stopTracking();
  else startTracking();
}

function startTracking() {
  if (!navigator.geolocation) {
    notify("Geolocation is not available in this browser.", "error");
    return;
  }
  let centered = false;
  trackWatchId = navigator.geolocation.watchPosition(
    position => {
      const point = {
        lat: Number(position.coords.latitude.toFixed(6)),
        lng: Number(position.coords.longitude.toFixed(6)),
        at: new Date().toISOString()
      };
      userCoords = { lat: point.lat, lng: point.lng };
      const last = breadcrumb[breadcrumb.length - 1];
      // Skip near-duplicate fixes (< ~3 m) to keep the trail tidy.
      if (!last || haversineMeters(last, point) > 3) {
        breadcrumb.push(point);
        if (breadcrumb.length > BREADCRUMB_LIMIT) breadcrumb.shift();
        saveBreadcrumb();
      }
      renderBreadcrumb();
      if (!centered && map) {
        map.setView([point.lat, point.lng], Math.max(map.getZoom(), 14));
        centered = true;
      }
    },
    () => notify("Could not read your location. Check location permissions.", "error"),
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
  );
  if (els.trackMeBtn) {
    els.trackMeBtn.classList.add("active");
    els.trackMeBtn.textContent = "Tracking… (stop)";
  }
  notify("Live tracking on. Your position and trail update on the map.", "info");
}

function stopTracking() {
  if (trackWatchId !== null) {
    navigator.geolocation.clearWatch(trackWatchId);
    trackWatchId = null;
  }
  if (els.trackMeBtn) {
    els.trackMeBtn.classList.remove("active");
    els.trackMeBtn.textContent = "Track Me";
  }
}

function renderBreadcrumb() {
  if (!map) return;
  if (!breadcrumbLayer) breadcrumbLayer = L.layerGroup().addTo(map);
  breadcrumbLayer.clearLayers();
  if (!breadcrumb.length) return;

  const path = breadcrumb.map(point => [point.lat, point.lng]);
  if (path.length > 1) {
    L.polyline(path, { color: "#2563eb", weight: 3, opacity: 0.7, dashArray: "4 6" }).addTo(breadcrumbLayer);
  }
  const here = path[path.length - 1];
  L.circleMarker(here, { radius: 7, color: "#1d4ed8", fillColor: "#3b82f6", fillOpacity: 0.9, weight: 2 })
    .bindPopup(`<strong>You are here</strong><br>Trail: ${Math.round(trailDistanceMeters(breadcrumb))} m`)
    .addTo(breadcrumbLayer);

  if (els.clearTrailBtn) {
    els.clearTrailBtn.textContent = path.length > 1 ? `Clear Trail (${Math.round(trailDistanceMeters(breadcrumb))} m)` : "Clear Trail";
  }
}

function clearTrail() {
  breadcrumb = [];
  saveBreadcrumb();
  renderBreadcrumb();
  if (els.clearTrailBtn) els.clearTrailBtn.textContent = "Clear Trail";
}

function loadBreadcrumb() {
  const saved = readJson(BREADCRUMB_STORAGE_KEY, []);
  return Array.isArray(saved) ? saved : [];
}

function saveBreadcrumb() {
  writeJson(BREADCRUMB_STORAGE_KEY, breadcrumb);
}
