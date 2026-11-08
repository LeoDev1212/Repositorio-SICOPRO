import { redirect } from "next/navigation";

// middleware.ts already redirects "/" based on session state; this is a
// defensive fallback in case that matcher config ever changes.
export default function RootPage() {
  redirect("/login");
}
