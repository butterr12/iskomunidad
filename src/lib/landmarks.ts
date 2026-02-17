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

export const landmarks: Landmark[] = [
  // Attractions
  {
    id: "a1",
    name: "Central Park",
    description: "Iconic urban park spanning 843 acres in the heart of Manhattan.",
    category: "attraction",
    lat: 40.7829,
    lng: -73.9654,
    address: "New York, NY 10024",
  },
  {
    id: "a2",
    name: "Statue of Liberty",
    description: "Colossal neoclassical sculpture on Liberty Island in New York Harbor.",
    category: "attraction",
    lat: 40.6892,
    lng: -74.0445,
    address: "Liberty Island, New York, NY 10004",
  },
  {
    id: "a3",
    name: "Empire State Building",
    description: "Art Deco skyscraper with observation decks offering stunning city views.",
    category: "attraction",
    lat: 40.7484,
    lng: -73.9857,
    address: "20 W 34th St, New York, NY 10001",
  },
  {
    id: "a4",
    name: "Brooklyn Bridge",
    description: "Historic hybrid cable-stayed suspension bridge connecting Manhattan and Brooklyn.",
    category: "attraction",
    lat: 40.7061,
    lng: -73.9969,
    address: "Brooklyn Bridge, New York, NY 10038",
  },
  {
    id: "a5",
    name: "Times Square",
    description: "Bustling commercial and entertainment hub known for bright lights and Broadway.",
    category: "attraction",
    lat: 40.758,
    lng: -73.9855,
    address: "Manhattan, NY 10036",
  },

  // Community
  {
    id: "c1",
    name: "NYC Community Garden",
    description: "A volunteer-run green space open to all neighborhood residents.",
    category: "community",
    lat: 40.7225,
    lng: -73.9876,
    address: "East Village, New York, NY",
  },
  {
    id: "c2",
    name: "Public Library - Main Branch",
    description: "Free programs, workshops, and resources for the community.",
    category: "community",
    lat: 40.7532,
    lng: -73.9822,
    address: "476 5th Ave, New York, NY 10018",
  },
  {
    id: "c3",
    name: "Chelsea Market",
    description: "Food hall and shopping mall, a beloved community gathering spot.",
    category: "community",
    lat: 40.7424,
    lng: -74.0061,
    address: "75 9th Ave, New York, NY 10011",
  },
  {
    id: "c4",
    name: "The High Line",
    description: "Elevated linear park built on a historic freight rail line.",
    category: "community",
    lat: 40.748,
    lng: -74.0048,
    address: "New York, NY 10011",
  },

  // Events
  {
    id: "e1",
    name: "SummerStage Concert",
    description: "Free outdoor performing arts festival in Central Park.",
    category: "event",
    lat: 40.7705,
    lng: -73.9747,
    address: "Rumsey Playfield, Central Park",
  },
  {
    id: "e2",
    name: "Brooklyn Night Bazaar",
    description: "Weekend night market with food vendors, live music, and art.",
    category: "event",
    lat: 40.7145,
    lng: -73.9613,
    address: "165 Banker St, Brooklyn, NY 11222",
  },
  {
    id: "e3",
    name: "Governors Island Art Fair",
    description: "Annual art exhibition and festival on Governors Island.",
    category: "event",
    lat: 40.6895,
    lng: -74.0168,
    address: "Governors Island, New York, NY",
  },
  {
    id: "e4",
    name: "NYC Marathon Finish Line",
    description: "The iconic finish line of the annual New York City Marathon.",
    category: "event",
    lat: 40.7719,
    lng: -73.9743,
    address: "Central Park, New York, NY",
  },
];
