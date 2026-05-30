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
    parseKmlFeatures
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    Object.assign(global, api);
  }
})(typeof window !== "undefined" ? window : globalThis);
