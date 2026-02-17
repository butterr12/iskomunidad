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
import { applyMapTheme, type MapThemeMode } from "@/lib/map-theme";

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
  photoUrl,
}: {
  color: string;
  selected?: boolean;
  label: string;
  photoUrl?: string | null;
}) {
  const size = selected ? 52 : 44;
  const lineH = selected ? 28 : 22;

  return (
    <div
      className="group relative flex flex-col items-center"
      style={{
        transition: "transform 200ms ease-out",
      }}
    >
      {/* Hover label */}
      <div
        className="pointer-events-none absolute whitespace-nowrap rounded-md bg-card px-2 py-1 text-[10px] font-medium text-card-foreground shadow-lg border opacity-0 transition-opacity group-hover:opacity-100 z-20"
        style={{ bottom: size + lineH + 6 }}
      >
        {label}
      </div>

      {/* Circle image */}
      <div
        className="relative flex items-center justify-center rounded-full border-2 shadow-md"
        style={{
          width: size,
          height: size,
          borderColor: color,
          backgroundColor: color,
          transition: "width 200ms ease-out, height 200ms ease-out",
        }}
      >
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={label}
            className="rounded-full object-cover"
            style={{ width: size - 4, height: size - 4 }}
            draggable={false}
          />
        ) : (
          <div
            className="flex items-center justify-center rounded-full bg-white/90"
            style={{ width: size - 4, height: size - 4 }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
        )}
      </div>

      {/* Vertical line */}
      <div
        style={{
          width: 2.5,
          height: lineH,
          backgroundColor: color,
          transition: "height 200ms ease-out",
        }}
      />

      {/* Bottom dot */}
      <div
        className="rounded-full"
        style={{
          width: 7,
          height: 7,
          backgroundColor: color,
          marginTop: -1,
        }}
      />
    </div>
  );
}

const STACK_OFFSETS = [
  { x: -8, y: -8, rotate: -6 },
  { x: 8, y: -5, rotate: 4 },
  { x: -5, y: 8, rotate: 3 },
  { x: 8, y: 8, rotate: -3 },
];

const FAN_OFFSETS = [
  { x: -28, y: -28, rotate: 0 },
  { x: 28, y: -28, rotate: 0 },
  { x: -28, y: 28, rotate: 0 },
  { x: 28, y: 28, rotate: 0 },
];

function ClusterCollage({
  photos,
  count,
  onClick,
}: {
  photos: string[];
  count: number;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const images = photos.slice(0, 4);
  const thumbSize = 44;

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex cursor-pointer items-center justify-center"
      style={{ width: 80, height: 80 }}
      title={`${count} landmarks`}
    >
      {images.map((url, i) => {
        const off = hovered ? FAN_OFFSETS[i] : STACK_OFFSETS[i];
        return (
          <img
            key={i}
            src={url}
            alt=""
            draggable={false}
            className="absolute rounded-full border-2 border-white object-cover dark:border-neutral-800"
            style={{
              width: thumbSize,
              height: thumbSize,
              transform: `translate(${off.x}px, ${off.y}px) rotate(${off.rotate}deg) scale(${hovered ? 1.05 : 1})`,
              transition: "transform 300ms cubic-bezier(.4,0,.2,1), box-shadow 300ms ease",
              zIndex: hovered ? 4 - i : i,
              boxShadow: hovered
                ? "0 4px 14px rgba(0,0,0,0.25)"
                : "0 1px 4px rgba(0,0,0,0.15)",
            }}
          />
        );
      })}

      {/* Count badge */}
      <span
        className="absolute rounded-full bg-foreground px-1.5 py-0.5 text-[9px] font-bold text-background shadow-md"
        style={{
          bottom: hovered ? -2 : 4,
          right: hovered ? -2 : 4,
          transition: "bottom 300ms ease, right 300ms ease",
          zIndex: 10,
        }}
      >
        {count}
      </span>
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

  const pinPhotoMap = useMemo(() => {
    const photoMap: Record<string, string | null> = {};
    for (const pin of pins) {
      photoMap[pin.id] = pin.photoUrl ?? null;
    }
    return photoMap;
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
        filter: mapMode === "dark" ? "saturate(0.92) brightness(0.95)" : "none",
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
          const leaves = supercluster ? supercluster.getLeaves(clusterId, count) : [];
          const clusterPhotos: string[] = [];
          for (const leaf of leaves) {
            if (clusterPhotos.length >= 4) break;
            const leafId = String((leaf.properties as Record<string, unknown>).pinId ?? "");
            const url = pinPhotoMap[leafId];
            if (url) clusterPhotos.push(url);
          }
          return (
            <Marker key={`cluster-${clusterId}`} latitude={lat} longitude={lng} anchor="center">
              <ClusterCollage
                photos={clusterPhotos}
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
            style={{ cursor: "pointer", zIndex: selectedId === pinId ? 10 : 1 }}
          >
            <MarkerPin
              color={categoryColors[category]}
              selected={selectedId === pinId}
              label={pinNameMap[pinId] ?? ""}
              photoUrl={pinPhotoMap[pinId]}
            />
          </Marker>
        );
      })}
    </Map>
  );
}
