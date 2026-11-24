"use client";

import { useEffect } from "react";
import { seedDemoUser } from "@/lib/auth";

/** Seeds the demo account into localStorage on first load of any page. */
export function AuthBootstrap() {
  useEffect(() => {
    seedDemoUser();
  }, []);
  return null;
}
