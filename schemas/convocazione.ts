import { z } from 'zod';
import { branchTypeSchema, isoDateSchema, isoDateTimeSchema, isoLocalDateTimeSchema } from './common';

export const convocazioneSchema = z
  .object({
    id: z.string(),
    branchType: branchTypeSchema,
    yearStart: z.number().int(),
    numeroConvocazione: z.number().int(),
    dataConvocazione: isoDateSchema,
    dataOraApertura: isoLocalDateTimeSchema,
    luogo: z.string(),
    ordineDelGiorno: z.string(),
    note: z.string(),
    formatoGrafico: z.enum(['standard', 'alternativo']),
    bloccata: z.boolean(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .passthrough();

export const convocazioneDataSchema = convocazioneSchema.extend({ id: z.string().optional() }).passthrough();
