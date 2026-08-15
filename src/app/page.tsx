import { redirect } from "next/navigation";

// The root has no content of its own yet — send visitors to the demo wedding.
export default function Home() {
  redirect("/w/ananya-weds-arjun");
}
