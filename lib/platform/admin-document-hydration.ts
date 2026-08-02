export function hydrateDocumentId<T extends Record<string, unknown>>(id: string, data: T) {
  return { ...data, id };
}
