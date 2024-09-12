import {Moment} from 'moment';

type PercentWidth = number;

interface Session {
  id: number;
}

interface BaseEntry {
  type: 'contrib' | 'block' | 'break';
  id: number;
  title: string;
  startDt: Moment;
  duration: number;
  session?: Session;
  // position information
  x: number;
  y: number;
  width: PercentWidth | string;
  column: number;
  maxColumn: number;
}

export interface ContribEntry extends BaseEntry {
  type: 'contrib';
}

export interface BlockEntry extends BaseEntry {
  type: 'block';
  session: Session;
  children: ChildEntry[];
}

export interface BreakEntry extends BaseEntry {
  type: 'break';
}

export interface ChildContribEntry extends ContribEntry {
  parentId: number;
}

export interface ChildBreakEntry extends BreakEntry {
  parentId: number;
}

export type TopLevelEntry = ContribEntry | BlockEntry | BreakEntry;
export type ChildEntry = ChildContribEntry | ChildBreakEntry;
export type Entry = TopLevelEntry | ChildEntry;
export type DayEntries = Record<string, TopLevelEntry[]>;
