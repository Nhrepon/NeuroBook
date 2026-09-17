import { redirect } from "next/navigation";

/**
 * The root renders nothing of its own: a signed-in user goes to the dashboard,
 * everyone else to login. Keeping the decision in one place means no route can
 * be reached by a user who should not see it.
 */
export default function Home() {
  redirect("/dashboard");
}
