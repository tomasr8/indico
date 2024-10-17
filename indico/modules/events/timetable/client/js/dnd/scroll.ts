import {useEffect, useRef} from 'react';

import {MousePosition} from './types';

const SCROLL_MARGIN_PERCENT = 0.1;
const BASE_SPEED = 10;

type Timeout = ReturnType<typeof setInterval>;

export function useScrollIntent({enabled}: {enabled: boolean}) {
  const scrollSpeed = useRef<{x: number; y: number}>({x: 0, y: 0});
  const intervalRef = useRef<Timeout | null>(null);

  useEffect(() => {
    const id = intervalRef.current;

    function cleanUp() {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    function handleMouseMove(event: MouseEvent) {
      if (!enabled) {
        cleanUp();
        return;
      }

      scrollSpeed.current = getScrollSpeed({x: event.clientX, y: event.clientY});
      if (scrollSpeed.current.x !== 0 || scrollSpeed.current.y !== 0) {
        if (intervalRef.current === null) {
          intervalRef.current = setInterval(() => {
            console.log('tick');
            if (scrollSpeed.current.x !== 0 || scrollSpeed.current.y !== 0) {
              window.scrollBy(scrollSpeed.current.x, scrollSpeed.current.y);
            }
          }, 50);
        }
      } else {
        cleanUp();
      }
    }
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearInterval(id);
    };
  }, [enabled]);
}

function getScrollSpeed(mouse: MousePosition) {
  const mouseYPercent = mouse.y / window.innerHeight;
  const mouseXPercent = mouse.x / window.innerWidth;
  let speedX = 0;
  let speedY = 0;

  if (mouseYPercent < SCROLL_MARGIN_PERCENT) {
    speedY = -BASE_SPEED * Math.min(1 / mouseYPercent / 10, 5);
  } else if (mouseYPercent > 1 - SCROLL_MARGIN_PERCENT) {
    speedY = BASE_SPEED * Math.min(1 / (1 - mouseYPercent) / 10, 5);
  }

  if (mouseXPercent < SCROLL_MARGIN_PERCENT) {
    speedX = -BASE_SPEED * Math.min(1 / mouseXPercent / 10, 5);
  } else if (mouseXPercent > 1 - SCROLL_MARGIN_PERCENT) {
    speedX = BASE_SPEED * Math.min(1 / (1 - mouseXPercent) / 10, 5);
  }

  return {x: speedX, y: speedY};
}
