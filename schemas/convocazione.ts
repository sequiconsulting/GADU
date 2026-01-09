import { z } from 'zod';
import { branchTypeSchema, isoDateSchema, isoDateTimeSchema, isoLocalDateTimeSchema } from './common';

const permissiveIsoDateStringSchema = z.preprocess(val => {
  if (val === null || val === undefined) return '';
  if (typeof val !== 'string') return val;
  const s = val.trim();
  if (s === '') return '';
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  return s;
}, z.union([isoDateSchema, z.literal('')]));

const permissiveIsoLocalDateTimeStringSchema = z.preprocess(val => {
  if (val === null || val === undefined) return '';
  if (typeof val !== 'string') return val;
  const s = val.trim();
  if (s === '') return '';
  // Accetta anche ISO datetime (es. 2026-01-09T12:34:56Z) normalizzando a YYYY-MM-DDTHH:mm
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return s.slice(0, 16);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 16);
  return s;
}, z.union([isoLocalDateTimeSchema, z.literal('')]));

export const convocazioneSchema = z
  .object({
    id: z.string(),
    branchType: branchTypeSchema,
    yearStart: z.number().int(),
    numeroConvocazione: z.number().int(),
    dataConvocazione: permissiveIsoDateStringSchema,
    dataOraApertura: permissiveIsoLocalDateTimeStringSchema,
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
