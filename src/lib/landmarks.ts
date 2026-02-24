export type LandmarkCategory = "attraction" | "community" | "event";

// Extensible discriminated union — add "gig" | "announcement" etc. later
export type LandmarkBannerType = "event";

export interface LandmarkBanner {
  type: LandmarkBannerType;
  id: string;             // event.id
  title: string;          // event.title
  imageUrl: string | null; // resolved proxy URL (null if no coverImageKey)
  coverColor: string;     // fallback solid fill
  startDate: string;      // ISO string
}

export interface LandmarkPin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: LandmarkCategory;
  photoUrl?: string | null;
  banner?: LandmarkBanner | null;
}

export type PhotoSource = "upload" | "google_places";

export interface LandmarkPhoto {
  id: string;
  url: string;
  caption?: string | null;
  source: PhotoSource;
  attribution?: string | null;
  order: number;
  resolvedUrl: string;
}

export interface Landmark {
  id: string;
  name: string;
  description: string;
  category: LandmarkCategory;
  lat: number;
  lng: number;
  address?: string;
  googlePlaceId?: string | null;
  tags: string[];
  photos: LandmarkPhoto[];
  status?: "draft" | "approved" | "rejected";
  rejectionReason?: string;
}
