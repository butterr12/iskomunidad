export type LandmarkCategory = "attraction" | "community" | "event";

export interface LandmarkPin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: LandmarkCategory;
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
