import {MousePosition} from './types';

export function pointerInside(
  pointer: MousePosition,
  rect: {top: number; left: number; width: number; height: number}
) {
  return (
    pointer.x > rect.left &&
    pointer.x < rect.left + rect.width &&
    pointer.y > rect.top &&
    pointer.y < rect.top + rect.height
  );
}
