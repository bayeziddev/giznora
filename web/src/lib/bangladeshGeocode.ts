import divisionsExport from '../data/bangladesh/divisions.json';
import districtsExport from '../data/bangladesh/districts.json';
import upazilasExport from '../data/bangladesh/upazilas.json';
import unionsExport from '../data/bangladesh/unions.json';
import postcodeExport from '../data/bangladesh/postcode.json';

/** Source: https://github.com/bayeziddev/Bangladesh-geocode (MIT licensed). */
export interface GeoRecord {
  id: string | number;
  name: string;
  bn_name?: string;
  division_id?: string | number;
  district_id?: string | number;
  upazila_id?: string | number;
  upazilla_id?: string | number;
}

function records<T>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  const table = value.find(
    (item): item is { data: T[] } =>
      typeof item === 'object' && item !== null && Array.isArray((item as { data?: unknown }).data),
  );
  return table ? table.data : (value as T[]);
}

export const DIVISIONS = records<GeoRecord>(divisionsExport);
export const DISTRICTS = records<GeoRecord>(districtsExport);
export const UPAZILAS = records<GeoRecord>(upazilasExport);
export const UNIONS = records<GeoRecord>(unionsExport);
export const POSTCODES = postcodeExport as Record<string, unknown>;

export function byId(rows: GeoRecord[], id: string): GeoRecord | undefined {
  return rows.find((row) => String(row.id) === id);
}

export function optionLabel(row: GeoRecord): string {
  return row.bn_name && row.bn_name !== row.name ? `${row.bn_name} — ${row.name}` : row.name;
}

export function postcodeExists(postcode: string): boolean {
  const wanted = postcode.trim();
  return wanted.length > 0 && Object.keys(POSTCODES).some((key) => key.trim() === wanted);
}
