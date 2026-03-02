import api from './api';

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

export interface GeocodeSuggestion {
  displayName: string;
  shortName: string;
  latitude: number;
  longitude: number;
}

export const geocodeService = {
  async geocodeAddress(address: string): Promise<GeocodeResult> {
    const res = await api.get<GeocodeResult>('/geocode', { params: { address } });
    return res.data;
  },

  async suggest(query: string): Promise<GeocodeSuggestion[]> {
    const res = await api.get<{ suggestions: GeocodeSuggestion[] }>('/geocode/suggest', { params: { query } });
    return res.data.suggestions;
  },
};
