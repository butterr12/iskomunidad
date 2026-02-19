import type mapboxgl from "mapbox-gl";

export type MapThemeMode = "light" | "dark";

export const MAP_THEME_FILTER: Record<MapThemeMode, string> = {
  light: "none",
  dark: "saturate(1.05) brightness(0.97)",
};

const MAP_THEME_COLORS: Record<
  MapThemeMode,
  {
    background: string;
    water: string;
    landuse: string;
    building: string;
    motorwayCase: string;
    motorway: string;
    primaryCase: string;
    primary: string;
    roadCase: string;
    road: string;
    label: string;
    labelHalo: string;
  }
> = {
  light: {
    background: "#f2efe9",
    water: "#a3cee0",
    landuse: "#7db860",
    building: "#dedad3",
    motorwayCase: "#c47a16",
    motorway: "#e89820",
    primaryCase: "#c9991a",
    primary: "#e8b830",
    roadCase: "#e0dcd6",
    road: "#ffffff",
    label: "#2f2a25",
    labelHalo: "#f8f6f2",
  },
  dark: {
    background: "#0f172a",
    water: "#162d4a",
    landuse: "#1a4432",
    building: "#1e293b",
    motorwayCase: "#8b5a10",
    motorway: "#e09422",
    primaryCase: "#7a6318",
    primary: "#c9a030",
    roadCase: "#283548",
    road: "#3d4f66",
    label: "#e2e8f0",
    labelHalo: "#0b1220",
  },
};

/** Apply custom colors to the current Mapbox style. */
export function applyMapTheme(map: mapboxgl.Map, mode: MapThemeMode = "light") {
  const colors = MAP_THEME_COLORS[mode];
  const layers = map.getStyle().layers;
  if (!layers) return;

  for (const layer of layers) {
    const id = layer.id;
    const t = layer.type;

    if (t === "background") {
      map.setPaintProperty(id, "background-color", colors.background);
      continue;
    }

    if (id === "water" && t === "fill") {
      map.setPaintProperty(id, "fill-color", colors.water);
      continue;
    }

    if ((id.startsWith("landuse") || id.startsWith("landcover")) && t === "fill") {
      map.setPaintProperty(id, "fill-color", colors.landuse);
      map.setPaintProperty(id, "fill-opacity", mode === "dark" ? 0.55 : 0.7);
      continue;
    }

    if (id.startsWith("building")) {
      if (t === "fill") {
        map.setPaintProperty(id, "fill-color", colors.building);
        map.setPaintProperty(id, "fill-outline-color", colors.building);
        map.setPaintProperty(id, "fill-opacity", 0.9);
      } else if (t === "line") {
        map.setPaintProperty(id, "line-color", colors.building);
      }
      continue;
    }

    if (t === "line" && (id.startsWith("road-motorway") || id.startsWith("road-trunk"))) {
      map.setPaintProperty(
        id,
        "line-color",
        id.endsWith("-case") ? colors.motorwayCase : colors.motorway,
      );
      continue;
    }
    if (t === "line" && (id.startsWith("road-primary") || id.startsWith("road-secondary"))) {
      map.setPaintProperty(
        id,
        "line-color",
        id.endsWith("-case") ? colors.primaryCase : colors.primary,
      );
      continue;
    }
    if (t === "line" && id.startsWith("road-")) {
      map.setPaintProperty(id, "line-color", id.endsWith("-case") ? colors.roadCase : colors.road);
      continue;
    }

    // Hide all POI layers (labels & icons)
    if (id.startsWith("poi")) {
      map.setLayoutProperty(id, "visibility", "none");
      continue;
    }

    if (t === "symbol" && id.includes("label")) {
      map.setPaintProperty(id, "text-color", colors.label);
      map.setPaintProperty(id, "text-halo-color", colors.labelHalo);
      continue;
    }

    // Catch-all: theme any remaining line/fill layers (bridges, tunnels,
    // structure casings, boundaries, etc.) so nothing leaks stale colors
    // when switching between light ↔ dark.
    if (t === "line") {
      map.setPaintProperty(id, "line-color", colors.roadCase);
    } else if (t === "fill") {
      map.setPaintProperty(id, "fill-color", colors.background);
      map.setPaintProperty(id, "fill-outline-color", colors.background);
    }
  }
}
