"use client";

import { useRef } from "react";
import Map, {
  Marker,
  NavigationControl,
} from "react-map-gl/mapbox";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Landmark, LandmarkCategory } from "@/lib/landmarks";
import { applyMapTheme } from "@/lib/map-theme";

const UP_DILIMAN = { latitude: 14.6538, longitude: 121.0685 };

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
