// ---- Worker environment bindings ----

export interface Env {
  DB: D1Database;
  SYNC_SECRET: string;
  SYNC_QUEUE: Queue<{ season: number; fromRound?: number; toRound?: number }>;
  CACHE: KVNamespace;
  SENTRY_DSN: string;
  CF_VERSION_METADATA: { id: string };
}

// ---- Database row types ----

export interface Race {
  id: number;
  season: number;
  round: number;
  name: string;
  circuit_name: string;
  circuit_id: string;
  locality: string | null;
  country: string | null;
  date: string;       // "YYYY-MM-DD"
  time: string | null; // "HH:MM:SSZ" UTC, or null
  wikipedia_url: string | null;
  sprint_date: string | null;  // null if not a sprint weekend
  sprint_time: string | null;
}

export interface RaceEntry {
  id: number;
  race_id: number;
  jolpica_driver_id: string;
  driver_code: string;
  driver_name: string;
  constructor: string;
  grid_position: number | null;
  finish_position: number | null;
  status: string;
  points: number;
  fastest_lap: number; // 0 | 1
}

export interface SprintEntry {
  id: number;
  race_id: number;
  jolpica_driver_id: string;
  driver_code: string;
  driver_name: string;
  constructor: string;
  grid_position: number | null;
  finish_position: number | null;
  status: string;
  points: number;
  fastest_lap: number; // 0 | 1
}

export interface QualiEntry {
  id: number;
  race_id: number;
  jolpica_driver_id: string;
  driver_code: string;
  driver_name: string;
  constructor: string;
  position: number;
  q1: string | null;
  q2: string | null;
  q3: string | null;
}

export interface SprintQualiEntry {
  id: number;
  race_id: number;
  jolpica_driver_id: string;
  driver_code: string;
  driver_name: string;
  constructor: string;
  position: number;
  sq1: string | null;
  sq2: string | null;
  sq3: string | null;
}

export interface StandingsSnapshot {
  id: number;
  race_id: number;
  snapshot_type: 'before' | 'after';
  entity_type: 'driver' | 'constructor';
  position: number;
  entity_id: string;
  entity_name: string;
  points: number;
  wins: number;
}

// ---- Jolpica API response shapes ----

export interface JolpicaResponse<T> {
  MRData: {
    total: string;
    RaceTable?: { Races: T[] };
    StandingsTable?: { StandingsLists: JolpicaStandingsList[] };
  };
}

export interface JolpicaRace {
  season: string;
  round: string;
  raceName: string;
  Circuit: {
    circuitId: string;
    circuitName: string;
    Location: {
      locality: string;
      country: string;
    };
  };
  date: string;
  time?: string;
  url: string;
  Sprint?: { date: string; time?: string };  // present on sprint weekends
  Results?: JolpicaResult[];
  QualifyingResults?: JolpicaQualifyingResult[];
  SprintResults?: JolpicaResult[];            // same shape as Results
  SprintQualifyingResults?: JolpicaSprintQualifyingResult[];
}

export interface JolpicaResult {
  number: string;
  position: string;
  positionText: string;
  points: string;
  Driver: {
    driverId: string;
    code: string;
    givenName: string;
    familyName: string;
  };
  Constructor: {
    constructorId: string;
    name: string;
  };
  grid: string;
  laps: string;
  status: string;
  FastestLap?: {
    rank: string;
    lap: string;
    Time: { time: string };
  };
}

export interface JolpicaQualifyingResult {
  number: string;
  position: string;
  Driver: {
    driverId: string;
    code: string;
    givenName: string;
    familyName: string;
  };
  Constructor: {
    constructorId: string;
    name: string;
  };
  Q1?: string;
  Q2?: string;
  Q3?: string;
}

// Sprint qualifying (Sprint Shootout) results — same shape as qualifying but with SQ1/SQ2/SQ3
export interface JolpicaSprintQualifyingResult {
  number: string;
  position: string;
  Driver: {
    driverId: string;
    code: string;
    givenName: string;
    familyName: string;
  };
  Constructor: {
    constructorId: string;
    name: string;
  };
  Q1?: string;  // Jolpica uses Q1/Q2/Q3 naming even for sprint qualifying
  Q2?: string;
  Q3?: string;
}

export interface JolpicaStandingsList {
  season: string;
  round: string;
  DriverStandings?: JolpicaDriverStanding[];
  ConstructorStandings?: JolpicaConstructorStanding[];
}

export interface JolpicaDriverStanding {
  position?: string;      // absent when positionText is "-" (e.g. DNF, no points)
  positionText: string;
  points: string;
  wins: string;
  Driver: {
    driverId: string;
    givenName: string;
    familyName: string;
  };
}

export interface JolpicaConstructorStanding {
  position?: string;      // absent when positionText is "-"
  positionText: string;
  points: string;
  wins: string;
  Constructor: {
    constructorId: string;
    name: string;
  };
}
