import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/**"] },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.browser,
        module: "readonly",
        L: "readonly",
        Y: "readonly",
        WebrtcProvider: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["warn", { args: "none", caughtErrors: "none" }],
      "no-empty": ["warn", { allowEmptyCatch: true }]
    }
  },
  {
    // Root shell consumes the helpers that ops-utils.js attaches to window.
    files: ["script.js"],
    languageOptions: {
      globals: {
        escapeHtml: "readonly",
        slug: "readonly",
        normalizeTail: "readonly",
        buildFlightAwareUrl: "readonly",
        buildFlightRadarUrl: "readonly",
        buildMapUrl: "readonly",
        normalizeResource: "readonly",
        resourceIconSpec: "readonly",
        extractCoordinates: "readonly",
        parseKmlFeatures: "readonly",
        minutesSince: "readonly",
        isResourceStale: "readonly",
        buildActivityLine: "readonly",
        haversineMeters: "readonly",
        trailDistanceMeters: "readonly",
        resourceCounts: "readonly",
        buildIcs203Rows: "readonly"
      }
    }
  },
  {
    files: ["sw.js"],
    languageOptions: {
      globals: { ...globals.serviceworker }
    }
  },
  {
    files: ["tests/**/*.js", "*.config.mjs"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.node }
    }
  }
];
