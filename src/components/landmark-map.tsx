"use client";

import { createContext, useContext, useRef, useState, useCallback, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Map, {
  Marker,
  NavigationControl,
} from "react-map-gl/mapbox";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import useSupercluster from "use-supercluster";
import type { BBox } from "geojson";
import { useTheme } from "next-themes";
import { MapPin } from "lucide-react";
import type { LandmarkPin, LandmarkCategory, Landmark } from "@/lib/landmarks";
import { applyMapTheme, MAP_THEME_FILTER, type MapThemeMode } from "@/lib/map-theme";
import { getLandmarkById } from "@/actions/landmarks";

const PREVIEW_HEIGHT_ESTIMATE = 220;

const MapContainerContext = createContext<{ getContainer: () => HTMLElement | null } | null>(null);

function usePreviewPlacement(anchorRef: React.RefObject<HTMLElement | null>, isHovered: boolean): "above" | "below" {
  const ctx = useContext(MapContainerContext);
  const [placement, setPlacement] = useState<"above" | "below">("below");

  useEffect(() => {
    if (!isHovered || !ctx) return;
    const id = requestAnimationFrame(() => {
      if (!anchorRef.current) return;
      const container = ctx.getContainer();
      if (!container) return;
      const anchorRect = anchorRef.current.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const spaceBelow = containerRect.bottom - anchorRect.bottom;
      const spaceAbove = anchorRect.top - containerRect.top;
      setPlacement(spaceBelow >= PREVIEW_HEIGHT_ESTIMATE || spaceBelow >= spaceAbove ? "below" : "above");
    });
    return () => cancelAnimationFrame(id);
  }, [isHovered, ctx]);

  return placement;
}

const UP_DILIMAN = { latitude: 14.6538, longitude: 121.0685 };

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

function useLandmarkPreview(pinId: string, onPreviewHoverChange?: (id: string | null) => void) {
  const [hovered, setHovered] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const placement = usePreviewPlacement(anchorRef, hovered);

  const { data: landmark, isLoading } = useQuery({
    queryKey: ["landmark-preview", pinId],
    queryFn: async () => {
      const res = await getLandmarkById(pinId);
      return res.success ? (res.data as Landmark) : null;
    },
    enabled: hovered,
    staleTime: 5 * 60 * 1000,
  });

  const handleMouseEnter = useCallback(() => {
    setHovered(true);
    onPreviewHoverChange?.(pinId);
  }, [pinId, onPreviewHoverChange]);

  const handleMouseLeave = useCallback(() => {
    setHovered(false);
    onPreviewHoverChange?.(null);
  }, [onPreviewHoverChange]);

  return { hovered, anchorRef, placement, landmark: landmark ?? null, isLoading, handleMouseEnter, handleMouseLeave };
}

function PlacePreview({
  landmark,
  pinId,
  isLoading,
  placement,
}: {
  landmark: Landmark | null;
  pinId: string;
  isLoading?: boolean;
  placement: "above" | "below";
}) {
  const placementClass =
    placement === "below"
      ? "top-full left-1/2 -translate-x-1/2 mt-2"
      : "bottom-full left-1/2 -translate-x-1/2 mb-2";
  const previewClass = `absolute ${placementClass} w-64 max-w-[min(64rem,80vw)] rounded-lg bg-card shadow-xl border overflow-hidden z-50 pointer-events-none`;

  if (isLoading) {
    return (
      <div className={previewClass}>
        <div className="w-full h-28 bg-muted animate-pulse" />
        <div className="p-3">
          <div className="h-4 bg-muted rounded mb-2 animate-pulse" />
          <div className="h-3 bg-muted rounded w-2/3 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!landmark) return null;

  const mainPhoto = landmark.photos?.[0]?.resolvedUrl;

  return (
    <div className={previewClass}>
      {mainPhoto && (
        <div className="w-full h-28 bg-muted">
          <img
            src={mainPhoto}
            alt={landmark.name}
            className="w-full h-full object-cover"
            draggable={false}
          />
        </div>
      )}
      <div className="p-3">
        <h3 className="font-semibold text-sm mb-1 line-clamp-1">{landmark.name}</h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">
            {categoryLabels[landmark.category]}
          </span>
          {landmark.address && (
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{landmark.address}</span>
            </div>
          )}
        </div>
        {landmark.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{landmark.description}</p>
        )}
      </div>
    </div>
  );
}

function MarkerPin({
  color,
  selected,
  label,
  photoUrl,
  pinId,
  onPreviewHoverChange,
}: {
  color: string;
  selected?: boolean;
  label: string;
  photoUrl?: string | null;
  pinId: string;
  onPreviewHoverChange?: (id: string | null) => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const { hovered, anchorRef, placement, landmark, isLoading, handleMouseEnter, handleMouseLeave } =
    useLandmarkPreview(pinId, onPreviewHoverChange);
  const size = selected ? 52 : 44;
  const lineH = selected ? 28 : 22;
  const showPhoto = photoUrl && !imgFailed;

  return (
    <div
      ref={anchorRef}
      className="group relative flex flex-col items-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        transition: "transform 200ms ease-out",
      }}
    >
      {hovered && (
        <PlacePreview
          landmark={landmark ?? null}
          pinId={pinId}
          isLoading={isLoading}
          placement={placement}
        />
      )}

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
        {showPhoto ? (
          <>
            {!imgLoaded && (
              <div
                className="absolute rounded-full bg-white/60 animate-pulse"
                style={{ width: size - 4, height: size - 4 }}
              />
            )}
            <img
              src={photoUrl}
              alt={label}
              className="rounded-full object-cover transition-opacity duration-300"
              style={{ width: size - 4, height: size - 4, opacity: imgLoaded ? 1 : 0 }}
              draggable={false}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgFailed(true)}
            />
          </>
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

const ZOOM_EXPAND_THRESHOLD = 14;
const thumbSize = 44;

function ClusterImageSlot({
  pinId,
  photoUrl,
  index,
  offsets,
  zIndexes,
  showExpanded,
  onSlotClick,
  onPreviewHoverChange,
  onImgError,
}: {
  pinId: string;
  photoUrl: string;
  index: number;
  offsets: typeof STACK_OFFSETS;
  zIndexes: number[];
  showExpanded: boolean;
  onSlotClick: (e: React.MouseEvent) => void;
  onPreviewHoverChange?: (id: string | null) => void;
  onImgError?: (pinId: string) => void;
}) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const { hovered, anchorRef, placement, landmark, isLoading, handleMouseEnter, handleMouseLeave } =
    useLandmarkPreview(pinId, onPreviewHoverChange);

  return (
    <div ref={anchorRef} className="absolute inset-0">
      {hovered && (
        <PlacePreview
          landmark={landmark ?? null}
          pinId={pinId}
          isLoading={isLoading}
          placement={placement}
        />
      )}
      <button
        type="button"
        data-cluster-slot
        onClick={onSlotClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="absolute rounded-full border-2 border-white overflow-hidden dark:border-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary"
        style={{
          width: thumbSize,
          height: thumbSize,
          transform: `translate(${offsets[index].x}px, ${offsets[index].y}px) rotate(${offsets[index].rotate}deg) scale(${showExpanded ? 1.05 : 1})`,
          transition: "transform 300ms cubic-bezier(.4,0,.2,1), box-shadow 300ms ease",
          zIndex: zIndexes[index],
          boxShadow: showExpanded
            ? "0 4px 14px rgba(0,0,0,0.25)"
            : "0 1px 4px rgba(0,0,0,0.15)",
        }}
      >
        {!imgLoaded && (
          <div className="absolute inset-0 bg-muted animate-pulse rounded-full" />
        )}
        <img
          src={photoUrl}
          alt=""
          draggable={false}
          className="w-full h-full object-cover transition-opacity duration-300"
          style={{ opacity: imgLoaded ? 1 : 0 }}
          onLoad={() => setImgLoaded(true)}
          onError={() => onImgError?.(pinId)}
        />
      </button>
    </div>
  );
}

function ClusterCollage({
  items,
  remainingCount,
  onSelectPin,
  onExpandCluster,
  onPreviewHoverChange,
}: {
  items: { pinId: string; photoUrl: string }[];
  remainingCount: number;
  onSelectPin: (pinId: string) => void;
  onExpandCluster: () => void;
  onPreviewHoverChange?: (id: string | null) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [failedPinIds, setFailedPinIds] = useState<Set<string>>(new Set());
  const visibleItems = items.filter((item) => !failedPinIds.has(item.pinId));
  const showExpanded = expanded;
  const isOnlyPlus = visibleItems.length === 0 && remainingCount > 0;
  const plusSlotOffset = isOnlyPlus ? 0 : visibleItems.length;

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
      aria-label={`${visibleItems.length + remainingCount} landmarks`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setExpanded(false);
      }}
      onClick={handleContainerClick}
      className="relative flex cursor-pointer items-center justify-center"
      style={{ width: 80, height: 80 }}
    >
      {visibleItems.map((item, i) => (
        <ClusterImageSlot
          key={item.pinId}
          pinId={item.pinId}
          photoUrl={item.photoUrl}
          index={i}
          offsets={offsets}
          zIndexes={zIndexes}
          showExpanded={showExpanded || hovered}
          onSlotClick={(e) => handleSlotClick(e, i, item.pinId)}
          onPreviewHoverChange={onPreviewHoverChange}
          onImgError={(id) => setFailedPinIds((prev) => new Set(prev).add(id))}
        />
      ))}
      {remainingCount > 0 && (
        <button
          type="button"
          data-cluster-slot
          onClick={(e) => handleSlotClick(e, 3)}
          className="absolute left-0 top-0 rounded-full border-2 border-white flex items-center justify-center bg-muted text-foreground font-bold text-sm dark:border-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary"
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
  const [zoom, setZoom] = useState(15);
  const [hoveredPreviewPinId, setHoveredPreviewPinId] = useState<string | null>(null);
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

  const updateZoom = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    setZoom(map.getZoom());
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

  const mapBounds: BBox = [-180, -90, 180, 90];

  const { clusters: rawClusters, supercluster } = useSupercluster({
    points,
    bounds: mapBounds,
    zoom,
    options: { radius: 80, maxZoom: 18 },
  });

  const MIN_VISIBLE_PINS = 12;

  const clusters = useMemo(() => {
    if (!supercluster) return rawClusters;
    if (zoom <= ZOOM_EXPAND_THRESHOLD) return rawClusters;

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
  }, [rawClusters, supercluster, zoom]);

  const handleClusterClick = useCallback(
    (clusterId: number, lat: number, lng: number) => {
      const map = mapRef.current;
      if (!map || !supercluster) return;
      const zoom = supercluster.getClusterExpansionZoom(clusterId);
      map.flyTo({ center: [lng, lat], zoom: Math.min(zoom, 18), duration: 500 });
    },
    [supercluster],
  );

  const mapContainerContextValue = useMemo(
    () => ({ getContainer: () => mapRef.current?.getContainer() ?? null }),
    [],
  );

  return (
    <MapContainerContext.Provider value={mapContainerContextValue}>
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
        updateZoom();
      }}
      onMove={updateZoom}
      onMoveEnd={updateZoom}
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
          const withPhotos = leaves
            .map((leaf) => {
              const pinId = String((leaf.properties as Record<string, unknown>).pinId ?? "");
              return { pinId, photoUrl: pinPhotoMap[pinId] ?? null };
            })
            .filter((item): item is { pinId: string; photoUrl: string } => !!item.photoUrl);
          const items = withPhotos.slice(0, 3);
          const remainingCount = count - items.length;

          const clusterPinIds = items.map((i) => i.pinId);
          const isClusterShowingPreview = hoveredPreviewPinId !== null && clusterPinIds.includes(hoveredPreviewPinId);

          return (
            <Marker
              key={`cluster-${clusterId}`}
              latitude={lat}
              longitude={lng}
              anchor="center"
              style={{ zIndex: isClusterShowingPreview ? 9999 : 1, willChange: "transform" }}
            >
              <ClusterCollage
                items={items}
                remainingCount={remainingCount}
                onSelectPin={onSelectLandmark}
                onExpandCluster={() => handleClusterClick(clusterId, lat, lng)}
                onPreviewHoverChange={setHoveredPreviewPinId}
              />
            </Marker>
          );
        }

        const pinId = String(props.pinId);
        const category = props.category as LandmarkCategory;

        const isShowingPreview = hoveredPreviewPinId === pinId;
        const markerZ = isShowingPreview ? 9999 : selectedId === pinId ? 10 : 1;

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
            style={{ cursor: "pointer", zIndex: markerZ, willChange: "transform" }}
          >
            <MarkerPin
              color={categoryColors[category]}
              selected={selectedId === pinId}
              label={pinNameMap[pinId] ?? ""}
              photoUrl={pinPhotoMap[pinId]}
              pinId={pinId}
              onPreviewHoverChange={setHoveredPreviewPinId}
            />
          </Marker>
        );
      })}
    </Map>
    </MapContainerContext.Provider>
  );
}
