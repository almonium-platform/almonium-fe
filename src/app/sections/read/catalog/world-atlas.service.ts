import {Injectable} from '@angular/core';
import type {GeometryObject} from 'geojson';
import {numericToAlpha2} from 'i18n-iso-countries';
import {feature} from 'topojson-client';
import type {GeometryCollection, Topology} from 'topojson-specification';

/** One country's outline for the unlock map, keyed the way the rights engine keys it. */
export interface CountryShape {
  /** ISO 3166 alpha-2, or null for a shape the standard does not number (Kosovo, Northern Cyprus). */
  alpha2: string | null;
  name: string;
  geometry: GeometryObject;
}

/**
 * The world's country outlines at 1:110m, loaded only when a map is opened. Antarctica is left out: it has no
 * copyright term and would take a third of the map.
 */
@Injectable({providedIn: 'root'})
export class WorldAtlasService {
  private shapes: Promise<CountryShape[]> | null = null;

  countries(): Promise<CountryShape[]> {
    this.shapes ??= import('world-atlas/countries-110m.json').then(module => toShapes(module.default as unknown as Topology));
    return this.shapes;
  }
}

export function toShapes(topology: Topology): CountryShape[] {
  const countries = feature(topology, topology.objects['countries'] as GeometryCollection);
  return countries.features
    .filter(country => country.id !== '010')
    .map(country => ({
      alpha2: numericToAlpha2(String(country.id)) ?? null,
      name: (country.properties as {name?: string} | null)?.name ?? String(country.id),
      geometry: country.geometry,
    }));
}
