export type LandmarkCategory = "attraction" | "community" | "event";

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
