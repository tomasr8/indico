import React, {useCallback, useEffect, useRef, useState, useMemo} from 'react';
import {createContext, useContextSelector} from 'use-context-selector';

interface Droppable {
  node: HTMLElement;
}

interface Draggable {
  transform?: {x: number; y: number};
  active?: boolean;
}

function removeKey(obj, deleteKey) {
  const {[deleteKey]: _, ...newObj} = obj;
  return newObj;
}

type DragState = 'dragging' | 'idle' | 'mousedown';
interface MousePosition {
  x: number;
  y: number;
}

interface DnDState {
  state: DragState;
  initialMousePosition: MousePosition;
  scrollPosition: MousePosition;
  activeDraggable: string;
}

interface DnDContextType {
  droppables: Record<string, Droppable>;
  draggables: Record<string, Draggable>;
  onDrop: (draggableId: string, droppableId: string) => void;
  registerDroppable: (id: string, node: HTMLElement) => void;
  unregisterDroppable: (id: string) => void;
  registerDraggable: (id: string) => void;
  unregisterDraggable: (id: string) => void;
  onMouseDown: (id: string, position: {x: number; y: number}) => void;
}
const DnDContext = createContext<DnDContextType>({
  droppables: {},
  draggables: {},
  onDrop: () => {},
  registerDroppable: () => {},
  unregisterDroppable: () => {},
  registerDraggable: () => {},
  unregisterDraggable: () => {},
  onMouseDown: () => {},
});

export function DnDProvider({children, onDrop}: {children: React.ReactNode; onDrop: any}) {
  const [droppables, setDroppables] = useState({});
  const [draggables, setDraggables] = useState({});
  const state = useRef<DnDState>({
    state: 'idle',
    initialMousePosition: {x: 0, y: 0},
    scrollPosition: {x: 0, y: 0},
    activeDraggable: null,
  });

  const registerDroppable = useCallback((id, node) => {
    setDroppables(d => ({...d, [id]: {node}}));
  }, []);

  const unregisterDroppable = useCallback(id => {
    setDroppables(d => removeKey(d, id));
  }, []);

  const registerDraggable = useCallback(id => {
    setDraggables(d => ({...d, [id]: {}}));
  }, []);

  const unregisterDraggable = useCallback(id => {
    if (state.current.activeDraggable === id) {
      state.current = {
        state: 'idle',
        initialMousePosition: {x: 0, y: 0},
        scrollPosition: {x: 0, y: 0},
        activeDraggable: null,
      };
    }
    setDraggables(d => removeKey(d, id));
  }, []);

  const onMouseDown = useCallback((id, {x, y}) => {
    if (state.current.state === 'idle') {
      state.current = {
        state: 'mousedown',
        initialMousePosition: {x, y},
        scrollPosition: {x: window.scrollX, y: window.scrollY},
        activeDraggable: id,
      };
    }
  }, []);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (state.current.state === 'mousedown' || state.current.state === 'dragging') {
        if (state.current.state === 'mousedown') {
          state.current.state = 'dragging';
        }
        setDraggables(d => ({
          ...d,
          [state.current.activeDraggable]: {
            active: true,
            transform: {
              x: e.pageX - state.current.initialMousePosition.x,
              y: e.pageY - state.current.initialMousePosition.y,
            },
          },
        }));
      }
    },
    [state]
  );

  const onMouseUp = useCallback(
    (e: MouseEvent) => {
      console.log('mouse up');
      if (state.current.state === 'dragging') {
        // console.log('droppables', droppables);
        state.current.state = 'idle';
        for (const droppableId in droppables) {
          const droppable = droppables[droppableId];
          if (!droppable) {
            console.log('>> UNDEF', droppableId);
            continue;
          }
          //   console.log('droppable', droppable);
          let rect = droppable.node.getBoundingClientRect();
          rect = {
            top: rect.top + window.scrollY,
            left: rect.left + window.scrollX,
            width: rect.width,
            height: rect.height,
          };
          console.log({x: e.pageX, y: e.pageY}, rect, droppable.node.getBoundingClientRect());
          if (pointerInside({x: e.pageX, y: e.pageY}, rect)) {
            console.log('dropped inside', droppableId, {
              x: e.pageX - state.current.initialMousePosition.x,
              y: e.pageY - state.current.initialMousePosition.y,
            });
            console.log('state', state.current);
            onDrop(
              state.current.activeDraggable,
              droppableId,
              {
                x: e.pageX - state.current.initialMousePosition.x,
                y: e.pageY - state.current.initialMousePosition.y,
              },
              {pageX: e.pageX, pageY: e.pageY, clientX: e.clientX, clientY: e.clientY},
              rect
            );
          }
        }
      } else if (state.current.state === 'mousedown') {
        state.current.state = 'idle';
      }
      setDraggables(d => ({
        ...d,
        [state.current.activeDraggable]: {
          active: false,
          transform: null,
        },
      }));
    },
    [state, droppables, onDrop]
  );

  const onScroll = useCallback(() => {
    if (state.current.state === 'dragging') {
      const deltaX = window.scrollX - state.current.scrollPosition.x;
      const deltaY = window.scrollY - state.current.scrollPosition.y;
      state.current.scrollPosition = {x: window.scrollX, y: window.scrollY};
      setDraggables(d => ({
        ...d,
        [state.current.activeDraggable]: {
          active: true,
          transform: {
            x: d[state.current.activeDraggable].x + deltaX,
            y: d[state.current.activeDraggable].y + deltaY,
          },
        },
      }));
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('scroll', onScroll);

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('scroll', onScroll);
    };
  }, [onMouseUp, onMouseMove, onScroll]);

  const value = useMemo(
    () => ({
      droppables,
      draggables,
      onDrop,
      registerDroppable,
      unregisterDroppable,
      registerDraggable,
      unregisterDraggable,
      onMouseDown,
    }),
    [
      draggables,
      droppables,
      onDrop,
      registerDroppable,
      registerDraggable,
      unregisterDroppable,
      unregisterDraggable,
      onMouseDown,
    ]
  );

  return <DnDContext.Provider value={value}>{children}</DnDContext.Provider>;
}

