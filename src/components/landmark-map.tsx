"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Map, {
  Marker,
  Popup,
  NavigationControl,
} from "react-map-gl/mapbox";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Landmark, LandmarkCategory } from "@/lib/landmarks";

const UP_DILIMAN = { latitude: 14.6538, longitude: 121.0685 };

/** Apply Google Maps–like colors to Mapbox streets style. */
function applyMapTheme(map: mapboxgl.Map) {
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
  }
}

const categoryColors: Record<LandmarkCategory, string> = {
  attraction: "#e11d48",
  community: "#2563eb",
  event: "#16a34a",
};

const categoryLabels: Record<LandmarkCategory, string> = {
  attraction: "Attraction",
  community: "Community",
  event: "Event",
};

function MarkerPin({ color }: { color: string }) {
  return (
    <svg
      width="28"
      height="40"
      viewBox="0 0 28 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.268 21.732 0 14 0z"
        fill={color}
      />
      <circle cx="14" cy="14" r="6" fill="white" />
    </svg>
  );
}

interface LandmarkMapProps {
  landmarks: Landmark[];
}

export function LandmarkMap({ landmarks }: LandmarkMapProps) {
  const [selected, setSelected] = useState<Landmark | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || landmarks.length === 0) return;

    const bounds = new mapboxgl.LngLatBounds();
    landmarks.forEach((l) => bounds.extend([l.lng, l.lat]));
    mapRef.current.fitBounds(bounds, {
      padding: { top: 50, right: 50, bottom: 50, left: 50 },
    });
  }, [landmarks]);

  const handleMarkerClick = useCallback(
    (landmark: Landmark) => {
      setSelected((prev) => (prev?.id === landmark.id ? null : landmark));
    },
    []
  );

  return (
    <Map
      ref={(ref) => {
        mapRef.current = ref?.getMap() ?? null;
      }}
      initialViewState={{
        ...UP_DILIMAN,
        zoom: 15,
      }}
      style={{ width: "100%", height: "100%" }}
      mapStyle="mapbox://styles/mapbox/streets-v11"
      mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
      onLoad={(e) => applyMapTheme(e.target)}
    >
      <NavigationControl position="top-right" />

      {landmarks.map((landmark) => (
        <Marker
          key={landmark.id}
          latitude={landmark.lat}
          longitude={landmark.lng}
          anchor="bottom"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            handleMarkerClick(landmark);
          }}
          style={{ cursor: "pointer" }}
        >
          <MarkerPin color={categoryColors[landmark.category]} />
        </Marker>
      ))}

      {selected && (
        <Popup
          latitude={selected.lat}
          longitude={selected.lng}
          anchor="bottom"
          offset={40}
          closeOnClick={false}
          onClose={() => setSelected(null)}
        >
          <div style={{ minWidth: 200, maxWidth: 260 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span
                style={{
                  display: "inline-block",
                  height: 10,
                  width: 10,
                  borderRadius: "50%",
                  backgroundColor: categoryColors[selected.category],
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "#6b7280",
                }}
              >
                {categoryLabels[selected.category]}
              </span>
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.25, color: "#111827" }}>
              {selected.name}
            </p>
            <p style={{ marginTop: 4, fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
              {selected.description}
            </p>
            {selected.address && (
              <p style={{ marginTop: 6, fontSize: 12, color: "#9ca3af" }}>
                {selected.address}
              </p>
            )}
          </div>
        </Popup>
      )}
    </Map>
  );
}
