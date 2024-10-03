interface Coords {
  x: number;
  y: number;
}

export type MousePosition = Coords;
export type Transform = Coords;
export type UniqueId = string | number;

export interface Rect {
  top: number;
  left: number;
  bottom: number;
  right: number;
  width: number;
  height: number;
}

export type DragState = 'idle' | 'mousedown' | 'dragging';

export interface Over {
  id: UniqueId;
  rect: Rect;
}

export interface Droppable {
  node: HTMLElement;
}

export interface Draggable {
  node: HTMLElement;
  rect?: Rect;
  transform?: {x: number; y: number};
}

export type OnDrop = (
  who: UniqueId,
  over: Over | Over[],
  delta: Transform,
  mouse: MousePosition
) => void;

export type Modifier = ({
  draggingNodeRect,
  transform,
}: {
  draggingNodeRect: Rect;
  transform: Transform;
}) => Transform;
