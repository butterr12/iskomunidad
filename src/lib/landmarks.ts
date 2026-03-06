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

export interface PlaceCategory {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  order: number;
}

export type OperatingHours = Record<
  "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday",
  { open: string; close: string } | null
>;

export interface LandmarkReview {
  id: string;
  rating: number;
  body: string | null;
  createdAt: string;
  author: string | null;
  authorHandle: string | null;
  authorImage: string | null;
  userId: string;
}

export interface LandmarkPin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: LandmarkCategory;
  categorySlug?: string | null;
  categoryColor?: string | null;
  categoryIcon?: string | null;
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
  categoryId?: string | null;
  categorySlug?: string | null;
  categoryColor?: string | null;
  categoryIcon?: string | null;
  categoryName?: string | null;
  lat: number;
  lng: number;
  address?: string;
  googlePlaceId?: string | null;
  phone?: string | null;
  website?: string | null;
  operatingHours?: OperatingHours | null;
  tags: string[];
  photos: LandmarkPhoto[];
  avgRating?: number | null;
  reviewCount?: number | null;
  reviews?: LandmarkReview[];
  userId?: string | null;
  status?: "draft" | "approved" | "rejected";
  rejectionReason?: string;
}
