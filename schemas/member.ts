import { z } from 'zod';
import {
  isoDateSchema,
  branchTypeSchema,
  statusTypeSchema,
  isoDateTimeSchema,
  isoLocalDateTimeSchema,
} from './common';

const trimmedString = z.string().transform(v => v.trim());

// Attenzione: .nullish() rende la proprietà opzionale nell'inferenza TypeScript.
// Usiamo una union per accettare null/undefined ma mantenere la chiave richiesta.
const requiredTrimmedString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform(v => (typeof v === 'string' ? v.trim() : ''));

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
    date: isoDateSchema,
    status: statusTypeSchema,
    reason: z.string().optional(),
    note: z.string().optional(),
    lodge: z.string().optional(),
  })
  .passthrough();

const degreeEventSchema = z
  .object({
    degreeName: z.string(),
    date: isoDateSchema,
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
    startDate: isoDateSchema.optional(),
    endDate: isoDateSchema.optional(),
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
    initiationDate: isoDateSchema.optional(),
    degrees: z.array(degreeEventSchema),
    roles: z.array(officerRoleSchema),
  })
  .passthrough();

export const memberDataSchema = z
  .object({
    matricula: requiredTrimmedString,
    firstName: requiredTrimmedString,
    lastName: requiredTrimmedString,
    email: requiredTrimmedString,
    phone: requiredTrimmedString,
    city: requiredTrimmedString,

    craft: masonicBranchDataSchema,
    mark: masonicBranchDataSchema,
    chapter: masonicBranchDataSchema,
    ram: masonicBranchDataSchema,

    lastModified: z.union([isoDateTimeSchema, z.string()]).optional(),
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
