import type {
  JolpicaResponse,
  JolpicaRace,
  JolpicaResult,
  JolpicaQualifyingResult,
  JolpicaSprintQualifyingResult,
  JolpicaDriverStanding,
  JolpicaConstructorStanding,
} from '../types';
import { setTimeout } from 'node:timers/promises';

const JOLPICA_BASE = 'https://api.jolpi.ca/ergast/f1';

const MAX_RETRIES = 5;

function parseRetryAfterMs(header: string | null, fallbackMs: number): number {
  if (!header) return fallbackMs;
  // Try as a number of seconds first
  const seconds = parseFloat(header);
  if (!isNaN(seconds)) return Math.ceil(seconds) * 1000;
  // Try as an HTTP date string (e.g. "Fri, 01 Mar 2026 12:00:00 GMT")
  const date = new Date(header);
  if (!isNaN(date.getTime())) return Math.max(0, date.getTime() - Date.now());
  return fallbackMs;
}

async function jolpicaFetch<T>(path: string): Promise<JolpicaResponse<T>> {
  const url = `${JOLPICA_BASE}${path}?limit=100`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    console.log(`[sync] GET ${path}${attempt > 0 ? ` (attempt ${attempt + 1})` : ''}`);
    const res = await fetch(url);

    if (res.status === 429) {
      const retryAfter = res.headers.get('Retry-After');
      const fallbackMs = 5000 * Math.pow(2, attempt); // 5s, 10s, 20s, 40s, 80s
      const waitMs = parseRetryAfterMs(retryAfter, fallbackMs);
      if (attempt < MAX_RETRIES) {
        console.warn(`[sync] 429 rate limited on ${path} — backing off ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})${retryAfter ? ` [Retry-After: ${retryAfter}]` : ''}`);
        await setTimeout(waitMs);
        continue;
      }
      console.error(`[sync] 429 rate limited on ${path} — max retries reached`);
    }

    if (!res.ok) {
      console.error(`[sync] HTTP ${res.status} on ${path}`);
      throw new Error(`Jolpica fetch failed: ${res.status} ${url}`);
    }

    return res.json() as Promise<JolpicaResponse<T>>;
  }

  throw new Error(`Jolpica fetch failed after ${MAX_RETRIES} retries: ${url}`);
}

// Fetch the schedule (all races) for a season
export async function fetchSchedule(season: number): Promise<JolpicaRace[]> {
  const data = await jolpicaFetch<JolpicaRace>(`/${season}`);
  return data.MRData.RaceTable?.Races ?? [];
}

// Fetch race results for a specific round (includes grid positions)
export async function fetchResults(season: number, round: number): Promise<JolpicaResult[]> {
  const data = await jolpicaFetch<JolpicaRace>(`/${season}/${round}/results`);
  const races = data.MRData.RaceTable?.Races ?? [];
  return races[0]?.Results ?? [];
}

// Fetch qualifying results for a specific round
export async function fetchQualifying(season: number, round: number): Promise<JolpicaQualifyingResult[]> {
  const data = await jolpicaFetch<JolpicaRace>(`/${season}/${round}/qualifying`);
  const races = data.MRData.RaceTable?.Races ?? [];
  return races[0]?.QualifyingResults ?? [];
}

// Fetch sprint race results for a specific round
export async function fetchSprintResults(season: number, round: number): Promise<JolpicaResult[]> {
  const data = await jolpicaFetch<JolpicaRace>(`/${season}/${round}/sprint`);
  const races = data.MRData.RaceTable?.Races ?? [];
  return races[0]?.SprintResults ?? [];
}

// Fetch sprint qualifying results for a specific round.
// Jolpica serves sprint qualifying via the /qualifying endpoint on sprint weekends;
// they use Q1/Q2/Q3 field names even for SQ1/SQ2/SQ3 times.
export async function fetchSprintQualifying(season: number, round: number): Promise<JolpicaSprintQualifyingResult[]> {
  const data = await jolpicaFetch<JolpicaRace>(`/${season}/${round}/qualifying`);
  const races = data.MRData.RaceTable?.Races ?? [];
  const raw = races[0]?.QualifyingResults ?? [];
  // Cast: JolpicaQualifyingResult and JolpicaSprintQualifyingResult have identical shapes
  return raw as unknown as JolpicaSprintQualifyingResult[];
}

// Fetch driver standings after a specific round (round=0 = pre-season / empty)
export async function fetchDriverStandings(season: number, round: number): Promise<JolpicaDriverStanding[]> {
  if (round === 0) return [];
  const data = await jolpicaFetch<never>(`/${season}/${round}/driverStandings`);
  const lists = data.MRData.StandingsTable?.StandingsLists ?? [];
  return lists[0]?.DriverStandings ?? [];
}

// Fetch constructor standings after a specific round
export async function fetchConstructorStandings(season: number, round: number): Promise<JolpicaConstructorStanding[]> {
  if (round === 0) return [];
  const data = await jolpicaFetch<never>(`/${season}/${round}/constructorStandings`);
  const lists = data.MRData.StandingsTable?.StandingsLists ?? [];
  return lists[0]?.ConstructorStandings ?? [];
}