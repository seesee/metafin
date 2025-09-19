/**
 * Utility functions for handling JSON serialization of complex types.
 */

/**
 * Transform BigInt values to strings for JSON serialization.
 * Recursively processes objects and arrays to handle nested BigInt values.
 *
 * @param obj The object to transform
 * @returns The object with BigInt values converted to strings
 */
export function transformBigIntForSerialization<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle BigInt directly
  if (typeof obj === 'bigint') {
    return String(obj) as unknown as T;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => transformBigIntForSerialization(item)) as unknown as T;
  }

  // Handle objects
  if (typeof obj === 'object') {
    const transformed: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      transformed[key] = transformBigIntForSerialization(value);
    }

    return transformed as T;
  }

  // Return primitive values as-is
  return obj;
}

/**
 * Transform Prisma item results to ensure BigInt fields are serializable.
 * Specifically handles the runTimeTicks field and any other BigInt fields.
 *
 * @param item The Prisma item result
 * @returns The item with BigInt values converted to strings
 */
export function transformItemForSerialization(item: any): any {
  if (!item) {
    return item;
  }

  const transformed = { ...item };

  // Convert runTimeTicks specifically since it's the known BigInt field
  if (transformed.runTimeTicks !== null && transformed.runTimeTicks !== undefined) {
    transformed.runTimeTicks = String(transformed.runTimeTicks);
  }

  // Apply general BigInt transformation to catch any other BigInt fields
  return transformBigIntForSerialization(transformed);
}

/**
 * Transform an array of items for serialization.
 *
 * @param items Array of items to transform
 * @returns Array with all BigInt values converted to strings
 */
export function transformItemsForSerialization(items: any[]): any[] {
  return items.map(item => transformItemForSerialization(item));
}