export function useDroppable({id}: {id: string}) {
  const ref = useRef<HTMLElement | null>(null);
  const registerDroppable = useContextSelector(DnDContext, ctx => ctx.registerDroppable);
  const unregisterDroppable = useContextSelector(DnDContext, ctx => ctx.unregisterDroppable);

  const setNodeRef = useCallback((node: HTMLElement | null) => {
    if (node) {
      ref.current = node;
    }
  }, []);

  useEffect(() => {
    if (ref.current) {
      registerDroppable(id, ref.current);
    }

    return () => {
      unregisterDroppable(id);
    };
  }, [id, registerDroppable, unregisterDroppable]);

  return {setNodeRef};
}

function pointerInside(
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

export function useDraggable({id}: {id: string}) {
  const _onMouseDown = useContextSelector(DnDContext, ctx => ctx.onMouseDown);
  const draggable = useContextSelector(DnDContext, ctx => ctx.draggables[id]);
  const registerDraggable = useContextSelector(DnDContext, ctx => ctx.registerDraggable);
  const unregisterDraggable = useContextSelector(DnDContext, ctx => ctx.unregisterDraggable);

  const onMouseDown = useCallback(
    (e: MouseEvent) => {
      console.log('mouse down', id);
      e.stopPropagation();
      _onMouseDown(id, {x: e.pageX, y: e.pageY});
    },
    [_onMouseDown, id]
  );

  useEffect(() => {
    registerDraggable(id);

    return () => {
      unregisterDraggable(id);
    };
  }, [id, registerDraggable, unregisterDraggable]);

  const transform = (draggable || {}).transform;

  return {
    transform,
    isDragging: !!transform,
    listeners: {onMouseDown},
  };
}
