import { z } from "zod";
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);
export const petInput = z
  .object({
    name: z.string().trim().min(1, "Give your pet a name").max(60),
    species: z.enum(["CAT", "DOG"]),
    sex: z.enum(["FEMALE", "MALE", "UNKNOWN"]).default("UNKNOWN"),
    breed: optionalText(100),
    mixedBreed: z.boolean().default(false),
    birthPrecision: z
      .enum(["EXACT", "APPROXIMATE", "YEAR", "UNKNOWN"])
      .default("UNKNOWN"),
    birthDate: z.string().optional(),
    ageEntry: optionalText(100),
    colour: optionalText(80),
    markings: optionalText(500),
    microchip: optionalText(40),
    neutered: z.enum(["YES", "NO", "UNKNOWN"]).default("UNKNOWN"),
    area: optionalText(100),
    description: optionalText(600),
  })
  .superRefine((v, ctx) => {
    if (v.birthPrecision === "UNKNOWN") return;
    const value = v.birthDate || "";
    const d = new Date(value + "T00:00:00Z");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(d.getTime()) ||
      d.toISOString().slice(0, 10) !== value ||
      value > new Date().toISOString().slice(0, 10) ||
      value < "1900-01-01"
    )
      ctx.addIssue({
        code: "custom",
        path: ["birthDate"],
        message: "Choose a valid birth date that is not in the future.",
      });
  });
export function ageLabel(
  date: Date | string | null | undefined,
  precision: string,
  now = new Date(),
) {
  if (!date || precision === "UNKNOWN") return "Age unknown";
  const born = new Date(date);
  let months =
    (now.getUTCFullYear() - born.getUTCFullYear()) * 12 +
    now.getUTCMonth() -
    born.getUTCMonth();
  if (now.getUTCDate() < born.getUTCDate()) months--;
  months = Math.max(0, months);
  const prefix = precision === "EXACT" ? "" : "About ";
  if (months < 1) return prefix + "under 1 month";
  if (months < 12)
    return `${prefix}${months} ${months === 1 ? "month" : "months"}`;
  const years = Math.floor(months / 12);
  return `${prefix}${years} ${years === 1 ? "year" : "years"}`;
}
type PublicSource = {
  publicId: string;
  name: string;
  species: string;
  breed: string | null;
  sex: string;
  birthDate: Date | string | null;
  birthPrecision: string;
  area: string | null;
  description: string | null;
  mainImageId: string | null;
};
export function publicProjection(p: PublicSource) {
  return {
    publicId: p.publicId,
    name: p.name,
    species: p.species,
    breed: p.breed,
    sex: p.sex,
    age: ageLabel(p.birthDate, p.birthPrecision),
    area: p.area,
    description: p.description,
    imageUrl: p.mainImageId ? `/api/images/${p.mainImageId}?public=1` : null,
  };
}
export function isPublicPet(p: { visibility: string; status: string }) {
  return p.visibility === "PUBLIC" && p.status === "ACTIVE";
}
export const MAX_PHOTOS = 3;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
