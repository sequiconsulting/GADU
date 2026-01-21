import { z } from 'zod';
import { isoDateSchema, isoDateTimeSchema } from './common';

export const fiscalEntryTypeSchema = z.enum(['ENTRATA', 'USCITA']);
export const fiscalSectionSchema = z.enum(['A', 'B', 'C', 'D', 'E']);

export const fiscalEntrySchema = z
  .object({
    id: z.string(),
    date: isoDateSchema,
    description: z.string(),
    amount: z.number(),
    type: fiscalEntryTypeSchema,
    section: fiscalSectionSchema,
    categoryId: z.string().optional(),
    categoryLabel: z.string(),
    notes: z.string().optional(),
    cashTransfer: z.enum(['OUT', 'IN']).optional(),
    linkedCashEntryId: z.string().optional(),
    linkedAccountEntryId: z.string().optional(),
  })
  .passthrough();

export const fiscalAccountSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    initialBalance: z.number(),
    entries: z.array(fiscalEntrySchema),
  })
  .passthrough();

export const fiscalCashSchema = z
  .object({
    initialBalance: z.number(),
    entries: z.array(fiscalEntrySchema),
  })
  .passthrough();

export const fiscalNotesSchema = z
  .object({
    secondarietaAttivitaDiverse: z.string().optional(),
    costiProventiFigurativi: z.string().optional(),
  })
  .passthrough();

export const rendicontoFiscaleSchema = z
  .object({
    year: z.number(),
    accounts: z.array(fiscalAccountSchema),
    cash: fiscalCashSchema,
    notes: fiscalNotesSchema.optional(),
    signatureName: z.string().optional(),
    updatedAt: isoDateTimeSchema.optional(),
  })
  .passthrough();
