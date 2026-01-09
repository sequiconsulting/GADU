import { z } from 'zod';
import { userPrivilegeSchema } from './common';

export const createLodgeRequestSchema = z
  .object({
    glriNumber: z.string().trim().min(1),
    lodgeName: z.string().trim().min(1),
    province: z.string().trim().min(1),

    supabaseUrl: z
      .string()
      .trim()
      .regex(/^https:\/\/.+\.supabase\.co$/, 'Supabase URL non valido'),
    supabaseAnonKey: z.string().trim().min(1),
    supabaseServiceKey: z.string().trim().min(1),
    databasePassword: z.string().min(1),

    secretaryEmail: z.string().trim().email('Email Segretario non valida'),

    associationName: z.string().optional(),
    address: z.string().optional(),
    zipCode: z.string().optional(),
    city: z.string().optional(),
    taxCode: z.string().optional(),
  })
  .passthrough();

const metadataSchema = z.record(z.string(), z.unknown()).optional();

export const manageUsersGetQuerySchema = z.object({
  lodge: z.string().min(1),
});

export const manageUsersPostBodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    lodgeNumber: z.string().min(1),
    email: z.string().trim().email(),
    password: z.string().min(6),
    name: z.string().optional(),
    privileges: z.array(userPrivilegeSchema).optional(),
    metadata: metadataSchema,
  }),
  z.object({
    action: z.literal('delete'),
    lodgeNumber: z.string().min(1),
    email: z.string().trim().email(),
  }),
  z.object({
    action: z.literal('updatePassword'),
    lodgeNumber: z.string().min(1),
    userId: z.string().min(1),
    password: z.string().min(6),
    email: z.string().trim().email().optional(),
  }),
  z.object({
    action: z.literal('updatePrivileges'),
    lodgeNumber: z.string().min(1),
    userId: z.string().min(1),
    privileges: z.array(userPrivilegeSchema).default([]),
    name: z.string().optional(),
    email: z.string().trim().email().optional(),
  }),
  z.object({
    action: z.literal('clearMustChangePassword'),
    lodgeNumber: z.string().min(1),
    userId: z.string().min(1),
  }),
]);
