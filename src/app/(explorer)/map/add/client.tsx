"use client";

import { CreatePageHeader } from "@/components/shared/create-page-header";
import { AddLocationForm } from "@/components/map/add-location-form";
import { useFocusedPage } from "@/hooks/use-focused-page";

export function AddLocationClient() {
  useFocusedPage();

  return (
    <div className="flex flex-1 flex-col min-h-0 pt-12 sm:pt-14">
      <CreatePageHeader title="Add Location" fallbackHref="/map" />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <AddLocationForm />
        </div>
      </div>
    </div>
  );
}
