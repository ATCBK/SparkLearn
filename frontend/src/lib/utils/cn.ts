type CnInput = string | undefined | null | false | CnInput[]

export function cn(...inputs: CnInput[]): string {
  const flat: string[] = []
  function flatten(items: CnInput[]) {
    for (const item of items) {
      if (Array.isArray(item)) {
        flatten(item)
      } else if (item) {
        flat.push(item)
      }
    }
  }
  flatten(inputs)
  return flat.join(' ')
}
