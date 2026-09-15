"use client";

import { type ReactNode } from "react";

export function OptionalPrivyProvider({ children }: { children: ReactNode }) {
  return children;
}

export function privyConfigured() {
  return false;
}
