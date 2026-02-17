"use client";

import { useCallback } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { applyMapTheme } from "@/lib/map-theme";

const UP_DILIMAN = { latitude: 14.6537, longitude: 121.0691 };

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

  return (
    <div className="h-[300px] w-full rounded-md border overflow-hidden">
      <Map
        initialViewState={{
          latitude: lat ?? UP_DILIMAN.latitude,
          longitude: lng ?? UP_DILIMAN.longitude,
          zoom: 15,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/streets-v11"
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        onLoad={(e) => applyMapTheme(e.target)}
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
