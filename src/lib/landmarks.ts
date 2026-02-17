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
}

export const landmarks: Landmark[] = [
  {
    id: "oblation",
    name: "The Oblation",
    description:
      "The iconic symbol of the University of the Philippines — a nude male figure with arms outstretched. It represents the selfless offering of oneself to the nation.",
    category: "attraction",
    lat: 14.6537,
    lng: 121.0691,
    address: "University Avenue, UP Diliman, Quezon City",
    tags: ["landmark", "historical", "iconic"],
  },
  {
    id: "sunken-garden",
    name: "Sunken Garden",
    description:
      "A large oval-shaped field sunken below road level, used for university events, concerts, and sports. It is the heart of campus life at UP Diliman.",
    category: "attraction",
    lat: 14.6544,
    lng: 121.0688,
    address: "Roxas Avenue, UP Diliman, Quezon City",
    tags: ["park", "events", "sports"],
  },
  {
    id: "vargas-museum",
    name: "Jorge B. Vargas Museum",
    description:
      "A fine arts museum housing an extensive collection of Philippine art, including paintings, sculptures, and historical artifacts from the pre-colonial to modern era.",
    category: "attraction",
    lat: 14.6536,
    lng: 121.0649,
    address: "Roxas Avenue, UP Diliman, Quezon City",
    tags: ["museum", "art", "culture"],
  },
  {
    id: "main-library",
    name: "UP Main Library",
    description:
      "The Gonzalez Hall houses the university's main library and serves as the central hub for academic resources. Its brutalist architecture is a campus landmark.",
    category: "attraction",
    lat: 14.6543,
    lng: 121.0711,
    address: "Gonzalez Hall, UP Diliman, Quezon City",
    tags: ["library", "academic", "architecture"],
  },
  {
    id: "carillon",
    name: "The Carillon",
    description:
      "A 36-bell carillon tower that chimes the university hymn. It stands as a memorial and cultural symbol, located at the eastern end of the Academic Oval.",
    category: "attraction",
    lat: 14.6567,
    lng: 121.0714,
    address: "Carillon Plaza, UP Diliman, Quezon City",
    tags: ["landmark", "historical", "memorial"],
  },
  {
    id: "quezon-hall",
    name: "Quezon Hall",
    description:
      "The administration building of UP Diliman featuring a distinct modernist facade. It houses the Office of the Chancellor and other key university offices.",
    category: "attraction",
    lat: 14.6533,
    lng: 121.0735,
    address: "University Avenue, UP Diliman, Quezon City",
    tags: ["architecture", "administrative", "historical"],
  },
  {
    id: "up-theater",
    name: "UP Film Institute Theater",
    description:
      "Home to the UP Film Institute, this venue hosts regular screenings, film festivals, and cultural performances. A center for Philippine cinema and media arts.",
    category: "attraction",
    lat: 14.6572,
    lng: 121.0665,
    address: "Magsaysay Avenue, UP Diliman, Quezon City",
    tags: ["cinema", "culture", "arts"],
  },
  {
    id: "lagoon",
    name: "UP Lagoon",
    description:
      "A scenic man-made lagoon near the College of Fine Arts. A popular spot for relaxation and photography, surrounded by mature trees and walking paths.",
    category: "attraction",
    lat: 14.6527,
    lng: 121.0660,
    address: "Roces Avenue, UP Diliman, Quezon City",
    tags: ["nature", "park", "scenic"],
  },
  {
    id: "as-steps",
    name: "AS Steps",
    description:
      "The amphitheater-style steps of Palma Hall (College of Arts and Sciences). A historic gathering place for student assemblies, protests, and open forums.",
    category: "attraction",
    lat: 14.6553,
    lng: 121.0697,
    address: "Palma Hall, UP Diliman, Quezon City",
    tags: ["landmark", "historical", "student life"],
  },
];
