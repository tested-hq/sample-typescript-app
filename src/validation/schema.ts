// User payload validation built on zod's discriminated unions. A real app would
// likely co-locate these schemas with the route handlers; here we keep them
// next to the email validator so the `validation/` namespace is a single
// landing pad. Intentionally uncovered — this is a `tested diff` target.

import { z } from 'zod';

export class PayloadValidationError extends Error {
  public readonly issues: z.core.$ZodIssue[];

  constructor(message: string, issues: z.core.$ZodIssue[]) {
    super(message);
    this.name = 'PayloadValidationError';
    this.issues = issues;
  }
}

// Two flavors of user creation, distinguished by `kind`:
//   - "human"   needs a real email + display name
//   - "service" needs an owning team + a long-lived API key label
const HumanUserSchema = z.object({
  kind: z.literal('human'),
  email: z.string().min(1),
  displayName: z.string().min(1).max(100),
});

const ServiceUserSchema = z.object({
  kind: z.literal('service'),
  team: z.string().min(1),
  apiKeyLabel: z.string().min(1).max(60),
});

const CreateUserPayloadSchema = z.discriminatedUnion('kind', [
  HumanUserSchema,
  ServiceUserSchema,
]);

export type CreateUserPayload = z.infer<typeof CreateUserPayloadSchema>;

export function validateUserPayload(input: unknown): CreateUserPayload {
  const parsed = CreateUserPayloadSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const summary = first ? `${first.path.join('.')}: ${first.message}` : 'invalid payload';
    throw new PayloadValidationError(summary, parsed.error.issues);
  }
  return parsed.data;
}
