import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const client = postgres(process.env.DATABASE_URL ?? 'postgres://neurobook:neurobook@localhost:5432/neurobook')
export const db = drizzle(client, { schema })
