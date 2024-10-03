import {Rect, Transform} from './types';

/**
 * Restrict a rect to be contained within another bounding rect. Taken from dnd-kit.
 * @param transform - the current transform of the element being dragged
 * @param rect - the rect which should be contained
 * @param boundingRect - the bounding rect of the container
 * @returns
 */
function restrictToBoundingRect(transform: Transform, rect: Rect, boundingRect: Rect): Transform {
  const value = {
    ...transform,
  };

  if (rect.top + transform.y <= boundingRect.top) {
    value.y = boundingRect.top - rect.top;
  } else if (rect.bottom + transform.y >= boundingRect.top + boundingRect.height) {
    value.y = boundingRect.top + boundingRect.height - rect.bottom;
  }

  if (rect.left + transform.x <= boundingRect.left) {
    value.x = boundingRect.left - rect.left;
  } else if (rect.right + transform.x >= boundingRect.left + boundingRect.width) {
    value.x = boundingRect.left + boundingRect.width - rect.right;
  }

  return value;
}

/**
 * Restrict the dragged node to be contained within the container element
 * @param containerRef React ref to the container element
 * @returns A new Transform object
 */
export const createRestrictToElement = containerRef => ({draggingNodeRect, transform}) => {
  if (!draggingNodeRect || !containerRef.current) {
    return transform;
  }
  const rect = containerRef.current.getBoundingClientRect();
  return restrictToBoundingRect(transform, draggingNodeRect, rect);
};
