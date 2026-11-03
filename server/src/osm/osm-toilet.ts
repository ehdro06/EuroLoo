// Converts OpenStreetMap elements (as returned by the Overpass API) into Toilet rows.

export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  // Nodes have coordinates; ways and relations have a center with `out center`
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export interface OsmToilet {
  externalId: string;
  lat: number;
  lon: number;
  name: string | null;
  operator: string | null;
  fee: string | null;
  isFree: boolean;
  isPaid: boolean;
  openingHours: string | null;
  wheelchair: string | null;
  isAccessible: boolean;
  access: string | null;
  isIndoor: boolean;
  hasChangingTable: boolean;
  hasDrinkingWater: boolean;
  isUnisex: boolean;
  isFemale: boolean;
  isMale: boolean;
  description: string | null;
}

const PAID_FEE_HINTS = ['cent', 'eur', '€'];

export function mapOsmElement(element: OverpassElement): OsmToilet | null {
  const tags = element.tags ?? {};
  if (tags.amenity !== 'toilets') return null;

  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  if (lat === undefined || lon === undefined) return null;

  const fee = tags.fee ?? null;
  const feeLower = fee?.toLowerCase() ?? '';
  const wheelchair = tags.wheelchair ?? null;

  return {
    // Same format as the old PBF import (node/123), extended to ways and relations
    externalId: `${element.type}/${element.id}`,
    lat,
    lon,
    name: tags.name ?? null,
    operator: tags.operator ?? null,
    fee,
    isFree: feeLower === 'no' || feeLower === '0',
    isPaid: feeLower === 'yes' || PAID_FEE_HINTS.some((hint) => feeLower.includes(hint)),
    openingHours: tags.opening_hours ?? null,
    wheelchair,
    isAccessible: wheelchair === 'yes' || wheelchair === 'designated',
    access: tags.access ?? null,
    isIndoor: tags.indoor === 'yes',
    hasChangingTable: tags.changing_table === 'yes',
    hasDrinkingWater: tags.drinking_water === 'yes',
    isUnisex: tags.unisex === 'yes',
    isFemale: tags.female === 'yes',
    isMale: tags.male === 'yes',
    description: tags.description ?? tags.note ?? null,
  };
}
