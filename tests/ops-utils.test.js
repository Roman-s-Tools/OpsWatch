import { describe, it, expect } from "vitest";
import utils from "../ops-utils.js";

const {
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
} = utils;

describe("escapeHtml", () => {
  it("escapes HTML-significant characters", () => {
    expect(escapeHtml(`<img src=x onerror="alert(1)">`)).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"
    );
  });

  it("handles null/undefined without throwing", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
});

describe("slug", () => {
  it("lowercases and hyphenates whitespace", () => {
    expect(slug("On Scene")).toBe("on-scene");
  });
});

describe("normalizeTail", () => {
  it("uppercases and strips illegal characters", () => {
    expect(normalizeTail(" n123ab! ")).toBe("N123AB");
  });

  it("tolerates empty input", () => {
    expect(normalizeTail("")).toBe("");
    expect(normalizeTail(undefined)).toBe("");
  });
});

describe("url builders", () => {
  it("builds a FlightAware URL from a tail number", () => {
    expect(buildFlightAwareUrl("n123ab")).toBe(
      "https://www.flightaware.com/live/flight/N123AB"
    );
  });

  it("builds a lowercase Flightradar24 URL", () => {
    expect(buildFlightRadarUrl("N123AB")).toBe(
      "https://www.flightradar24.com/data/aircraft/n123ab"
    );
  });

  it("builds an encoded Google Maps URL", () => {
    expect(buildMapUrl(29.76, -95.36)).toBe(
      "https://www.google.com/maps?q=29.76%2C-95.36"
    );
  });
});

describe("normalizeResource", () => {
  it("fills in defaults and preserves vehicleNumber", () => {
    const result = normalizeResource({ name: "Unit 5", vehicleNumber: "V-12" });
    expect(result.vehicleNumber).toBe("V-12");
    expect(result.crew).toBe("");
    expect(result.tail).toBe("");
    expect(result.updatedAt).toBeNull();
  });

  it("keeps an existing updatedAt timestamp", () => {
    const stamp = "2026-05-30T12:00:00.000Z";
    expect(normalizeResource({ updatedAt: stamp }).updatedAt).toBe(stamp);
  });

  it("returns a safe object for non-object input", () => {
    expect(normalizeResource(null)).toEqual({
      crew: "",
      tail: "",
      vehicleNumber: "",
      updatedAt: null
    });
  });
});

describe("resourceIconSpec", () => {
  it("returns a larger glyph icon for Air", () => {
    const spec = resourceIconSpec("Air", { Air: "#dc2626" });
    expect(spec.html).toContain("✈");
    expect(spec.html).toContain("#dc2626");
    expect(spec.iconSize).toEqual([24, 24]);
    expect(spec.iconAnchor).toEqual([12, 12]);
  });

  it("falls back to a dot for unknown types", () => {
    const spec = resourceIconSpec("Ground", {});
    expect(spec.iconSize).toEqual([18, 18]);
    expect(spec.html).toContain("#334155");
  });
});

describe("KML parsing", () => {
  const parse = xml => new DOMParser().parseFromString(xml, "application/xml");

  it("extracts coordinates as [lng, lat] pairs", () => {
    const doc = parse(
      "<Point><coordinates>-95.36,29.76,0 -95.35,29.75,0</coordinates></Point>"
    );
    const point = doc.getElementsByTagName("Point")[0];
    expect(extractCoordinates(point)).toEqual([
      [-95.36, 29.76],
      [-95.35, 29.75]
    ]);
  });

  it("parses a Point placemark into a GeoJSON feature", () => {
    const doc = parse(`<?xml version="1.0"?>
      <kml><Document><Placemark>
        <name>ICP</name>
        <Point><coordinates>-95.36,29.76,0</coordinates></Point>
      </Placemark></Document></kml>`);
    const features = parseKmlFeatures(doc);
    expect(features).toHaveLength(1);
    expect(features[0].geometry.type).toBe("Point");
    expect(features[0].properties.name).toBe("ICP");
    expect(features[0].geometry.coordinates).toEqual([-95.36, 29.76]);
  });

  it("parses a Polygon outer boundary", () => {
    const doc = parse(`<kml><Placemark><name>Zone</name><Polygon><outerBoundaryIs>
      <LinearRing><coordinates>0,0 1,0 1,1 0,0</coordinates></LinearRing>
    </outerBoundaryIs></Polygon></Placemark></kml>`);
    const features = parseKmlFeatures(doc);
    expect(features).toHaveLength(1);
    expect(features[0].geometry.type).toBe("Polygon");
  });

  it("ignores placemarks with no supported geometry", () => {
    const doc = parse("<kml><Placemark><name>Empty</name></Placemark></kml>");
    expect(parseKmlFeatures(doc)).toHaveLength(0);
  });
});

