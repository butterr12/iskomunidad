"use client";

import { useRef, useState, useCallback, useMemo } from "react";
import Map, {
  Marker,
  NavigationControl,
} from "react-map-gl/mapbox";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import useSupercluster from "use-supercluster";
import type { BBox } from "geojson";
import type { LandmarkPin, LandmarkCategory } from "@/lib/landmarks";
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

function ClusterBubble({ count, onClick }: { count: number; onClick: () => void }) {
  const size = Math.min(24 + count * 1.5, 56);
  return (
    <div
      onClick={onClick}
      style={{ width: size, height: size }}
      className="flex cursor-pointer items-center justify-center rounded-full bg-primary/90 text-xs font-bold text-primary-foreground shadow-md ring-2 ring-primary-foreground/50 transition-transform hover:scale-110"
    >
      {count}
    </div>
  );
}

interface LandmarkMapProps {
  pins: LandmarkPin[];
  onSelectLandmark: (id: string | null) => void;
  selectedId?: string | null;
}

export function LandmarkMap({ pins, onSelectLandmark, selectedId }: LandmarkMapProps) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [viewport, setViewport] = useState({ zoom: 15, bounds: null as mapboxgl.LngLatBounds | null });

  const updateViewport = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    setViewport({ zoom: map.getZoom(), bounds: map.getBounds() ?? null });
  }, []);

  // Convert pins to GeoJSON features for supercluster
  const points = useMemo(
    () =>
      pins.map((pin) => ({
        type: "Feature" as const,
        properties: {
          cluster: false,
          pinId: pin.id,
          category: pin.category,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [pin.lng, pin.lat] as [number, number],
        },
      })),
    [pins],
  );

  const mapBounds: BBox | undefined = viewport.bounds
    ? [
        viewport.bounds.getWest(),
        viewport.bounds.getSouth(),
        viewport.bounds.getEast(),
        viewport.bounds.getNorth(),
      ]
    : undefined;

  const { clusters, supercluster } = useSupercluster({
    points,
    bounds: mapBounds,
    zoom: viewport.zoom,
    options: { radius: 60, maxZoom: 18 },
  });

  const handleClusterClick = useCallback(
    (clusterId: number, lat: number, lng: number) => {
      const map = mapRef.current;
      if (!map || !supercluster) return;
      const zoom = supercluster.getClusterExpansionZoom(clusterId);
      map.flyTo({ center: [lng, lat], zoom: Math.min(zoom, 18), duration: 500 });
    },
    [supercluster],
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
      onLoad={(e) => {
        applyMapTheme(e.target);
        updateViewport();
      }}
      onMoveEnd={updateViewport}
      onClick={() => onSelectLandmark(null)}
    >
      <NavigationControl position="top-right" />

      {clusters.map((feature) => {
        const [lng, lat] = feature.geometry.coordinates;
        const props = feature.properties as Record<string, any>;

        if (props.cluster) {
          return (
            <Marker key={`cluster-${props.cluster_id}`} latitude={lat} longitude={lng} anchor="center">
              <ClusterBubble
                count={props.point_count}
                onClick={() => handleClusterClick(props.cluster_id, lat, lng)}
              />
            </Marker>
          );
        }

        const pinId = props.pinId as string;
        const category = props.category as LandmarkCategory;

        return (
          <Marker
            key={pinId}
            latitude={lat}
            longitude={lng}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              onSelectLandmark(pinId);
            }}
            style={{ cursor: "pointer", zIndex: selectedId === pinId ? 10 : 1 }}
          >
            <MarkerPin
              color={categoryColors[category]}
              selected={selectedId === pinId}
            />
          </Marker>
        );
      })}
    </Map>
  );
}
