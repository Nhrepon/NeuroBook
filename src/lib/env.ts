// Validated env at boot. O5.
import { parseServerEnv } from '@neurobook/shared/env'

export const env = parseServerEnv(process.env)
