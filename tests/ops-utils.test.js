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
  parseKmlFeatures
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
