export type LandmarkCategory = "attraction" | "community" | "event";

export interface Landmark {
  id: string;
  name: string;
  description: string;
  category: LandmarkCategory;
  lat: number;
  lng: number;
  address?: string;
  tags: string[];
  status?: "draft" | "approved" | "rejected";
  rejectionReason?: string;
}
