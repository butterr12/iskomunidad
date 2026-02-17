"use client";

import { useRef, useEffect } from "react";
import Map, {
  Marker,
  NavigationControl,
} from "react-map-gl/mapbox";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Landmark, LandmarkCategory } from "@/lib/landmarks";

const UP_DILIMAN = { latitude: 14.6538, longitude: 121.0685 };

/** Apply Google Maps-like colors to Mapbox streets style. */
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

function MarkerPin({ color, selected }: { color: string; selected?: boolean }) {
  return (
    <svg
      width="28"
      height="40"
      viewBox="0 0 28 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        transform: selected ? "scale(1.3)" : "scale(1)",
        transformOrigin: "bottom center",
        transition: "transform 200ms ease-out",
      }}
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
  onSelectLandmark: (landmark: Landmark | null) => void;
  selectedId?: string | null;
}

export function LandmarkMap({ landmarks, onSelectLandmark, selectedId }: LandmarkMapProps) {
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || landmarks.length === 0) return;

    const bounds = new mapboxgl.LngLatBounds();
    landmarks.forEach((l) => bounds.extend([l.lng, l.lat]));
    mapRef.current.fitBounds(bounds, {
      padding: { top: 50, right: 50, bottom: 50, left: 50 },
    });
  }, [landmarks]);

  // Fly to selected landmark after layout settles (sidebar may resize the map container)
  useEffect(() => {
    if (!mapRef.current || !selectedId) return;
    const landmark = landmarks.find((l) => l.id === selectedId);
    if (!landmark) return;

    const timer = setTimeout(() => {
      if (!mapRef.current) return;
      mapRef.current.resize();
      const currentZoom = mapRef.current.getZoom();
      mapRef.current.flyTo({
        center: [landmark.lng, landmark.lat],
        zoom: Math.max(currentZoom, 17),
        duration: 600,
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [selectedId, landmarks]);

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
      onClick={() => onSelectLandmark(null)}
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
            onSelectLandmark(landmark);
          }}
          style={{ cursor: "pointer", zIndex: selectedId === landmark.id ? 10 : 1 }}
        >
          <MarkerPin
            color={categoryColors[landmark.category]}
            selected={selectedId === landmark.id}
          />
        </Marker>
      ))}
    </Map>
  );
}
