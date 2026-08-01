export class ApiContractError extends Error {
  constructor(path: string, expected: string, value: unknown) {
    super(`Invalid API response at ${path}: expected ${expected}, received ${describeValue(value)}`);
    this.name = 'ApiContractError';
  }
}

export function expectRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiContractError(path, 'an object', value);
  }
  return value as Record<string, unknown>;
}

export function expectArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new ApiContractError(path, 'an array', value);
  }
  return value;
}

export function expectString(value: unknown, path: string): string {
  if (typeof value !== 'string') {
    throw new ApiContractError(path, 'a string', value);
  }
  return value;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function expectUuid(value: unknown, path: string): string {
  const uuid = expectString(value, path);
  if (!isUuid(uuid)) {
    throw new ApiContractError(path, 'a UUID', value);
  }
  return uuid;
}

export function expectBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    throw new ApiContractError(path, 'a boolean', value);
  }
  return value;
}

export function expectNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ApiContractError(path, 'a finite number', value);
  }
  return value;
}

export function expectEnum<T extends string>(
  value: unknown,
  values: readonly T[],
  path: string,
): T {
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new ApiContractError(path, `one of ${values.join(', ')}`, value);
  }
  return value as T;
}

export function expectNullableString(value: unknown, path: string): string | null {
  return value === null || value === undefined ? null : expectString(value, path);
}

export function expectNullableNumber(value: unknown, path: string): number | null {
  return value === null || value === undefined ? null : expectNumber(value, path);
}

export function expectDate(value: unknown, path: string): Date {
  if (typeof value !== 'string' && !(value instanceof Date)) {
    throw new ApiContractError(path, 'an ISO date string', value);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiContractError(path, 'a valid date', value);
  }
  return date;
}

function describeValue(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  return typeof value;
}
