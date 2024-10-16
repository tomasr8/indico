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

// export function useRect(
//   element: HTMLElement | null,
//   measure: (element: HTMLElement) => ClientRect = defaultMeasure,
//   fallbackRect?: ClientRect | null
// ) {
//   const [rect, measureRect] = useReducer(reducer, null);

//   const mutationObserver = useMutationObserver({
//     callback(records) {
//       if (!element) {
//         return;
//       }

//       for (const record of records) {
//         const {type, target} = record;

//         if (
//           type === 'childList' &&
//           target instanceof HTMLElement &&
//           target.contains(element)
//         ) {
//           measureRect();
//           break;
//         }
//       }
//     },
//   });
//   const resizeObserver = useResizeObserver({callback: measureRect});

//   useIsomorphicLayoutEffect(() => {
//     measureRect();

//     if (element) {
//       resizeObserver?.observe(element);
//       mutationObserver?.observe(document.body, {
//         childList: true,
//         subtree: true,
//       });
//     } else {
//       resizeObserver?.disconnect();
//       mutationObserver?.disconnect();
//     }
//   }, [element]);

//   return rect;

//   function reducer(currentRect: ClientRect | null) {
//     if (!element) {
//       return null;
//     }

//     if (element.isConnected === false) {
//       // Fall back to last rect we measured if the element is
//       // no longer connected to the DOM.
//       return currentRect ?? fallbackRect ?? null;
//     }

//     const newRect = measure(element);

//     if (JSON.stringify(currentRect) === JSON.stringify(newRect)) {
//       return currentRect;
//     }

//     return newRect;
//   }
// }