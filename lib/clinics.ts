import { z } from "zod";

export const ClinicSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  address: z.string(),
  lat: z.number(),
  lng: z.number(),
  distanceKm: z.number(),
  openNow: z.boolean().nullable(),
  hoursText: z.array(z.string()).optional()
});

export type Clinic = z.infer<typeof ClinicSchema>;