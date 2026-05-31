/**
 * Shared, dependency-free helpers for OpsWatch.
 *
 * Loaded as a plain <script> in the browser (functions land on `window`) and
 * required directly in unit tests via module.exports. Keep everything in here
 * pure and free of DOM/global state beyond the arguments passed in.
 */
(function (global) {
  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>'"]/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#039;",
      '"': "&quot;"
    }[char]));
  }

  function slug(value) {
    return String(value).toLowerCase().replace(/\s+/g, "-");
  }

  function normalizeTail(tail) {
    return String(tail || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
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

  function normalizeResource(resource) {
    const source = resource && typeof resource === "object" ? resource : {};
    return {
      ...source,
      crew: source.crew || "",
      tail: source.tail || "",
      vehicleNumber: source.vehicleNumber || "",
      updatedAt: source.updatedAt || null
    };
  }

  // Returns the divIcon spec ({ html, iconSize, iconAnchor }) for a resource
  // type. Shared by the main map and the pop-out dashboard so the two never
  // drift apart. `colors` is a { type: cssColor } lookup.
  function resourceIconSpec(type, colors) {
    const color = (colors && colors[type]) || "#334155";
    const glyphs = {
      Air: { char: "✈", size: 24, font: 22 },
      Vehicle: { char: "🚗", size: 22, font: 20 },
      "Incident Command Post": { char: "🚩", size: 22, font: 20 },
      "Staging Area": { char: "🏢", size: 22, font: 20 }
    };
    const glyph = glyphs[type];
    if (glyph) {
      const html = `<span style="display:grid;place-items:center;width:${glyph.size}px;height:${glyph.size}px;color:${color};font-size:${glyph.font}px;line-height:1;text-shadow:0 0 2px #fff,0 0 4px #fff;">${glyph.char}</span>`;
      const half = Math.round(glyph.size / 2);
      return { html, iconSize: [glyph.size, glyph.size], iconAnchor: [half, half] };
    }
    const html = `<span style="display:block;width:14px;height:14px;border-radius:999px;background:${color};border:2px solid #fff;box-shadow:0 0 0 1px rgba(15,23,42,0.35);"></span>`;
    return { html, iconSize: [18, 18], iconAnchor: [9, 9] };
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

  // Minutes elapsed since an ISO timestamp, or null when the stamp is missing
  // or unparseable. `nowMs` is injectable so callers (and tests) stay pure.
  function minutesSince(iso, nowMs) {
    if (!iso) return null;
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return null;
    const now = Number.isFinite(nowMs) ? nowMs : Date.now();
    return Math.max(0, Math.floor((now - then) / 60000));
  }

  // A resource is "stale" (check-in overdue) when it carries an updatedAt stamp
  // that is older than the threshold. Resources without a stamp are treated as
  // unknown rather than stale, so imported/seed data doesn't spam warnings.
  function isResourceStale(resource, nowMs, thresholdMs) {
    const source = resource && typeof resource === "object" ? resource : {};
    if (!source.updatedAt) return false;
    const then = new Date(source.updatedAt).getTime();
    if (!Number.isFinite(then)) return false;
    const now = Number.isFinite(nowMs) ? nowMs : Date.now();
    const threshold = Number.isFinite(thresholdMs) ? thresholdMs : 30 * 60 * 1000;
    return now - then > threshold;
  }

  // One human-readable line for an activity-log event, used by the Activity
  // tab and the ICS-214 export. Built from the stored ISO string so it stays
  // deterministic (and unit-testable) regardless of locale/timezone.
  function buildActivityLine(event) {
    const source = event && typeof event === "object" ? event : {};
    const when = source.at || "";
    const kind = source.kind || "EVENT";
    const name = source.resourceName || "Resource";
    const detail = source.detail ? ` (${source.detail})` : "";
    return `${when} — ${kind}: ${name}${detail}`;
  }

  // Great-circle distance in meters between two { lat, lng } points. Used to
  // total up GPS breadcrumb trails.
  function haversineMeters(a, b) {
    if (!a || !b) return 0;
    const R = 6371000;
    const toRad = deg => (Number(deg) * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  // Total length in meters of an ordered list of { lat, lng } trail points.
  function trailDistanceMeters(points) {
    if (!Array.isArray(points) || points.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < points.length; i += 1) {
      total += haversineMeters(points[i - 1], points[i]);
    }
    return total;
  }

  // Resource counts grouped by type, used by the Command snapshot and ICS-201.
  function resourceCounts(resources) {
    const list = Array.isArray(resources) ? resources : [];
    return list.reduce((counts, resource) => {
      const type = (resource && resource.type) || "Unknown";
      counts[type] = (counts[type] || 0) + 1;
      return counts;
    }, {});
  }

  // Rows for an ICS-203 Organization Assignment List: one entry per position,
  // with the assigned person resolved from the slot map (blank when unfilled).
  function buildIcs203Rows(positions, slots, people) {
    const slotMap = slots && typeof slots === "object" ? slots : {};
    const roster = Array.isArray(people) ? people : [];
    return (Array.isArray(positions) ? positions : []).map(position => {
      const personId = slotMap[position] || "";
      const person = roster.find(item => item && item.id === personId);
      return {
        position,
        name: person ? person.name : "",
        capid: person ? person.capid : ""
      };
    });
  }

  const api = {
    escapeHtml,
    slug,
    normalizeTail,
    buildFlightAwareUrl,
    buildFlightRadarUrl,
    buildMapUrl,
    normalizeResource,
    resourceIconSpec,
    extractCoordinates,
    parseKmlFeatures,
    minutesSince,
    isResourceStale,
    buildActivityLine,
    haversineMeters,
    trailDistanceMeters,
    resourceCounts,
    buildIcs203Rows
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    Object.assign(global, api);
  }
})(typeof window !== "undefined" ? window : globalThis);
