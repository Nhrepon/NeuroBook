'use client'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold text-red-600 mb-2">Something went wrong</h1>
      <p className="mb-4 text-gray-600">{error.message}</p>
      <button onClick={reset} className="px-4 py-2 bg-blue-600 text-white rounded">Try again</button>
    </main>
  )
}
