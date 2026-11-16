import type { Metadata } from "next";
import { Showcase } from "./showcase";

export const metadata: Metadata = { title: "Design-System" };

export default function DesignPage() {
  return <Showcase />;
}
