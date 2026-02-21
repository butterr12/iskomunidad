"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function GoBackButton() {
  const router = useRouter();
  return (
    <Button
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push("/");
        }
      }}
    >
      Go Back
    </Button>
  );
}
