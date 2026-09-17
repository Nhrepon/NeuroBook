/**
 * The pure-JS accounting engine — double-entry validation, reversal and every
 * financial report. Imported by the Next.js app, the Expo app (for preview
 * arithmetic) and by tests. It touches no database, which is what makes it
 * portable and fast to test.
 */
export * from "./errors.js";
export * from "./post.js";
export * from "./reports.js";
