// Money as integer minor units (taka × 100). Never float.
export type MinorUnits = number & { readonly __brand: 'MinorUnits' }

export function toMinor(taka: number): MinorUnits {
  return Math.round(taka * 100) as MinorUnits
}

export function fromMinor(minor: MinorUnits): string {
  return (minor / 100).toFixed(2)
}
