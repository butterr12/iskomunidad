"use client";

import { useRef, useEffect, useCallback } from "react";
import Map, { Marker } from "react-map-gl/mapbox";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const UP_DILIMAN = { latitude: 14.6538, longitude: 121.0685 };

const landmarks = [
  { id: "oblation", name: "Oblation", lat: 14.6536, lng: 121.0686, color: "#e82b2b" },
  { id: "carillon", name: "Carillon Tower", lat: 14.6567, lng: 121.0649, color: "#fa602d" },
  { id: "sunken", name: "Sunken Garden", lat: 14.6545, lng: 121.0662, color: "#16a34a" },
  { id: "mainlib", name: "Main Library", lat: 14.6520, lng: 121.0670, color: "#2563eb" },
  { id: "palma", name: "Palma Hall", lat: 14.6553, lng: 121.0680, color: "#8b5cf6" },
  { id: "engg", name: "College of Engineering", lat: 14.6490, lng: 121.0642, color: "#fa602d" },
  { id: "science", name: "College of Science", lat: 14.6530, lng: 121.0715, color: "#06b6d4" },
  { id: "shopping", name: "Shopping Center", lat: 14.6512, lng: 121.0632, color: "#f59e0b" },
  { id: "church", name: "Parish of the Holy Sacrifice", lat: 14.6558, lng: 121.0635, color: "#7a1213" },
  { id: "amphitheater", name: "UP Amphitheater", lat: 14.6540, lng: 121.0720, color: "#ec4899" },
];

function MarkerPin({ color, label }: { color: string; label: string }) {
  return (
    <div className="group relative flex flex-col items-center">
      <div className="pointer-events-none absolute -top-8 whitespace-nowrap rounded-md bg-card px-2 py-1 text-[10px] font-medium text-card-foreground shadow-lg border opacity-0 transition-opacity group-hover:opacity-100">
        {label}
      </div>
      <svg
        width="24"
        height="34"
        viewBox="0 0 28 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-md"
      >
        <path
          d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.268 21.732 0 14 0z"
          fill={color}
        />
        <circle cx="14" cy="14" r="6" fill="white" fillOpacity="0.9" />
      </svg>
    </div>
  );
}

function applyLandingTheme(map: mapboxgl.Map) {
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

export function LandingMap() {
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const onLoad = useCallback((e: { target: mapboxgl.Map }) => {
    const map = e.target;
    applyLandingTheme(map);

    map.addSource("mapbox-dem", {
      type: "raster-dem",
      url: "mapbox://mapbox.mapbox-terrain-dem-v1",
      tileSize: 512,
      maxzoom: 14,
    });
    map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });

    const buildingLayer = map.getStyle().layers?.find(
      (l) => l.id === "building" && l.type === "fill"
    );
    if (buildingLayer) {
      map.addLayer({
        id: "3d-buildings",
        source: "composite",
        "source-layer": "building",
        filter: ["==", "extrude", "true"],
        type: "fill-extrusion",
        minzoom: 14,
        paint: {
          "fill-extrusion-color": "#dedad3",
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": ["get", "min_height"],
          "fill-extrusion-opacity": 0.7,
        },
      });
    }

    let start: number | null = null;
    const duration = 60000;
    const rotateSpeed = 0.5;

    function rotate(timestamp: number) {
      if (!map) return;
      if (start === null) start = timestamp;
      const elapsed = timestamp - start;
      const bearing = (elapsed / duration) * 360 * rotateSpeed;
      map.rotateTo(bearing % 360, { duration: 0 });
      requestAnimationFrame(rotate);
    }

    requestAnimationFrame(rotate);
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border shadow-lg">
      <Map
        ref={(ref) => {
          mapRef.current = ref?.getMap() ?? null;
        }}
        initialViewState={{
          ...UP_DILIMAN,
          zoom: 15.5,
          pitch: 60,
          bearing: -20,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/streets-v11"
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        onLoad={onLoad}
        interactive={false}
        attributionControl={false}
      >
        {landmarks.map((lm) => (
          <Marker
            key={lm.id}
            latitude={lm.lat}
            longitude={lm.lng}
            anchor="bottom"
          >
            <MarkerPin color={lm.color} label={lm.name} />
          </Marker>
        ))}
      </Map>
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/5" />
    </div>
  );
}