describe("minutesSince", () => {
  const now = Date.parse("2026-05-31T12:00:00.000Z");

  it("returns whole minutes elapsed", () => {
    expect(minutesSince("2026-05-31T11:30:00.000Z", now)).toBe(30);
  });

  it("never returns a negative value for future stamps", () => {
    expect(minutesSince("2026-05-31T12:30:00.000Z", now)).toBe(0);
  });

  it("returns null for missing or invalid input", () => {
    expect(minutesSince("", now)).toBeNull();
    expect(minutesSince(null, now)).toBeNull();
    expect(minutesSince("not-a-date", now)).toBeNull();
  });
});

describe("isResourceStale", () => {
  const now = Date.parse("2026-05-31T12:00:00.000Z");
  const threshold = 30 * 60 * 1000;

  it("flags resources older than the threshold", () => {
    expect(isResourceStale({ updatedAt: "2026-05-31T11:00:00.000Z" }, now, threshold)).toBe(true);
  });

  it("does not flag recently updated resources", () => {
    expect(isResourceStale({ updatedAt: "2026-05-31T11:45:00.000Z" }, now, threshold)).toBe(false);
  });

  it("treats a missing stamp as not stale", () => {
    expect(isResourceStale({ name: "No stamp" }, now, threshold)).toBe(false);
    expect(isResourceStale(null, now, threshold)).toBe(false);
  });
});

describe("buildActivityLine", () => {
  it("formats an event with detail", () => {
    expect(
      buildActivityLine({ at: "2026-05-31T12:00:00.000Z", kind: "STATUS", resourceName: "GT-1", detail: "Available → Onscene" })
    ).toBe("2026-05-31T12:00:00.000Z — STATUS: GT-1 (Available → Onscene)");
  });

  it("omits the detail parenthetical when absent", () => {
    expect(buildActivityLine({ at: "t", kind: "ADD", resourceName: "Air 1" })).toBe("t — ADD: Air 1");
  });

  it("falls back to safe defaults", () => {
    expect(buildActivityLine(null)).toBe(" — EVENT: Resource");
  });
});

describe("haversineMeters / trailDistanceMeters", () => {
  it("measures a short hop within tolerance", () => {
    const meters = haversineMeters({ lat: 29.7604, lng: -95.3698 }, { lat: 29.7614, lng: -95.3698 });
    expect(meters).toBeGreaterThan(100);
    expect(meters).toBeLessThan(125);
  });

  it("returns 0 for degenerate input", () => {
    expect(haversineMeters(null, { lat: 1, lng: 1 })).toBe(0);
    expect(trailDistanceMeters([{ lat: 1, lng: 1 }])).toBe(0);
    expect(trailDistanceMeters([])).toBe(0);
  });

  it("sums an ordered trail", () => {
    const points = [
      { lat: 29.7604, lng: -95.3698 },
      { lat: 29.7614, lng: -95.3698 },
      { lat: 29.7624, lng: -95.3698 }
    ];
    expect(trailDistanceMeters(points)).toBeGreaterThan(200);
  });
});

describe("resourceCounts", () => {
  it("groups resources by type", () => {
    const counts = resourceCounts([
      { type: "Air" },
      { type: "Air" },
      { type: "Vehicle" },
      { notype: true }
    ]);
    expect(counts).toEqual({ Air: 2, Vehicle: 1, Unknown: 1 });
  });

  it("tolerates non-array input", () => {
    expect(resourceCounts(null)).toEqual({});
  });
});

describe("buildIcs203Rows", () => {
  const positions = ["Incident Commander", "Safety Officer"];
  const people = [{ id: "p1", name: "Jordan Lee", capid: "445001" }];

  it("resolves assigned people and blanks unfilled slots", () => {
    const rows = buildIcs203Rows(positions, { "Incident Commander": "p1" }, people);
    expect(rows).toEqual([
      { position: "Incident Commander", name: "Jordan Lee", capid: "445001" },
      { position: "Safety Officer", name: "", capid: "" }
    ]);
  });

  it("tolerates missing slots/people", () => {
    const rows = buildIcs203Rows(positions, null, null);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ position: "Incident Commander", name: "", capid: "" });
  });
});
