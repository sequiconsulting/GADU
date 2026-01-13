import { z } from 'zod';
import { isoDateTimeSchema } from './common';

const yearlyRitualSchema = z.object({
  craft: z.enum(['Emulation', 'Scozzese']),
  markAndArch: z.enum(['Irlandese', 'Aldersgate']),
});

const userChangeLogEntrySchema = z
  .object({
    timestamp: isoDateTimeSchema,
    action: z.string(),
    userEmail: z.string().optional(),
    performedBy: z.string().optional(),
    details: z.string().optional(),
  })
  .passthrough();

const branchPreferencesSchema = z
  .object({
    città: z.string().optional(),
    indirizzo: z.string().optional(),
    motto: z.string().optional(),
    logoObbedienzaUrl: z.string().optional(),
    logoRegionaleUrl: z.string().optional(),
    logoLoggiaUrl: z.string().optional(),
    defaultQuote: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const appSettingsSchema = z
  .object({
    lodgeName: z.string(),
    lodgeNumber: z.string(),
    province: z.string(),

    associationName: z.string().optional(),
    address: z.string().optional(),
    zipCode: z.string().optional(),
    city: z.string().optional(),
    taxCode: z.string().optional(),

    yearlyRituals: z
      .record(
        z.string(),
        yearlyRitualSchema,
      )
      .optional(),

    userChangelog: z.array(userChangeLogEntrySchema).optional(),

    branchPreferences: z
      .record(z.enum(['CRAFT', 'MARK', 'ARCH', 'RAM']), branchPreferencesSchema)
      .optional(),
  })
  .passthrough();
