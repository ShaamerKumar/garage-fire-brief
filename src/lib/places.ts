import type { Department } from './schema';

const ENDPOINT = 'https://places.googleapis.com/v1/places';
const FIELDS =
  'id,displayName,formattedAddress,addressComponents,location,nationalPhoneNumber,websiteUri';

type PlacesResponse = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  addressComponents?: { longText: string; shortText: string; types: string[] }[];
  location?: { latitude: number; longitude: number };
  nationalPhoneNumber?: string;
  websiteUri?: string;
};

export class PlacesError extends Error {}

function component(res: PlacesResponse, type: string, short = false): string {
  const c = res.addressComponents?.find((a) => a.types.includes(type));
  return (short ? c?.shortText : c?.longText) ?? '';
}

/** Retries once on 403: a healthy key still gets PERMISSION_DENIED while restriction changes propagate across Google's edge. */
export async function lookupPlace(placeId: string): Promise<Department> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new PlacesError('GOOGLE_MAPS_API_KEY is not set');

  let res: Response | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    res = await fetch(`${ENDPOINT}/${encodeURIComponent(placeId)}`, {
      headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELDS },
      cache: 'no-store',
    });
    if (res.status !== 403) break;
  }
  if (!res) throw new PlacesError('Places request failed');

  if (res.status === 404) throw new PlacesError('No place found for that Place ID.');
  if (!res.ok) {
    const body = await res.text();
    throw new PlacesError(
      res.status === 403
        ? 'Google rejected the Places request. Check the key is restricted to Places API (New) and that the API is enabled.'
        : `Places API error ${res.status}: ${body.slice(0, 200)}`,
    );
  }

  const data: PlacesResponse = await res.json();
  const name = data.displayName?.text;
  if (!name || !data.location) {
    throw new PlacesError('Place ID resolved but returned no name or location.');
  }

  return {
    placeId: data.id,
    name,
    address: data.formattedAddress ?? '',
    city:
      component(data, 'locality') ||
      component(data, 'sublocality') ||
      component(data, 'administrative_area_level_3'),
    state: component(data, 'administrative_area_level_1', true),
    phone: data.nationalPhoneNumber,
    website: data.websiteUri,
    lat: data.location.latitude,
    lng: data.location.longitude,
  };
}
