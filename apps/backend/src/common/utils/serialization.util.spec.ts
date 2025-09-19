import {
  transformBigIntForSerialization,
  transformItemForSerialization,
  transformItemsForSerialization
} from './serialization.util';

describe('SerializationUtil', () => {
  describe('transformBigIntForSerialization', () => {
    it('should convert BigInt to string', () => {
      const bigIntValue = BigInt('9223372036854775807');
      const result = transformBigIntForSerialization(bigIntValue);
      expect(result).toBe('9223372036854775807');
      expect(typeof result).toBe('string');
    });

    it('should handle null and undefined values', () => {
      expect(transformBigIntForSerialization(null)).toBe(null);
      expect(transformBigIntForSerialization(undefined)).toBe(undefined);
    });

    it('should handle primitive values', () => {
      expect(transformBigIntForSerialization('string')).toBe('string');
      expect(transformBigIntForSerialization(123)).toBe(123);
      expect(transformBigIntForSerialization(true)).toBe(true);
    });

    it('should handle arrays with BigInt values', () => {
      const array = [BigInt('123'), 'string', 456, BigInt('789')];
      const result = transformBigIntForSerialization(array);
      expect(result).toEqual(['123', 'string', 456, '789']);
    });

    it('should handle objects with BigInt values', () => {
      const obj = {
        id: 'test',
        count: 42,
        runTimeTicks: BigInt('9223372036854775807'),
        nested: {
          bigInt: BigInt('123'),
          normal: 'value'
        }
      };
      const result = transformBigIntForSerialization(obj);
      expect(result).toEqual({
        id: 'test',
        count: 42,
        runTimeTicks: '9223372036854775807',
        nested: {
          bigInt: '123',
          normal: 'value'
        }
      });
    });
  });

  describe('transformItemForSerialization', () => {
    it('should transform item with runTimeTicks', () => {
      const item = {
        id: 'item-1',
        name: 'Test Item',
        runTimeTicks: BigInt('9223372036854775807'),
        year: 2023
      };
      const result = transformItemForSerialization(item);
      expect(result).toEqual({
        id: 'item-1',
        name: 'Test Item',
        runTimeTicks: '9223372036854775807',
        year: 2023
      });
    });

    it('should handle item with null runTimeTicks', () => {
      const item = {
        id: 'item-1',
        name: 'Test Item',
        runTimeTicks: null,
        year: 2023
      };
      const result = transformItemForSerialization(item);
      expect(result).toEqual({
        id: 'item-1',
        name: 'Test Item',
        runTimeTicks: null,
        year: 2023
      });
    });

    it('should handle null item', () => {
      expect(transformItemForSerialization(null)).toBe(null);
      expect(transformItemForSerialization(undefined)).toBe(undefined);
    });
  });

  describe('transformItemsForSerialization', () => {
    it('should transform array of items', () => {
      const items = [
        {
          id: 'item-1',
          runTimeTicks: BigInt('100'),
          name: 'Item 1'
        },
        {
          id: 'item-2',
          runTimeTicks: BigInt('200'),
          name: 'Item 2'
        }
      ];
      const result = transformItemsForSerialization(items);
      expect(result).toEqual([
        {
          id: 'item-1',
          runTimeTicks: '100',
          name: 'Item 1'
        },
        {
          id: 'item-2',
          runTimeTicks: '200',
          name: 'Item 2'
        }
      ]);
    });

    it('should handle empty array', () => {
      expect(transformItemsForSerialization([])).toEqual([]);
    });
  });

  describe('JSON.stringify integration', () => {
    it('should allow successful JSON serialization after transformation', () => {
      const item = {
        id: 'test',
        runTimeTicks: BigInt('9223372036854775807'),
        name: 'Test Item'
      };

      // This would throw "Do not know how to serialize a BigInt" without transformation
      expect(() => JSON.stringify(item)).toThrow();

      // After transformation, it should work
      const transformed = transformItemForSerialization(item);
      expect(() => JSON.stringify(transformed)).not.toThrow();

      const serialized = JSON.stringify(transformed);
      expect(serialized).toBe('{"id":"test","runTimeTicks":"9223372036854775807","name":"Test Item"}');
    });
  });
});