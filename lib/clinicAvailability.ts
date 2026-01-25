import { z } from "zod";

export const ClinicAvailabilitySchema = z.object({
  nextAvailable: z.string().nullable(),
  appointmentRequired: z.boolean(),
  walkInAllowed: z.boolean(),
  notes: z.string().optional()
});

export type ClinicAvailability = z.infer<typeof ClinicAvailabilitySchema>;