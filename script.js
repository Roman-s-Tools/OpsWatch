const STORAGE_KEY = "romans-resource-tracker-v1";

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
    tail: ""
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
    tail: ""
  }
];

let resources = loadResources();
let currentFilter = "All";
let searchQuery = "";
let map;
let markerLayer;
let hasAutoFittedMap = false;
let mapUpdateHandle;

const els = {
  form: document.getElementById("resourceForm"),
  type: document.getElementById("resourceType"),
  name: document.getElementById("resourceName"),
  label: document.getElementById("resourceLabel"),
  lat: document.getElementById("latitude"),
  lng: document.getElementById("longitude"),
  tail: document.getElementById("tailNumber"),
  status: document.getElementById("status"),
  notes: document.getElementById("notes"),
  mapFields: document.getElementById("mapFields"),
  airFields: document.getElementById("airFields"),
  useLocationBtn: document.getElementById("useLocationBtn"),
  list: document.getElementById("resourceList"),
  count: document.getElementById("resourceCount"),
  search: document.getElementById("searchInput"),
  exportBtn: document.getElementById("exportBtn"),
  importInput: document.getElementById("importInput"),
  copySummaryBtn: document.getElementById("copySummaryBtn")
};

document.addEventListener("DOMContentLoaded", () => {
  initMap();
  bindEvents();
  render();
});

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
}

function initMap() {
  map = L.map("map", {
    zoomControl: true,
    scrollWheelZoom: true,
    preferCanvas: true
  }).setView([29.7604, -95.3698], 12);

  const tiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  });

  tiles.on("tileerror", () => {
    console.warn("Map tiles failed to load. Retrying from existing map state.");
  });

  tiles.addTo(map);

  markerLayer = L.layerGroup().addTo(map);
}

function toggleResourceFields() {
  const isAir = els.type.value === "Air";
  els.mapFields.classList.toggle("hidden", isAir);
  els.airFields.classList.toggle("hidden", !isAir);

  els.lat.required = !isAir;
  els.lng.required = !isAir;
  els.tail.required = isAir;
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
    lat: type === "Air" ? "" : Number(els.lat.value),
    lng: type === "Air" ? "" : Number(els.lng.value),
    notes: els.notes.value.trim(),
    tail: type === "Air" ? normalizeTail(els.tail.value) : ""
  };

  if (!resource.name) return;

  if (type !== "Air" && (!Number.isFinite(resource.lat) || !Number.isFinite(resource.lng))) {
    alert("Ground and sUAS resources need valid latitude and longitude.");
    return;
  }

  if (type === "Air" && !resource.tail) {
    alert("Air resources need a tail number or registration.");
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
  if (mapUpdateHandle) {
    cancelAnimationFrame(mapUpdateHandle);
  }

  mapUpdateHandle = requestAnimationFrame(() => {
    renderMap(visible);
    mapUpdateHandle = undefined;
  });
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
      resource.tail,
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
    if (resource.type === "Air") {
      meta.textContent = `Tail / Registration: ${resource.tail}`;
    } else {
      meta.textContent = `${resource.label} · ${resource.lat}, ${resource.lng}`;
    }

    const actions = card.querySelector(".resource-actions");

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
  markerLayer.clearLayers();

  const mapResources = visible.filter(resource =>
    resource.type !== "Air" &&
    Number.isFinite(Number(resource.lat)) &&
    Number.isFinite(Number(resource.lng))
  );

  if (!mapResources.length) return;

  const bounds = [];

  mapResources.forEach(resource => {
    const latLng = [Number(resource.lat), Number(resource.lng)];
    bounds.push(latLng);

    const icon = L.divIcon({
      className: "",
      html: `
        <div class="map-label">
          <span class="map-dot ${resource.type === "sUAS" ? "suas" : ""}"></span>
          ${escapeHtml(resource.label || resource.name)}
        </div>
      `,
      iconAnchor: [18, 36]
    });

    const marker = L.marker(latLng, { icon }).bindPopup(`
      <strong>${escapeHtml(resource.name)}</strong><br>
      Type: ${escapeHtml(resource.type)}<br>
      Status: ${escapeHtml(resource.status)}<br>
      Coordinates: ${escapeHtml(String(resource.lat))}, ${escapeHtml(String(resource.lng))}<br>
      ${escapeHtml(resource.notes || "No notes entered.")}
    `);

    marker.addTo(markerLayer);
  });

  const shouldAutoFit = !hasAutoFittedMap || bounds.length === 1;
  if (shouldAutoFit) {
    map.fitBounds(bounds, {
      padding: [45, 45],
      maxZoom: 15
    });
    hasAutoFittedMap = true;
  }
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
      els.lat.value = position.coords.latitude.toFixed(6);
      els.lng.value = position.coords.longitude.toFixed(6);
    },
    () => alert("Could not get your current location.")
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
      return `${resource.type}: ${resource.name} (${resource.tail}) - ${resource.status} - ${resource.notes || "No notes"}`;
    }

    return `${resource.type}: ${resource.name} [${resource.label}] - ${resource.status} - ${resource.lat}, ${resource.lng} - ${resource.notes || "No notes"}`;
  }).join("\n");

  navigator.clipboard.writeText(summary).then(
    () => alert("Resource summary copied."),
    () => alert("Could not copy the summary.")
  );
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
