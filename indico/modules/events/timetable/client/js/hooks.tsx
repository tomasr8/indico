import React, {useCallback, useEffect, useRef, useState, createContext, useContext} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {
  registerDraggable,
  registerDroppable,
  unregisterDraggable,
  unregisterDroppable,
} from './actions';

interface DnDContextType {
  // droppables: Record<string, {node: HTMLElement}>;
  // draggables: Record<string, object>;
  onDrop: (draggableId: string, droppableId: string) => void;
}
// const DnDContext = createContext<DnDContextType>({
//   // droppables: {},
//   // draggables: {},
//   onDrop: () => {},
// });
const DnDContext = createContext<DnDContextType>(() => {});

export function DnDProvider({children, onDrop}) {
  return <DnDContext.Provider value={onDrop}>{children}</DnDContext.Provider>;
}

export function useDroppable({id}: {id: string}) {
  const dispatch = useDispatch();
  // const droppable = useSelector((state: any) => state.droppables[id]);
  const ref = useRef<HTMLElement | null>(null);
  // console.log("droppable", droppable);

  const setNodeRef = useCallback((node: HTMLElement | null) => {
    if (node) {
      ref.current = node;
    }
  }, []);

  useEffect(() => {
    // console.log("registering droppable", id);
    if (ref.current) {
      dispatch(registerDroppable(id, ref.current));
    }

    return () => {
      // console.log("unregistering droppable", id);
      dispatch(unregisterDroppable(id));
    };
  }, [dispatch, id]);

  return {setNodeRef, data: {}};
}

type DragState = 'dragging' | 'idle' | 'mousedown';
interface MousePosition {
  x: number;
  y: number;
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
  const dispatch = useDispatch();
  const dragState = useRef<DragState>('idle');
  const initialMousePosition = useRef<MousePosition>({x: 0, y: 0});
  const scrollPosition = useRef<MousePosition>({x: 0, y: 0});
  //   const draggable = useSelector((state: any) => state.draggables[id]);
  const droppables = useSelector((state: any) => state.dnd.droppables);
  // const onDrop = useSelector((state: any) => state.dnd.onDrop);
  const [transform, setTransform] = useState<MousePosition | null>(null);
  const onDrop = useContext(DnDContext);
  // console.log('rerender', id)
  // const onDrop = dndContext.onDrop;

  const onMouseDown = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    console.log('mouse down');
    if (dragState.current === 'idle') {
      dragState.current = 'mousedown';
      initialMousePosition.current = {x: e.pageX, y: e.pageY};
      scrollPosition.current = {x: window.scrollX, y: window.scrollY};
    }
  }, []);

  useEffect(() => {
    function onMouseUp(e: MouseEvent) {
      console.log('mouse up');
      if (dragState.current === 'dragging') {
        // console.log('droppables', droppables);
        dragState.current = 'idle';
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
              x: e.pageX - initialMousePosition.current.x,
              y: e.pageY - initialMousePosition.current.y,
            });
            onDrop(
              id,
              droppableId,
              {
                x: e.pageX - initialMousePosition.current.x,
                y: e.pageY - initialMousePosition.current.y,
              },
              {pageX: e.pageX, pageY: e.pageY, clientX: e.clientX, clientY: e.clientY},
              rect
            );
          }
        }
      } else if (dragState.current === 'mousedown') {
        dragState.current = 'idle';
      }
      setTransform(null);
    }

    function onMouseMove(e: MouseEvent) {
      // console.log('mouse move', initialMousePosition.current)
      // console.log("mouse move", dragState.current);
      if (dragState.current === 'mousedown' || dragState.current === 'dragging') {
        if (dragState.current === 'mousedown') {
          dragState.current = 'dragging';
          // drag start
        }
        setTransform({
          x: e.pageX - initialMousePosition.current.x,
          y: e.pageY - initialMousePosition.current.y,
        });
      }
    }

    function onScroll(e) {
      if (dragState.current === 'dragging') {
        const deltaX = window.scrollX - scrollPosition.current.x;
        const deltaY = window.scrollY - scrollPosition.current.y;
        scrollPosition.current = {x: window.scrollX, y: window.scrollY};
        setTransform(t => {
          //   console.log("scroll", t?.y, window.scrollY);
          return {
            x: t.x + deltaX,
            y: t.y + deltaY,
          };
        });
      }
    }

    dispatch(registerDraggable(id));
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('scroll', onScroll);

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('scroll', onScroll);
      dispatch(unregisterDraggable(id));
    };
  }, [dispatch, id, droppables, onDrop]);

  return {
    transform,
    isDragging: dragState.current === 'dragging',
    listeners: {onMouseDown},
  };
}
