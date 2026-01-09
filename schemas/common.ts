import { z } from 'zod';

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const isoDateTimeSchema = z.string().datetime({ offset: false }).or(z.string().datetime({ offset: true }));

// Formato usato in Convocazione.dataOraApertura: YYYY-MM-DDTHH:mm
export const isoLocalDateTimeSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

export const branchTypeSchema = z.enum(['CRAFT', 'MARK', 'CHAPTER', 'RAM']);
export const statusTypeSchema = z.enum(['ACTIVE', 'INACTIVE']);

export const userPrivilegeSchema = z.enum(['AD', 'CR', 'MR', 'AR', 'RR', 'CW', 'MW', 'AW', 'RW']);

export function formatZodError(err: z.ZodError): string {
  return err.issues
    .map(issue => {
      const path = issue.path.length ? issue.path.join('.') : '(root)';
      return `${path}: ${issue.message}`;
    })
    .join('\n');
}

export function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown, context: string): T {
  const res = schema.safeParse(input);
  if (!res.success) {
    const details = formatZodError(res.error);
    const e: any = new Error(`${context}: dati non validi\n${details}`);
    e.zod = res.error;
    throw e;
  }
  return res.data;
}
