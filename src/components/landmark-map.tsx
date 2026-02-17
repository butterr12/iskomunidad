"use client";

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Landmark, LandmarkCategory } from "@/lib/landmarks";

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

function createIcon(category: LandmarkCategory) {
  const color = categoryColors[category];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.268 21.732 0 14 0z" fill="${color}"/>
    <circle cx="14" cy="14" r="6" fill="white"/>
  </svg>`;

  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    tooltipAnchor: [0, -40],
  });
}

function FitBounds({ landmarks }: { landmarks: Landmark[] }) {
  const map = useMap();

  useEffect(() => {
    if (landmarks.length === 0) return;
    const bounds = L.latLngBounds(
      landmarks.map((l) => [l.lat, l.lng] as [number, number])
    );
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
  }, [landmarks, map]);

  return null;
}

interface LandmarkMapProps {
  landmarks: Landmark[];
}

export function LandmarkMap({ landmarks }: LandmarkMapProps) {
  return (
    <MapContainer
      center={[40.7484, -73.9857]}
      zoom={12}
      className="h-full w-full"
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds landmarks={landmarks} />
      {landmarks.map((landmark) => (
        <Marker
          key={landmark.id}
          position={[landmark.lat, landmark.lng]}
          icon={createIcon(landmark.category)}
        >
          <Tooltip
            direction="top"
            offset={[0, 0]}
            className="landmark-tooltip"
          >
            <div className="min-w-[200px] max-w-[260px]">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: categoryColors[landmark.category] }}
                />
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {categoryLabels[landmark.category]}
                </span>
              </div>
              <p className="text-sm font-semibold leading-tight">
                {landmark.name}
              </p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {landmark.description}
              </p>
              {landmark.address && (
                <p className="mt-1.5 text-xs text-muted-foreground/70">
                  {landmark.address}
                </p>
              )}
            </div>
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
