import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { db } from "../src/lib/db";
import { matchPromptPool } from "../src/lib/schema";

const PROMPTS = [
  // Vulnerability
  { category: "vulnerability", promptText: "My biggest red flag:", sortOrder: 0 },
  { category: "vulnerability", promptText: "Something I pretend to understand:", sortOrder: 1 },
  { category: "vulnerability", promptText: "I'm weirdly insecure about:", sortOrder: 2 },
  { category: "vulnerability", promptText: "The last thing that made me cry:", sortOrder: 3 },
  { category: "vulnerability", promptText: "My most unhinged 3am thought:", sortOrder: 4 },

  // Taste
  { category: "taste", promptText: "My Spotify wrapped top genre:", sortOrder: 0 },
  { category: "taste", promptText: "Comfort show I've rewatched 5+ times:", sortOrder: 1 },
  { category: "taste", promptText: "The hill I will die on:", sortOrder: 2 },
  { category: "taste", promptText: "My most controversial food take:", sortOrder: 3 },
  { category: "taste", promptText: "Album that changed my life:", sortOrder: 4 },

  // Campus
  { category: "campus", promptText: "My campus confession:", sortOrder: 0 },
  { category: "campus", promptText: "Best hidden spot on campus:", sortOrder: 1 },
  { category: "campus", promptText: "My 8am class survival strategy:", sortOrder: 2 },
  { category: "campus", promptText: "The org I secretly want to join:", sortOrder: 3 },
  { category: "campus", promptText: "Thing I'd change about our university:", sortOrder: 4 },

  // Flirty
  { category: "flirty", promptText: "The way to my heart is:", sortOrder: 0 },
  { category: "flirty", promptText: "My love language is:", sortOrder: 1 },
  { category: "flirty", promptText: "You'll win me over with:", sortOrder: 2 },
  { category: "flirty", promptText: "Ideal first date on campus:", sortOrder: 3 },
  { category: "flirty", promptText: "Current situationship with:", sortOrder: 4 },
];

async function main() {
  console.log("Seeding match prompt pool...");

  for (const prompt of PROMPTS) {
    await db
      .insert(matchPromptPool)
      .values(prompt)
      .onConflictDoNothing();
  }

  console.log(`Seeded ${PROMPTS.length} prompts.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
