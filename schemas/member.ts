import { z } from 'zod';
import {
  isoDateSchema,
  branchTypeSchema,
  statusTypeSchema,
  isoDateTimeSchema,
  isoLocalDateTimeSchema,
} from './common';

const trimmedString = z.string().transform(v => v.trim());

// Date opzionale: permette ''/null/undefined e normalizza ISO datetime a YYYY-MM-DD
const optionalIsoDateSchema = z.preprocess(val => {
  if (val === null || val === undefined) return undefined;
  if (typeof val !== 'string') return val;
  const s = val.trim();
  if (s === '') return undefined;
  // Accetta anche ISO datetime (es. 2026-01-09T12:34:56Z) normalizzando
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  return s;
}, isoDateSchema.optional());

// Date permissiva (sempre stringa): permette ''/null/undefined e normalizza ISO datetime a YYYY-MM-DD
const permissiveIsoDateStringSchema = z.preprocess(val => {
  if (val === null || val === undefined) return '';
  if (typeof val !== 'string') return val;
  const s = val.trim();
  if (s === '') return '';
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  return s;
}, z.union([isoDateSchema, z.literal('')]));

const changeLogEntrySchema = z
  .object({
    timestamp: isoDateTimeSchema,
    action: z.string(),
    user: z.string().optional(),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const statusEventSchema = z
  .object({
    date: permissiveIsoDateStringSchema,
    status: statusTypeSchema,
    reason: z.string().optional(),
    note: z.string().optional(),
    lodge: z.string().optional(),
  })
  .passthrough();

const degreeEventSchema = z
  .object({
    degreeName: z.string(),
    date: optionalIsoDateSchema,
    meetingNumber: z.string(),
    location: z.string().optional(),
  })
  .passthrough();

const officerRoleSchema = z
  .object({
    id: z.string(),
    yearStart: z.number().int(),
    roleName: z.string(),
    branch: branchTypeSchema,
    startDate: optionalIsoDateSchema,
    endDate: optionalIsoDateSchema,
    installationMeeting: z.string().optional(),
  })
  .passthrough();

const capitazioneEventSchema = z
  .object({
    year: z.number().int(),
    tipo: z.string(),
  })
  .passthrough();

const titoloEventSchema = z
  .object({
    year: z.number().int(),
    titolo: z.string(),
  })
  .passthrough();

const masonicBranchDataSchema = z
  .object({
    statusEvents: z.array(statusEventSchema),
    capitazioni: z.array(capitazioneEventSchema).optional(),
    titoli: z.array(titoloEventSchema).optional(),
    isMotherLodgeMember: z.boolean().optional(),
    otherLodgeName: z.string().nullable().optional(),
    isFounder: z.boolean().optional(),
    isHonorary: z.boolean().optional(),
    isDualAppartenance: z.boolean().optional(),
    initiationDate: optionalIsoDateSchema,
    degrees: z.array(degreeEventSchema),
    roles: z.array(officerRoleSchema),
  })
  .passthrough();

export const memberDataSchema = z
  .object({
    matricula: trimmedString,
    firstName: trimmedString,
    lastName: trimmedString,
    email: trimmedString,
    phone: trimmedString,
    city: trimmedString,

    craft: masonicBranchDataSchema,
    mark: masonicBranchDataSchema,
    arch: masonicBranchDataSchema,
    ram: masonicBranchDataSchema,

    lastModified: isoDateTimeSchema.optional(),
    changelog: z.array(changeLogEntrySchema).optional(),
  })
  .passthrough();

export const memberSchema = memberDataSchema
  .extend({ id: z.string() })
  .passthrough();

// Exported only to keep bundlers from tree-shaking unused imports in some edge cases
export const _internalSchemas = {
  isoLocalDateTimeSchema,
};
