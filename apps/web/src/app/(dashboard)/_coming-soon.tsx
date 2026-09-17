import Link from "next/link";

/**
 * Placeholder routes for the nav targets. Each becomes a real page as its
 * module lands; until then the shell is navigable rather than 404.
 */
export default function ComingSoon({ title }: { title: string }) {
  return (
    <div>
      <h1>{title}</h1>
      <p style={{ opacity: 0.7 }}>Not built yet.</p>
      <Link href="/dashboard">Back to dashboard</Link>
    </div>
  );
}
