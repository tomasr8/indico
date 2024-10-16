import React, {useCallback, useEffect, useRef, useState, useMemo} from 'react';
import {createContext, useContextSelector} from 'use-context-selector';

import {
  MousePosition,
  Modifier,
  OnDrop,
  DragState,
  Droppable,
  Draggable,
  Over,
  Transform,
  HTMLRef,
} from './types';
import {pointerInside} from './utils';

type Droppables = Record<string, Droppable>;
type Draggables = Record<string, Draggable>;

interface DnDState {
  state: DragState;
  initialMousePosition: MousePosition;
  scrollPosition: MousePosition;
  activeDraggable?: string;
}

interface DnDContextType {
  droppables: Droppables;
  draggables: Draggables;
  onDrop: OnDrop;
  registerDroppable: (id: string, node: HTMLRef) => void;
  unregisterDroppable: (id: string) => void;
  registerDraggable: (id: string, node: HTMLRef) => void;
  unregisterDraggable: (id: string) => void;
  onMouseDown: (id: string, position: MousePosition) => void;
}
const DnDContext = createContext<DnDContextType>({
  droppables: {},
  draggables: {},
  onDrop: null,
  registerDroppable: null,
  unregisterDroppable: null,
  registerDraggable: null,
  unregisterDraggable: null,
  onMouseDown: null,
});

function removeKey(obj, deleteKey) {
  const {[deleteKey]: _, ...newObj} = obj; // eslint-disable-line @typescript-eslint/no-unused-vars
  return newObj;
}

function setBoundingRect(draggables: Draggables, id: string) {
  const draggable = draggables[id];
  if (!draggable.node) {
    return draggables;
  }
  const boundingRect = draggable.node.current.getBoundingClientRect();
  const rect = {
    top: boundingRect.top + window.scrollY,
    left: boundingRect.left + window.scrollX,
    bottom: boundingRect.bottom + window.scrollY,
    right: boundingRect.right + window.scrollX,
    width: boundingRect.width,
    height: boundingRect.height,
  };
  return {
    ...draggables,
    [id]: {
      ...draggable,
      rect,
    },
  };
}

function resetDraggableState(draggables: Draggables, id: string) {
  const draggable = draggables[id];
  return {
    ...draggables,
    [id]: {
      ...draggable,
      transform: null,
      rect: null,
    },
  };
}

function setTransform(
  draggables: Draggables,
  id: string,
  initialMousePosition: MousePosition,
  currentMousePosition: MousePosition,
  modifier: Modifier
) {
  const draggable = draggables[id];
  const transform = modifier({
    draggingNodeRect: draggable.rect,
    transform: {
      x: currentMousePosition.x - initialMousePosition.x,
      y: currentMousePosition.y - initialMousePosition.y,
    },
  });
  return {
    ...draggables,
    [id]: {
      ...draggable,
      transform,
    },
  };
}

function setTransformOnScroll(
  draggables: Draggables,
  id: string,
  delta: Transform,
  modifier: Modifier
) {
  const draggable = draggables[id];
  const transform = modifier({
    draggingNodeRect: draggable.rect,
    transform: {
      x: draggable.transform.x + delta.x,
      y: draggable.transform.y + delta.y,
    },
  });
  return {
    ...draggables,
    [id]: {
      ...draggable,
      transform,
    },
  };
}

function getOverlappingDroppables(droppables: Droppables, mouse: MousePosition): Over[] {
  const overlapping = [];
  for (const droppableId in droppables) {
    const droppable = droppables[droppableId];
    if (!droppable.node.current) {
      continue;
    }
    const boundingRect = droppable.node.current.getBoundingClientRect();
    const rect = {
      top: boundingRect.top + window.scrollY,
      left: boundingRect.left + window.scrollX,
      bottom: boundingRect.bottom + window.scrollY,
      right: boundingRect.right + window.scrollX,
      width: boundingRect.width,
      height: boundingRect.height,
    };
    if (pointerInside(mouse, rect)) {
      console.log('dropped inside', droppableId);
      overlapping.push({id: droppableId, rect});
    }
  }
  return overlapping;
}

