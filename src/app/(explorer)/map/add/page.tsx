import type { Metadata } from "next";
import { AddLocationClient } from "./client";

export const metadata: Metadata = {
  title: "Add Location",
  description: "Suggest a new place on the campus map.",
};

export default function AddLocationPage() {
  return <AddLocationClient />;
}
