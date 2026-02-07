/**
 * Shared in-memory transcription store
 * Used by both transcription-callback (writes) and get-transcript (reads)
 * 
 * NOTE: In serverless environments like Vercel, this won't persist across
 * function invocations. For production, consider using Redis or a database.
 */
export const transcriptionStore = new Map<string, {
  text: string;
  timestamp: string;
  recordingSid: string;
}>();
