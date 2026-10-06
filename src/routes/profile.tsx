import { createFileRoute } from "@tanstack/react-router";
import { ProfilePage } from "@/components/tenderpro/pages";
export const Route = createFileRoute("/profile")({ component: ProfilePage });