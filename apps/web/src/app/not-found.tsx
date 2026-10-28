import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-2">Page not found</h1>
      <p className="mb-4">The page you are looking for does not exist.</p>
      <Link href="/" className="text-blue-600 hover:underline">Go home</Link>
    </main>
  )
}
