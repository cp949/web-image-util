import { describe, it, expect } from 'vitest';

describe('Hello World', () => {
  it('should return hello world', () => {
    const message = 'Hello World';
    expect(message).toBe('Hello World');
  });

  it('should add two numbers', () => {
    const result = 1 + 1;
    expect(result).toBe(2);
  });

  it('should check if array contains value', () => {
    const fruits = ['apple', 'banana', 'orange'];
    expect(fruits).toContain('banana');
  });
});