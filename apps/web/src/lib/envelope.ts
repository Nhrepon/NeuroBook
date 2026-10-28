export function ok(data: any, status = 200) {
  return Response.json({ data }, { status })
}
export function err(error: { code: string; message: string }, status = 400) {
  return Response.json({ error }, { status })
}
