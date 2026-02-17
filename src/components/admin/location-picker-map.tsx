"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { useTheme } from "next-themes";
import { applyMapTheme, MAP_THEME_FILTER, type MapThemeMode } from "@/lib/map-theme";

const UP_DILIMAN = { latitude: 14.6537, longitude: 121.0691 };

// Rough bounding box around UP Diliman campus
const UP_BOUNDS = {
  minLat: 14.645,
  maxLat: 14.665,
  minLng: 121.055,
  maxLng: 121.08,
};

function isWithinUP(lat: number, lng: number) {
  return lat >= UP_BOUNDS.minLat && lat <= UP_BOUNDS.maxLat &&
    lng >= UP_BOUNDS.minLng && lng <= UP_BOUNDS.maxLng;
}

function PinIcon() {
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
        fill="#e11d48"
      />
      <circle cx="14" cy="14" r="6" fill="white" />
    </svg>
  );
}

interface LocationPickerMapProps {
  lat: number | null;
  lng: number | null;
  onLocationChange: (lat: number, lng: number) => void;
}

export function LocationPickerMap({ lat, lng, onLocationChange }: LocationPickerMapProps) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const { resolvedTheme } = useTheme();
  const [center, setCenter] = useState(UP_DILIMAN);
  const mapMode: MapThemeMode = resolvedTheme === "dark" ? "dark" : "light";

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (isWithinUP(pos.coords.latitude, pos.coords.longitude)) {
          setCenter({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        }
      },
      () => { /* ignore errors, keep UP Diliman default */ },
      { timeout: 5000 },
    );
  }, []);

  const handleClick = useCallback(
    (e: mapboxgl.MapLayerMouseEvent) => {
      onLocationChange(e.lngLat.lat, e.lngLat.lng);
    },
    [onLocationChange],
  );

  const handleDragEnd = useCallback(
    (e: { lngLat: { lat: number; lng: number } }) => {
      onLocationChange(e.lngLat.lat, e.lngLat.lng);
    },
    [onLocationChange],
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    applyMapTheme(map, mapMode);
  }, [mapMode]);

  return (
    <div className="h-[300px] w-full overflow-hidden rounded-md border transition-colors duration-500">
      <Map
        ref={(ref) => {
          mapRef.current = ref?.getMap() ?? null;
        }}
        initialViewState={{
          ...center,
          zoom: 15,
        }}
        style={{
          width: "100%",
          height: "100%",
          filter: MAP_THEME_FILTER[mapMode],
          transition: "filter 450ms ease",
        }}
        mapStyle="mapbox://styles/mapbox/streets-v11"
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        onLoad={(e) => applyMapTheme(e.target, mapMode)}
        onClick={handleClick}
        cursor="crosshair"
      >
        <NavigationControl position="top-right" />

        {lat !== null && lng !== null && (
          <Marker
            latitude={lat}
            longitude={lng}
            anchor="bottom"
            draggable
            onDragEnd={handleDragEnd}
          >
            <PinIcon />
          </Marker>
        )}
      </Map>
    </div>
  );
}
