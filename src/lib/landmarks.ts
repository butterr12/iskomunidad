export type LandmarkCategory = "attraction" | "community" | "event";

export interface Landmark {
  id: string;
  name: string;
  description: string;
  category: LandmarkCategory;
  lat: number;
  lng: number;
  address?: string;
}

export const landmarks: Landmark[] = [];
