import { mapOsmElement } from './osm-toilet.js';

describe('mapOsmElement', () => {
  it('maps a toilet node and its tags', () => {
    const toilet = mapOsmElement({
      type: 'node',
      id: 42,
      lat: 52.5,
      lon: 13.4,
      tags: { amenity: 'toilets', name: 'Alex WC', fee: 'no', wheelchair: 'yes', changing_table: 'yes', note: 'Ground floor' },
    });

    expect(toilet).toMatchObject({
      externalId: 'node/42',
      lat: 52.5,
      lon: 13.4,
      name: 'Alex WC',
      isFree: true,
      isPaid: false,
      isAccessible: true,
      hasChangingTable: true,
      description: 'Ground floor',
    });
  });

  it('uses the center of ways (toilets mapped as buildings)', () => {
    const toilet = mapOsmElement({ type: 'way', id: 7, center: { lat: 48.1, lon: 11.5 }, tags: { amenity: 'toilets' } });
    expect(toilet).toMatchObject({ externalId: 'way/7', lat: 48.1, lon: 11.5 });
  });

  it('treats a price as paid', () => {
    expect(mapOsmElement({ type: 'node', id: 1, lat: 0, lon: 0, tags: { amenity: 'toilets', fee: '0.50 EUR' } }))
      .toMatchObject({ isPaid: true, isFree: false });
  });

  it('ignores non-toilets and elements without coordinates', () => {
    expect(mapOsmElement({ type: 'node', id: 1, lat: 0, lon: 0, tags: { amenity: 'bench' } })).toBeNull();
    expect(mapOsmElement({ type: 'way', id: 2, tags: { amenity: 'toilets' } })).toBeNull();
  });
});
