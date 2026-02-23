import React from "react";
import ReviewSessionPage from "../(auth)/review.js";

// The (index) route group renders outside the (auth) layout on web.
// Auth context is now provided by the root _layout.tsx.
export default function IndexWeb() {
  return <ReviewSessionPage />;
}
