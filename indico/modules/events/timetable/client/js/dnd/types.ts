interface Coords {
  x: number;
  y: number;
}

export type MousePosition = Coords;
export type Transform = Coords;

export interface Rect {
  top: number;
  left: number;
  bottom: number;
  right: number;
  width: number;
  height: number;
}
