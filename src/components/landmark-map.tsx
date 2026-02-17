"use client";

import { useRef, useState, useCallback, useMemo, useEffect } from "react";
import Map, {
  Marker,
  NavigationControl,
} from "react-map-gl/mapbox";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import useSupercluster from "use-supercluster";
import type { BBox } from "geojson";
import { useTheme } from "next-themes";
import type { LandmarkPin, LandmarkCategory } from "@/lib/landmarks";
import { applyMapTheme, MAP_THEME_FILTER, type MapThemeMode } from "@/lib/map-theme";

const UP_DILIMAN = { latitude: 14.6538, longitude: 121.0685 };

const categoryColors: Record<LandmarkCategory, string> = {
  attraction: "#e11d48",
  community: "#2563eb",
  event: "#16a34a",
};

function MarkerPin({
  color,
  selected,
  label,
}: {
  color: string;
  selected?: boolean;
  label: string;
}) {
  return (
    <div className="group relative flex flex-col items-center">
      {/* Hover label */}
      <div className="pointer-events-none absolute -top-8 whitespace-nowrap rounded-md bg-card px-2 py-1 text-[10px] font-medium text-card-foreground shadow-lg border opacity-0 transition-opacity group-hover:opacity-100 z-20">
        {label}
      </div>
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
          willChange: "transform",
          backfaceVisibility: "hidden",
        }}
      >
        <path
          d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.268 21.732 0 14 0z"
          fill={color}
        />
        <circle cx="14" cy="14" r="6" fill="white" />
      </svg>
    </div>
  );
}

function ClusterHint({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex h-3 w-3 cursor-pointer items-center justify-center transition-transform hover:scale-[2] will-change-transform [backface-visibility:hidden]"
      title=""
    >
      <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
      <span className="relative h-2.5 w-2.5 rounded-full bg-primary/50 ring-1 ring-primary/20" />
    </button>
  );
}

interface LandmarkMapProps {
  pins: LandmarkPin[];
  onSelectLandmark: (id: string | null) => void;
  selectedId?: string | null;
}

export function LandmarkMap({ pins, onSelectLandmark, selectedId }: LandmarkMapProps) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const { resolvedTheme } = useTheme();
  const [viewport, setViewport] = useState({ zoom: 15, bounds: null as mapboxgl.LngLatBounds | null });
  const mapMode: MapThemeMode = resolvedTheme === "dark" ? "dark" : "light";

  const pinNameMap = useMemo(() => {
    const nameMap: Record<string, string> = {};
    for (const pin of pins) {
      nameMap[pin.id] = pin.name;
    }
    return nameMap;
  }, [pins]);

  const updateViewport = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    setViewport({ zoom: map.getZoom(), bounds: map.getBounds() ?? null });
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    applyMapTheme(map, mapMode);
  }, [mapMode]);

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

  const { clusters: rawClusters, supercluster } = useSupercluster({
    points,
    bounds: mapBounds,
    zoom: viewport.zoom,
    options: { radius: 80, maxZoom: 18 },
  });

  const MIN_VISIBLE_PINS = 12;

  const clusters = useMemo(() => {
    if (!supercluster) return rawClusters;

    const individualPins = rawClusters.filter(
      (f) => !(f.properties as Record<string, unknown>).cluster
    );
    const clusterFeatures = rawClusters.filter(
      (f) => (f.properties as Record<string, unknown>).cluster === true
    );

    if (individualPins.length >= MIN_VISIBLE_PINS) return rawClusters;

    const sortedClusters = [...clusterFeatures].sort(
      (a, b) =>
        Number((a.properties as Record<string, unknown>).point_count) -
        Number((b.properties as Record<string, unknown>).point_count)
    );

    const result = [...individualPins];
    let visibleCount = individualPins.length;

    for (const cluster of sortedClusters) {
      if (visibleCount >= MIN_VISIBLE_PINS) {
        result.push(cluster);
        continue;
      }
      const clusterId = Number((cluster.properties as Record<string, unknown>).cluster_id);
      const count = Number((cluster.properties as Record<string, unknown>).point_count);
      const leaves = supercluster.getLeaves(clusterId, count);
      result.push(...leaves);
      visibleCount += count;
    }

    return result;
  }, [rawClusters, supercluster]);

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
      style={{
        width: "100%",
        height: "100%",
        filter: MAP_THEME_FILTER[mapMode],
        transition: "filter 450ms ease",
      }}
      mapStyle="mapbox://styles/mapbox/streets-v11"
      mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
      onLoad={(e) => {
        applyMapTheme(e.target, mapMode);
        updateViewport();
      }}
      onMoveEnd={updateViewport}
      onClick={() => onSelectLandmark(null)}
    >
      <NavigationControl position="top-right" />

      {clusters.map((feature) => {
        const [lng, lat] = feature.geometry.coordinates;
        const props = feature.properties as Record<string, unknown>;

        if (props.cluster === true) {
          const clusterId = Number(props.cluster_id);
          const count = Number(props.point_count);
          return (
            <Marker key={`cluster-${clusterId}`} latitude={lat} longitude={lng} anchor="center">
              <ClusterHint
                count={count}
                onClick={() => handleClusterClick(clusterId, lat, lng)}
              />
            </Marker>
          );
        }

        const pinId = String(props.pinId);
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
            style={{ cursor: "pointer", zIndex: selectedId === pinId ? 10 : 1, willChange: "transform" }}
          >
            <MarkerPin
              color={categoryColors[category]}
              selected={selectedId === pinId}
              label={pinNameMap[pinId] ?? ""}
            />
          </Marker>
        );
      })}
    </Map>
  );
}
