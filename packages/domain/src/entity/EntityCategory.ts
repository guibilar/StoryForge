export enum EntityCategory {
  CHARACTER = "CHARACTER",
  LOCATION = "LOCATION",
  ORGANIZATION = "ORGANIZATION",
  ITEM = "ITEM",
  OTHER = "OTHER",
}

export function isEntityCategory(value: string): value is EntityCategory {
  return Object.values(EntityCategory).includes(value as EntityCategory);
}