export function DnDProvider({
  children,
  onDrop,
  modifier = ({transform}) => transform,
}: {
  children: React.ReactNode;
  onDrop: OnDrop;
  modifier?: Modifier;
}) {
  const [droppables, setDroppables] = useState<Droppables>({});
  const [draggables, setDraggables] = useState<Draggables>({});
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

  const registerDraggable = useCallback((id, node) => {
    setDraggables(d => ({...d, [id]: {node}}));
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
      setDraggables(d => setBoundingRect(d, id));
    }
  }, []);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (state.current.state === 'mousedown' || state.current.state === 'dragging') {
        if (state.current.state === 'mousedown') {
          state.current.state = 'dragging';
        }
        setDraggables(d =>
          setTransform(
            d,
            state.current.activeDraggable,
            state.current.initialMousePosition,
            {x: e.pageX, y: e.pageY},
            modifier
          )
        );
      }
    },
    [state, modifier]
  );

  const onMouseUp = useCallback(
    (e: MouseEvent) => {
      if (state.current.state === 'dragging') {
        state.current.state = 'idle';
        const mouse = {x: e.pageX, y: e.pageY};
        const overlapping = getOverlappingDroppables(droppables, mouse);
        const draggable = draggables[state.current.activeDraggable];
        const delta = modifier({
          draggingNodeRect: draggable.rect,
          transform: {
            x: e.pageX - state.current.initialMousePosition.x,
            y: e.pageY - state.current.initialMousePosition.y,
          },
        });
        onDrop(state.current.activeDraggable, overlapping, delta, mouse);
      } else if (state.current.state === 'mousedown') {
        state.current.state = 'idle';
      }
      setDraggables(d => resetDraggableState(d, state.current.activeDraggable));
      state.current.activeDraggable = null;
    },
    [state, droppables, draggables, onDrop, modifier]
  );

  const onScroll = useCallback(() => {
    if (state.current.state === 'dragging') {
      const deltaX = window.scrollX - state.current.scrollPosition.x;
      const deltaY = window.scrollY - state.current.scrollPosition.y;
      state.current.scrollPosition = {x: window.scrollX, y: window.scrollY};
      // console.log('setting scroll', deltaX, deltaY);
      setDraggables(d =>
        setTransformOnScroll(d, state.current.activeDraggable, {x: deltaX, y: deltaY}, modifier)
      );
    }
  }, [modifier]);

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
      registerDroppable(id, ref);
    }

    return () => {
      unregisterDroppable(id);
    };
  }, [id, registerDroppable, unregisterDroppable]);

  return {setNodeRef};
}

export function useDraggable({id}: {id: string}) {
  const ref = useRef<HTMLElement | null>(null);
  const _onMouseDown = useContextSelector(DnDContext, ctx => ctx.onMouseDown);
  const draggable = useContextSelector(DnDContext, ctx => ctx.draggables[id]);
  const registerDraggable = useContextSelector(DnDContext, ctx => ctx.registerDraggable);
  const unregisterDraggable = useContextSelector(DnDContext, ctx => ctx.unregisterDraggable);
  // console.log('transform', (draggable || {}).transform);

  const setNodeRef = useCallback((node: HTMLElement | null) => {
    if (node) {
      ref.current = node;
    }
  }, []);

  const onMouseDown = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      _onMouseDown(id, {x: e.pageX, y: e.pageY});
    },
    [_onMouseDown, id]
  );

  useEffect(() => {
    if (ref.current) {
      registerDraggable(id, ref);
    }

    return () => {
      unregisterDraggable(id);
    };
  }, [id, registerDraggable, unregisterDraggable]);

  const transform = (draggable || {}).transform;

  return {
    setNodeRef,
    transform,
    isDragging: !!transform,
    listeners: {onMouseDown},
  };
}
