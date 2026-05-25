// Pragmatic email validator — not a full RFC 5322 implementation, which is
// neither feasible nor desirable in a regex. We enforce the rules that catch
// the >99% of real-world typos and DoS-vector inputs.

// RFC 5321 caps a full address at 254 chars (envelope length). We allow a bit
// of slack for path / display rendering elsewhere in the system.
const MAX_LENGTH = 254;

// Shape: <local>@<domain>.<tld>
//   local:  one or more chars that aren't whitespace, @, or comma
//   domain: same charset
//   tld:    at least 2 alphabetic chars
const BASIC_SHAPE = /^[^\s@,]+@[^\s@,]+\.[A-Za-z]{2,}$/;

// Disallow doubled dots anywhere ("a..b@x.com", "alice@foo..bar"). RFC permits
// them inside quoted local parts, but quoted locals are exotic enough that
// rejecting them is the right call for a product email field.
const CONSECUTIVE_DOTS = /\.\./;

export function validateEmail(input: string): boolean {
  if (typeof input !== 'string') return false;
  if (input.length === 0 || input.length > MAX_LENGTH) return false;

  // Length-of-trimmed differs from input length => leading/trailing whitespace.
  if (input.trim().length !== input.length) return false;
  if (input.trim().length === 0) return false;

  if (CONSECUTIVE_DOTS.test(input)) return false;

  return BASIC_SHAPE.test(input);
}
