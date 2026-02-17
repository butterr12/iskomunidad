import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: ["./src/lib/auth-schema.ts", "./src/lib/schema.ts"],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
