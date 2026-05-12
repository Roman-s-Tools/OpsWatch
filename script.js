const STORAGE_KEY = "romans-resource-tracker-v1";
const RADII_STORAGE_KEY = "romans-resource-radii-v1";
const WMIRS_DISCLAIMER_ACK_KEY = "romans-wmirs-disclaimer-ack-v1";
const RESOURCE_STATUSES = ["Available", "Assigned", "Enroute", "Onscene", "Offline"];

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
  showDisclaimerBtn: document.getElementById("showDisclaimerBtn"),
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
  fieldNotesCount: document.getElementById("fieldNotesCount")
};

document.addEventListener("DOMContentLoaded", () => {
  initWmirsDisclaimer();
  initMap();
  bindEvents();
  bindToolTabs();
  bindCrewStaffingControls();
  bindAssignmentBoardControls();
  bindFieldNotesControls();
  loadAssignmentPeople();
  render();
  renderAssignmentBoard();
  renderFieldNotes();
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
  els.opswatchPanel.classList.toggle("active", opswatchActive);
  els.crewStaffingPanel.classList.toggle("active", crewStaffingActive);
  els.assignmentBoardPanel.classList.toggle("active", assignmentBoardActive);
  els.fieldNotesPanel.classList.toggle("active", fieldNotesActive);
  els.opswatchPanel.hidden = !opswatchActive;
  els.crewStaffingPanel.hidden = !crewStaffingActive;
  els.assignmentBoardPanel.hidden = !assignmentBoardActive;
  els.fieldNotesPanel.hidden = !fieldNotesActive;

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
  els.showDisclaimerBtn?.addEventListener("click", showWmirsDisclaimer);
  els.copySummaryBtn.addEventListener("click", copySummary);
  els.drawRadiusBtn.addEventListener("click", toggleRadiusMode);
  els.clearRadiiBtn.addEventListener("click", clearRadii);
  els.kmlInput.addEventListener("change", importKml);
  els.clearKmlBtn.addEventListener("click", clearKml);
}

function showWmirsDisclaimer() {
  els.wmirsDisclaimerModal?.classList.remove("hidden");
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

const CREW_STAFFING_STORAGE_KEY = "romans-assignment-roster-v1";
const ASSIGNMENT_BOARD_STORAGE_KEY = "romans-assignment-board-v1";
const FIELD_NOTES_STORAGE_KEY = "romans-field-notes-v1";
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

Object.assign(els, {
  assignmentBoardPanel: document.getElementById("assignmentBoardApp"),
  assignmentRoster: document.getElementById("assignmentRoster"),
  assignmentGrid: document.getElementById("assignmentGrid"),
  assignmentReloadBtn: document.getElementById("assignmentReloadBtn"),
  assignmentImportInput: document.getElementById("assignmentImportInput"),
  assignmentClearBtn: document.getElementById("assignmentClearBtn")
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

      localStorage.setItem(CREW_STAFFING_STORAGE_KEY, JSON.stringify(assignmentPeople));
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
  try {
    const payload = JSON.parse(localStorage.getItem(CREW_STAFFING_STORAGE_KEY) || "[]");
    assignmentPeople = Array.isArray(payload)
      ? payload.map(person => ({
          id: String(person.id || crypto.randomUUID()),
          name: String(person.name || "Unnamed Person"),
          capid: String(person.capid || "Unknown")
        }))
      : [];
  } catch {
    assignmentPeople = [];
  }
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
}

function loadAssignmentBoard() {
  try {
    const saved = JSON.parse(localStorage.getItem(ASSIGNMENT_BOARD_STORAGE_KEY) || "{}");
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

function saveAssignmentBoard() {
  localStorage.setItem(ASSIGNMENT_BOARD_STORAGE_KEY, JSON.stringify(assignmentSlots));
}


function bindFieldNotesControls() {
  els.fieldNoteForm?.addEventListener("submit", addFieldNote);
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
  els.fieldNoteForm.reset();
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
    card.innerHTML = `<div class="resource-card-main"><div class="badges"><span class="badge">${escapeHtml(note.role)}</span></div><h3>${escapeHtml(note.name)}</h3><p class="resource-notes">${escapeHtml(note.text)}</p><p class="resource-meta">Recorded: ${escapeHtml(timeLabel)}</p></div>`;
    els.fieldNotesList.appendChild(card);
  });

  els.fieldNotesCount.textContent = `${fieldNotes.length} ${fieldNotes.length === 1 ? "note" : "notes"} recorded`;
}

function loadFieldNotes() {
  try {
    const saved = JSON.parse(localStorage.getItem(FIELD_NOTES_STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveFieldNotes() {
  localStorage.setItem(FIELD_NOTES_STORAGE_KEY, JSON.stringify(fieldNotes));
}
