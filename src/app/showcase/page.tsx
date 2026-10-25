import type { Metadata } from "next";
import ShowcasePreview from "./showcase-preview";

export const metadata: Metadata = {
  title: "Căn hộ phát triển — LIFE//LEVEL",
  description: "Bản trưng bày độc lập về nội thất của căn hộ 120 m².",
};

export default function ShowcasePage() {
  return <ShowcasePreview />;
}
