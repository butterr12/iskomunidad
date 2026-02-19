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

const thumbSize = 44;

function ClusterCollage({
  items,
  remainingCount,
  onSelectPin,
  onExpandCluster,
}: {
  items: { pinId: string; photoUrl: string }[];
  remainingCount: number;
  onSelectPin: (pinId: string) => void;
  onExpandCluster: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const showExpanded = expanded;
  const isOnlyPlus = items.length === 0 && remainingCount > 0;
  const plusSlotOffset = isOnlyPlus ? 0 : items.length;

  const handleContainerClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-cluster-slot]")) return;
    if (!expanded) setExpanded(true);
    else onExpandCluster();
  };

  const handleSlotClick = (e: React.MouseEvent, index: number, pinId?: string) => {
    e.stopPropagation();
    if (index < 3) {
      if (!expanded) {
        setExpanded(true);
        return;
      }
      if (pinId) onSelectPin(pinId);
      return;
    }
    if (!expanded) setExpanded(true);
    else onExpandCluster();
  };

  const offsets = showExpanded || hovered ? FAN_OFFSETS : STACK_OFFSETS;
  const zIndexes = showExpanded || hovered ? [2, 3, 4, 1] : [1, 2, 3, 0];
  const hoverScale = isOnlyPlus ? (hovered ? 1.1 : 1) : (showExpanded || hovered ? 1.05 : 1);
  const plusOffset = isOnlyPlus ? { x: 0, y: 0, rotate: 0 } : offsets[plusSlotOffset];

  return (
    <div
      role="group"
      aria-label={`${items.length + remainingCount} landmarks`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setExpanded(false);
      }}
      onClick={handleContainerClick}
      className="relative flex cursor-pointer items-center justify-center"
      style={{ width: 80, height: 80 }}
    >
      {items.map((item, i) => (
        <button
          key={item.pinId}
          type="button"
          data-cluster-slot
          onClick={(e) => handleSlotClick(e, i, item.pinId)}
          className="absolute rounded-full border-2 border-white overflow-hidden dark:border-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary"
          style={{
            width: thumbSize,
            height: thumbSize,
            transform: `translate(${offsets[i].x}px, ${offsets[i].y}px) rotate(${offsets[i].rotate}deg) scale(${showExpanded || hovered ? 1.05 : 1})`,
            transition: "transform 300ms cubic-bezier(.4,0,.2,1), box-shadow 300ms ease",
            zIndex: zIndexes[i],
            boxShadow: showExpanded || hovered
              ? "0 4px 14px rgba(0,0,0,0.25)"
              : "0 1px 4px rgba(0,0,0,0.15)",
          }}
        >
          <img
            src={item.photoUrl}
            alt=""
            draggable={false}
            className="w-full h-full object-cover"
          />
        </button>
      ))}
      {remainingCount > 0 && (
        <button
          type="button"
          data-cluster-slot
          onClick={(e) => handleSlotClick(e, 3)}
          className="absolute rounded-full border-2 border-white flex items-center justify-center bg-muted text-foreground font-bold text-sm dark:border-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary"
          style={{
            width: thumbSize,
            height: thumbSize,
            transform: `translate(${plusOffset.x}px, ${plusOffset.y}px) rotate(${plusOffset.rotate}deg) scale(${hoverScale})`,
            transition: "transform 300ms cubic-bezier(.4,0,.2,1), box-shadow 300ms ease",
            zIndex: isOnlyPlus ? zIndexes[0] : zIndexes[plusSlotOffset],
            boxShadow: hovered
              ? "0 4px 14px rgba(0,0,0,0.25)"
              : "0 1px 4px rgba(0,0,0,0.15)",
          }}
        >
          +{remainingCount}
        </button>
      )}
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
  const ZOOM_EXPAND_THRESHOLD = 14;

  const clusters = useMemo(() => {
    if (!supercluster) return rawClusters;
    if (viewport.zoom <= ZOOM_EXPAND_THRESHOLD) return rawClusters;

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
  }, [rawClusters, supercluster, viewport.zoom]);

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
          const leaves = supercluster ? supercluster.getLeaves(clusterId, count) : [];
          const withPhotos: { pinId: string; photoUrl: string | null }[] = leaves
            .map((leaf) => {
              const pinId = String((leaf.properties as Record<string, unknown>).pinId ?? "");
              return { pinId, photoUrl: pinPhotoMap[pinId] ?? null };
            })
            .filter((item): item is { pinId: string; photoUrl: string } => !!item.photoUrl);
          const items = withPhotos.slice(0, 3);
          const remainingCount = count - items.length;

          return (
            <Marker key={`cluster-${clusterId}`} latitude={lat} longitude={lng} anchor="center">
              <ClusterCollage
                items={items}
                remainingCount={remainingCount}
                onSelectPin={onSelectLandmark}
                onExpandCluster={() => handleClusterClick(clusterId, lat, lng)}
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
              photoUrl={pinPhotoMap[pinId]}
            />
          </Marker>
        );
      })}
    </Map>
  );
}
