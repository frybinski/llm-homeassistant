/**
 * A minimal YAML emitter for plain JSON values. For display only: the output
 * is meant to be read by a person, nothing parses it and nothing is written
 * from it. Strings that could be read as another type are double-quoted.
 */
import type { Json } from "../model";

const PLAIN = /^[\p{L}_][\p{L}\p{N}_ ./-]*$/u;
const RESERVED = /^(true|false|yes|no|on|off|y|n|null|~)$/i;

function scalar(value: string | number | boolean | null): string {
  if (value === null) return "null";
  if (typeof value !== "string") return String(value);
  if (PLAIN.test(value) && !RESERVED.test(value) && !value.endsWith(" ")) {
    return value;
  }
  return JSON.stringify(value);
}

function isScalar(value: Json): value is string | number | boolean | null {
  return value === null || typeof value !== "object";
}

function isEmpty(value: Json): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    (Array.isArray(value) ? value.length === 0 : Object.keys(value).length === 0)
  );
}

function inline(value: Json): string {
  if (Array.isArray(value)) return "[]";
  if (typeof value === "object" && value !== null) return "{}";
  return scalar(value);
}

function lines(value: Json, indent: string): string[] {
  const out: string[] = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      if (isScalar(item) || isEmpty(item)) {
        out.push(`${indent}- ${inline(item)}`);
      } else {
        const [first, ...rest] = lines(item, `${indent}  `);
        out.push(`${indent}- ${first.slice(indent.length + 2)}`, ...rest);
      }
    }
  } else if (typeof value === "object" && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      if (isScalar(item) || isEmpty(item)) {
        out.push(`${indent}${scalar(key)}: ${inline(item)}`);
      } else {
        out.push(`${indent}${scalar(key)}:`, ...lines(item, `${indent}  `));
      }
    }
  }
  return out;
}

export function toYaml(value: Json): string {
  if (isScalar(value) || isEmpty(value)) return inline(value);
  return lines(value, "").join("\n");
}
