// Unmatched-slot fallback. Nothing nested lives under the dashboard today, so
// this exists so that adding one later cannot turn a full page load into a 404.
export default function KpisDefault() {
  return null
}
