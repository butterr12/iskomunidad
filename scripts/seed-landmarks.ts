import { config } from "dotenv";
import path from "path";
import { Pool } from "pg";

config({ path: path.resolve(__dirname, "../.env.local") });

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!GOOGLE_API_KEY) {
  console.error("GOOGLE_PLACES_API_KEY is required");
  process.exit(1);
}
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

// UP Diliman center
const LAT = 14.6538;
const LNG = 121.0685;
const RADIUS = 1500;

const SEARCH_TYPES = [
  "university",
  "library",
  "museum",
  "park",
  "church",
  "restaurant",
  "cafe",
  "tourist_attraction",
];

const TYPE_TO_TAGS: Record<string, string[]> = {
  university: ["education", "campus"],
  library: ["education", "study"],
  museum: ["culture", "history"],
  park: ["nature", "recreation"],
  church: ["worship", "heritage"],
  restaurant: ["food", "dining"],
  cafe: ["food", "coffee"],
  tourist_attraction: ["tourism", "landmark"],
};

interface PlaceResult {
  place_id: string;
  name: string;
  vicinity: string;
  geometry: { location: { lat: number; lng: number } };
  types: string[];
  rating?: number;
  user_ratings_total?: number;
  photos?: Array<{
    photo_reference: string;
    html_attributions: string[];
  }>;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildTags(types: string[]): string[] {
  const tags = new Set<string>();
  for (const t of types) {
    const mapped = TYPE_TO_TAGS[t];
    if (mapped) mapped.forEach((tag) => tags.add(tag));
  }
  if (tags.size === 0) tags.add("place");
  return [...tags];
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

async function fetchNearbyPlaces(type: string): Promise<PlaceResult[]> {
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${LAT},${LNG}&radius=${RADIUS}&type=${type}&key=${GOOGLE_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    console.warn(`  Warning: API returned ${data.status} for type "${type}"`);
    return [];
  }

  return data.results ?? [];
}

async function main() {
  console.log("Seeding landmarks from Google Places...\n");

  const allPlaces = new Map<string, PlaceResult>();

  for (const type of SEARCH_TYPES) {
    console.log(`Searching type: ${type}...`);
    const results = await fetchNearbyPlaces(type);
    console.log(`  Found ${results.length} results`);

    for (const place of results) {
      if (!allPlaces.has(place.place_id)) {
        allPlaces.set(place.place_id, place);
      }
    }

    await sleep(300);
  }

  console.log(`\nTotal unique places: ${allPlaces.size}\n`);

  let landmarkCount = 0;
  let photoCount = 0;

  for (const place of allPlaces.values()) {
    const tags = buildTags(place.types);
    const description = `${place.name} - ${place.vicinity}`;

    // Insert landmark
    const result = await pool.query(
      `INSERT INTO landmark (name, description, category, lat, lng, address, google_place_id, tags, avg_rating, review_count, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        place.name,
        description,
        "attraction",
        place.geometry.location.lat,
        place.geometry.location.lng,
        place.vicinity,
        place.place_id,
        tags,
        place.rating ?? 0,
        place.user_ratings_total ?? 0,
        "approved",
      ],
    );

    const landmarkId = result.rows[0].id;
    landmarkCount++;

    // Insert photos (up to 3)
    const photos = (place.photos ?? []).slice(0, 3);
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const attribution = photo.html_attributions
        .map(stripHtml)
        .filter(Boolean)
        .join(", ");

      await pool.query(
        `INSERT INTO landmark_photo (landmark_id, url, source, attribution, "order")
         VALUES ($1, $2, $3, $4, $5)`,
        [landmarkId, photo.photo_reference, "google_places", attribution, i],
      );
      photoCount++;
    }

    process.stdout.write(`  Inserted: ${place.name}\n`);
  }

  console.log(`\nDone! Inserted ${landmarkCount} landmarks with ${photoCount} photos.`);
  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
