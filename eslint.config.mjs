import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored MapLibre worker bundles (copied from maplibre-gl/dist).
    "public/maplibre/**",
    // Binary GIS tilesets.
    "public/gis/**",
    // Python pipeline workspace: venvs and caches ship JS artifacts that are
    // not part of the app and break `eslint .`.
    "pipeline/**",
  ]),
]);
