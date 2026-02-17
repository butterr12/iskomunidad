import type mapboxgl from "mapbox-gl";

/** Apply Google Maps-like colors to Mapbox streets style. */
export function applyMapTheme(map: mapboxgl.Map) {
  const layers = map.getStyle().layers;
  if (!layers) return;

  for (const layer of layers) {
    const id = layer.id;
    const t = layer.type;

    if (t === "background") {
      map.setPaintProperty(id, "background-color", "#f2efe9");
      continue;
    }

    if (id === "water" && t === "fill") {
      map.setPaintProperty(id, "fill-color", "#aad3df");
      continue;
    }

    if ((id.startsWith("landuse") || id.startsWith("landcover")) && t === "fill") {
      map.setPaintProperty(id, "fill-color", "#c8e6a0");
      map.setPaintProperty(id, "fill-opacity", 0.5);
      continue;
    }

    if (id.startsWith("building") && t === "fill") {
      map.setPaintProperty(id, "fill-color", "#dedad3");
      map.setPaintProperty(id, "fill-opacity", 0.9);
      continue;
    }

    if (t === "line" && (id.startsWith("road-motorway") || id.startsWith("road-trunk"))) {
      map.setPaintProperty(id, "line-color", id.endsWith("-case") ? "#d4891a" : "#f5a623");
      continue;
    }
    if (t === "line" && (id.startsWith("road-primary") || id.startsWith("road-secondary"))) {
      map.setPaintProperty(id, "line-color", id.endsWith("-case") ? "#e0b040" : "#fcd462");
      continue;
    }
    if (t === "line" && id.startsWith("road-")) {
      map.setPaintProperty(id, "line-color", id.endsWith("-case") ? "#e0dcd6" : "#ffffff");
      continue;
    }

    // Hide all POI layers (labels & icons)
    if (id.startsWith("poi")) {
      map.setLayoutProperty(id, "visibility", "none");
      continue;
    }
  }
}
