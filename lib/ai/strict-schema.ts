import { z } from "zod";

/**
 * Rewrites a Zod schema so OpenAI strict structured outputs accept it.
 *
 * Strict mode requires every property to be in `required` and
 * `additionalProperties: false` on every object. `.optional()`, `.partial()`,
 * and `.default()` drop keys from `required`, which makes the API reject the
 * schema before generation. Optional keys become required and nullable.
 * The returned schema is cast back to `T` so call sites keep their output type.
 */
export function asOpenAIStrictSchema<T extends z.ZodTypeAny>(schema: T): T {
  return strictify(schema) as T;
}

function strictify(schema: z.ZodTypeAny): z.ZodTypeAny {
  const typeName = (schema._def as { typeName?: string }).typeName;

  if (typeName === "ZodDefault") {
    return strictify((schema as z.ZodDefault<z.ZodTypeAny>).removeDefault());
  }

  if (typeName === "ZodOptional") {
    const inner = strictify((schema as z.ZodOptional<z.ZodTypeAny>).unwrap());
    return inner.isNullable() ? inner : inner.nullable();
  }

  if (typeName === "ZodNullable") {
    const inner = strictify((schema as z.ZodNullable<z.ZodTypeAny>).unwrap());
    return inner.nullable();
  }

  if (typeName === "ZodArray") {
    const arraySchema = schema as z.ZodArray<z.ZodTypeAny>;
    const def = arraySchema._def as {
      minLength?: { value: number } | null;
      maxLength?: { value: number } | null;
    };
    let next = z.array(strictify(arraySchema.element));
    if (def.minLength?.value != null) next = next.min(def.minLength.value);
    if (def.maxLength?.value != null) next = next.max(def.maxLength.value);
    return next;
  }

  if (typeName === "ZodObject") {
    const objectSchema = schema as z.ZodObject<z.ZodRawShape>;
    const shape = objectSchema.shape;
    const nextShape: z.ZodRawShape = {};
    for (const key of Object.keys(shape)) {
      nextShape[key] = strictify(shape[key]!);
    }
    return z.object(nextShape).strict();
  }

  return schema;
}
