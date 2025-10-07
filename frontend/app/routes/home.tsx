import type { Route } from "./+types/home";
import { HomePage } from "~/pages/home-page";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Shortener" },
    { name: "description", content: "Share links" },
  ];
}

export default function Home() {
  return <HomePage />;
}
