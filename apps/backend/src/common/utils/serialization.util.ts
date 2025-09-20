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
  return transformBigIntForSerializationExcluding(obj, new Set());
}

/**
 * Transform BigInt values to strings for JSON serialization, excluding specific fields.
 * Recursively processes objects and arrays to handle nested BigInt values.
 *
 * @param obj The object to transform
 * @param excludeFields Set of field names to exclude from transformation
 * @returns The object with BigInt values converted to strings
 */
export function transformBigIntForSerializationExcluding<T>(obj: T, excludeFields: Set<string>): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle BigInt directly
  if (typeof obj === 'bigint') {
    return String(obj) as unknown as T;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => transformBigIntForSerializationExcluding(item, excludeFields)) as unknown as T;
  }

  // Handle objects
  if (typeof obj === 'object') {
    const transformed: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (excludeFields.has(key)) {
        // Skip transformation for excluded fields
        transformed[key] = value;
      } else {
        transformed[key] = transformBigIntForSerializationExcluding(value, excludeFields);
      }
    }

    return transformed as T;
  }

  // Return primitive values as-is
  return obj;
}

/**
 * Transform Prisma item results to ensure BigInt fields are serializable.
 * Specifically handles the runTimeTicks field and any other BigInt fields.
 * Also parses JSON string fields back to arrays.
 *
 * @param item The Prisma item result
 * @returns The item with BigInt values converted to strings and JSON fields parsed
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

  // Parse JSON string fields back to arrays
  const jsonFields = ['genres', 'tags', 'studios'];
  for (const field of jsonFields) {
    if (transformed[field] && typeof transformed[field] === 'string') {
      try {
        transformed[field] = JSON.parse(transformed[field]);
      } catch (error) {
        // If parsing fails, ensure it's at least an empty array
        transformed[field] = [];
      }
    } else if (!transformed[field]) {
      // Ensure field exists as empty array if null/undefined
      transformed[field] = [];
    }
  }

  // Parse providerIds JSON string back to object
  if (transformed.providerIds && typeof transformed.providerIds === 'string') {
    try {
      transformed.providerIds = JSON.parse(transformed.providerIds);
    } catch (error) {
      // If parsing fails, ensure it's at least an empty object
      transformed.providerIds = {};
    }
  } else if (!transformed.providerIds) {
    // Ensure field exists as empty object if null/undefined
    transformed.providerIds = {};
  }

  // Convert timestamps back to Date strings for date fields
  const dateFields = ['lastSyncAt', 'createdAt', 'updatedAt', 'dateCreated', 'dateModified', 'premiereDate', 'endDate'];
  for (const field of dateFields) {
    if (transformed[field] !== null && transformed[field] !== undefined) {
      if (typeof transformed[field] === 'bigint') {
        // Convert BigInt timestamp to ISO string
        transformed[field] = new Date(Number(transformed[field])).toISOString();
      } else if (typeof transformed[field] === 'number') {
        // Convert number timestamp to ISO string
        transformed[field] = new Date(transformed[field]).toISOString();
      } else if (transformed[field] instanceof Date) {
        // Convert Date to ISO string
        transformed[field] = transformed[field].toISOString();
      }
    }
  }

  // Apply general BigInt transformation to catch any other BigInt fields
  // but exclude date fields that we've already converted
  const excludeFields = new Set(['lastSyncAt', 'createdAt', 'updatedAt', 'dateCreated', 'dateModified', 'premiereDate', 'endDate']);
  return transformBigIntForSerializationExcluding(transformed, excludeFields);
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