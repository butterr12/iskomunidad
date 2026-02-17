import type mapboxgl from "mapbox-gl";

export type MapThemeMode = "light" | "dark";

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
    water: "#aad3df",
    landuse: "#c8e6a0",
    building: "#dedad3",
    motorwayCase: "#d4891a",
    motorway: "#f5a623",
    primaryCase: "#e0b040",
    primary: "#fcd462",
    roadCase: "#e0dcd6",
    road: "#ffffff",
    label: "#2f2a25",
    labelHalo: "#f8f6f2",
  },
  dark: {
    background: "#0f172a",
    water: "#1f3b5c",
    landuse: "#17392d",
    building: "#2b3447",
    motorwayCase: "#734d1b",
    motorway: "#b6842a",
    primaryCase: "#605024",
    primary: "#987f3c",
    roadCase: "#334155",
    road: "#475569",
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
      map.setPaintProperty(id, "fill-opacity", 0.5);
      continue;
    }

    if (id.startsWith("building") && t === "fill") {
      map.setPaintProperty(id, "fill-color", colors.building);
      map.setPaintProperty(id, "fill-opacity", 0.9);
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
  }
}
