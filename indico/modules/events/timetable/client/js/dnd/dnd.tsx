// This file is part of Indico.
// Copyright (C) 2002 - 2025 CERN
//
// Indico is free software; you can redistribute it and/or
// modify it under the terms of the MIT License; see the
// LICENSE file for more details.

import React, {useCallback, useEffect, useRef, useState, useMemo} from 'react';
import {createContext, useContextSelector} from 'use-context-selector';

import {getScrollParent, getTotalScroll} from './modifiers';
import {useScrollIntent} from './scroll';
import {
  MousePosition,
  Modifier,
  OnDrop,
  DragState,
  Droppable,
  Draggable,
  DraggableData as _DraggableData,
  Over,
  Transform,
  HTMLRef,
} from './types';
import {pointerInside} from './utils';
import {pixelsToMinutes} from 'indico/modules/events/timetable/client/js/utils';

type Droppables = Record<string, Droppable>;
type Draggables = Record<string, Draggable>;
type DraggableData = Record<string, _DraggableData>;

interface DnDState {
  state: DragState;
  mousePosition: MousePosition;
  scrollPosition: MousePosition;
  rawTransform: Transform;
  activeDraggable?: string;
}

interface DnDContextType {
  draggables: Draggables;
  droppables: Droppables;
  draggableData: DraggableData;
  onDrop: OnDrop;
  registerDroppable: (id: string, node: HTMLRef) => void;
  unregisterDroppable: (id: string) => void;
  registerDraggable: (id: string, fixed: boolean, node: HTMLRef) => void;
  unregisterDraggable: (id: string) => void;
  onMouseDown: (
    id: string,
    draggable: Draggable,
    position: {x: number; y: number; offsetX: number; offsetY: number}
  ) => void;
}
const DnDContext = createContext<DnDContextType>({
  draggables: {},
  droppables: {},
  draggableData: {},
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

function setBoundingRectAndScroll(draggableData: DraggableData, node: HTMLRef, id: string) {
  const draggable = draggableData[id];
  if (!node) {
    return draggableData;
  }
  const boundingRect = node.current.getBoundingClientRect();
  const scroll = getTotalScroll(node.current);
  const rect = {
    top: boundingRect.top + scroll.top,
    left: boundingRect.left + scroll.left,
    bottom: boundingRect.bottom + scroll.top,
    right: boundingRect.right + scroll.left,
    width: boundingRect.width,
    height: boundingRect.height,
  };
  return {
    ...draggableData,
    [id]: {
      ...draggable,
      rect,
      initialScroll: {
        top: scroll.top,
        left: scroll.left,
      },
    },
  };
}

function resetDraggableState(draggableData: DraggableData, id: string) {
  const draggable = draggableData[id];
  return {
    ...draggableData,
    [id]: {
      ...draggable,
      transform: null,
      rect: null,
    },
  };
}

function setTransform(
  draggableData: DraggableData,
  id: string,
  rawTransform: Transform,
  modifier: Modifier
) {
  // console.log('raw', rawTransform);
  const draggable = draggableData[id];
  // const oldTransform = draggable.transform || {x: 0, y: 0};
  const transform = modifier({
    draggingNodeRect: draggable.rect,
    transform: {...rawTransform},
    id,
  });
  console.log('transform', transform);
  return {
    ...draggableData,
    [id]: {
      ...draggable,
      transform,
      visualTransform: {...transform},
    },
  };
}

function setMousePosition(draggableData: DraggableData, id: string, mouse: MousePosition) {
  const draggable = draggableData[id];
  return {
    ...draggableData,
    [id]: {
      ...draggable,
      mouse,
    },
  };
}

function setInitialOffset(draggableData: DraggableData, id: string, offset: MousePosition) {
  const draggable = draggableData[id];
  return {
    ...draggableData,
    [id]: {
      ...draggable,
      initialOffset: offset,
    },
  };
}

function setTransformOnScroll(
  draggableData: DraggableData,
  id: string,
  rawTransform: Transform,
  modifier: Modifier
) {
  const draggable = draggableData[id];
  const transform = modifier({
    draggingNodeRect: draggable.rect,
    transform: {
      x: rawTransform.x,
      y: rawTransform.y,
    },
    id,
  });
  return {
    ...draggableData,
    [id]: {
      ...draggable,
      transform,
    },
  };
}

function setVisualTransformOnScroll(
  draggableData: DraggableData,
  id: string,
  delta: Transform,
  modifier: Modifier
) {
  const draggable = draggableData[id];
  const visualTransform = modifier({
    draggingNodeRect: draggable.rect,
    transform: {
      x: draggable.visualTransform.x + delta.x,
      y: draggable.visualTransform.y + delta.y,
    },
    id,
  });
  return {
    ...draggableData,
    [id]: {
      ...draggable,
      visualTransform,
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
  const [draggableData, setDraggableData] = useState<DraggableData>({});
  const state = useRef<DnDState>({
    state: 'idle',
    mousePosition: {x: 0, y: 0},
    scrollPosition: {x: 0, y: 0},
    rawTransform: {x: 0, y: 0},
    activeDraggable: null,
  });

  useScrollIntent({
    state,
    draggables,
    enabled: true,
  });

  const registerDroppable = useCallback((id, node) => {
    setDroppables(d => ({...d, [id]: {node}}));
  }, []);

  const unregisterDroppable = useCallback(id => {
    setDroppables(d => removeKey(d, id));
  }, []);

  const registerDraggable = useCallback((id, fixed, node) => {
    setDraggableData(d => ({...d, [id]: {fixed}}));
    setDraggables(d => ({...d, [id]: {node}}));
  }, []);

  const unregisterDraggable = useCallback(id => {
    if (state.current.activeDraggable === id) {
      state.current = {
        state: 'idle',
        mousePosition: {x: 0, y: 0},
        scrollPosition: {x: 0, y: 0},
        rawTransform: {x: 0, y: 0},
        activeDraggable: null,
      };
    }
    setDraggableData(d => removeKey(d, id));
    setDraggables(d => removeKey(d, id));
  }, []);

  const onMouseDown = useCallback(
    (id: string, draggable: Draggable, {offsetX, offsetY, clientX, clientY}) => {
      if (state.current.state === 'idle') {
        if (!draggable) {
          return;
        }

        const scrollParent = getScrollParent(draggable.node.current); // TODO: this should be getTotalScroll()
        state.current = {
          state: 'mousedown',
          mousePosition: {x: clientX, y: clientY},
          scrollPosition: {x: scrollParent.scrollLeft, y: scrollParent.scrollTop},
          rawTransform: {x: 0, y: 0},
          activeDraggable: id,
        };
        setDraggableData(d =>
          setInitialOffset(setBoundingRectAndScroll(d, draggable.node, id), id, {
            x: offsetX,
            y: offsetY,
          })
        );
        console.log('initial mouse', clientY);
      }
    },
    []
  );

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (state.current.state === 'mousedown' || state.current.state === 'dragging') {
        if (state.current.state === 'mousedown') {
          state.current.state = 'dragging';
        }
        const diff = {
          x: e.clientX - state.current.mousePosition.x,
          y: e.clientY - state.current.mousePosition.y,
        };
        console.log('diff', diff);
        state.current.mousePosition = {x: e.clientX, y: e.clientY};
        state.current.rawTransform = {
          x: state.current.rawTransform.x + diff.x,
          y: state.current.rawTransform.y + diff.y,
        };
        setDraggableData(d =>
          setMousePosition(
            setTransform(d, state.current.activeDraggable, state.current.rawTransform, modifier),
            state.current.activeDraggable,
            {x: e.clientX, y: e.clientY}
          )
        );
      }
    },
    [modifier]
  );

  const onMouseUp = useCallback(
    (e: MouseEvent) => {
      if (state.current.state === 'dragging') {
        state.current.state = 'idle';
        const mouse = {x: e.clientX, y: e.clientY};
        const overlapping = getOverlappingDroppables(droppables, mouse);
        const data = draggableData[state.current.activeDraggable];
        const delta = modifier({
          draggingNodeRect: data.rect,
          transform: {
            x: state.current.rawTransform.x,
            y: state.current.rawTransform.y,
          },
          id: state.current.activeDraggable,
        });
        console.time('drop');
        console.log('delta', delta.y / 2);
        onDrop(state.current.activeDraggable, overlapping, delta, mouse, {x: 0, y: 0});
        console.timeEnd('drop');
      } else if (state.current.state === 'mousedown') {
        state.current.state = 'idle';
      }
      setDraggableData(d => resetDraggableState(d, state.current.activeDraggable));
      state.current.activeDraggable = null;
    },
    [droppables, draggableData, onDrop, modifier]
  );

  const onScroll = useCallback(
    (e: MouseEvent) => {
      if (state.current.state !== 'dragging') {
        return;
      }

      const target = e.target as HTMLElement;
      const draggable = draggables[state.current.activeDraggable];
      const data = draggableData[state.current.activeDraggable];

      // if (draggable.fixed) {
      //   // fixed elements don't move with the scroll
      //   return;
      // }
      console.log(data.fixed, draggable);

      if (!data.fixed && !target.contains(draggable.node.current)) {
        return;
      }
      console.log('scroll', target, draggable);

      if (!data.fixed) {
        // get the container scroll position instead of the window scroll position
        const deltaX =
          target.scrollLeft -
          state.current.scrollPosition.x -
          state.current.initialScrollPosition.x;
        const deltaY =
          target.scrollTop - state.current.scrollPosition.y - state.current.initialScrollPosition.y;
        state.current.scrollPosition = {
          x: state.current.scrollPosition.x + deltaX,
          y: state.current.scrollPosition.y + deltaY,
        };
        setDraggableData(d =>
          setTransformOnScroll(d, state.current.activeDraggable, {x: deltaX, y: deltaY}, modifier)
        );
        setDraggableData(d =>
          setVisualTransformOnScroll(
            d,
            state.current.activeDraggable,
            {x: deltaX, y: deltaY},
            modifier
          )
        );
      } else {
        // get the container scroll position instead of the window scroll position
        const deltaX = 0;
        const deltaY = target.scrollTop - state.current.scrollPosition.y;
        state.current.scrollPosition = {
          x: target.scrollLeft,
          y: target.scrollTop,
        };
        state.current.rawTransform = {
          x: state.current.rawTransform.x + deltaX,
          y: state.current.rawTransform.y + deltaY,
        };
        setDraggableData(d =>
          setMousePosition(
            setTransformOnScroll(
              d,
              state.current.activeDraggable,
              state.current.rawTransform,
              modifier
            ),
            state.current.activeDraggable,
            {x: e.clientX, y: e.clientY}
          )
        );
      }
    },
    [modifier, draggables, draggableData]
  );

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && state.current.state !== 'idle') {
      state.current.state = 'idle';
      setDraggableData(d => resetDraggableState(d, state.current.activeDraggable));
      state.current.activeDraggable = null;
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('scroll', onScroll, true);
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [onMouseUp, onMouseMove, onScroll, onKeyDown]);

  const value = useMemo(
    () => ({
      draggables,
      droppables,
      draggableData,
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
      draggableData,
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

export function useDroppableData({id}: {id: string}) {
  const droppables = useContextSelector(DnDContext, ctx => ctx.droppables);
  return droppables[id];
}

export function useDraggable({id, fixed = false}: {id: string; fixed?: boolean}) {
  const ref = useRef<HTMLElement | null>(null);
  const _onMouseDown = useContextSelector(DnDContext, ctx => ctx.onMouseDown);
  // TODO: draggable couple potentially be undefined, but TS doesn't curently know that
  const draggable = useContextSelector(DnDContext, ctx => ctx.draggables[id]);
  const draggableData = useContextSelector(DnDContext, ctx => ctx.draggableData[id]);
  const registerDraggable = useContextSelector(DnDContext, ctx => ctx.registerDraggable);
  const unregisterDraggable = useContextSelector(DnDContext, ctx => ctx.unregisterDraggable);

  const setNodeRef = useCallback((node: HTMLElement | null) => {
    if (node) {
      ref.current = node;
    }
  }, []);

  const onMouseDown = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      _onMouseDown(id, draggable, {
        x: e.clientX,
        y: e.clientY,
        offsetX,
        offsetY,
        clientX: e.clientX,
        clientY: e.clientY,
      });
    },
    [_onMouseDown, id, draggable]
  );

  // The identity of the listeners object must not change,
  // otherwise the whole timetable will rerender
  const listeners = useMemo(() => ({onMouseDown}), [onMouseDown]);

  useEffect(() => {
    if (ref.current) {
      registerDraggable(id, fixed, ref);
    }

    return () => {
      unregisterDraggable(id);
    };
  }, [id, fixed, registerDraggable, unregisterDraggable]);

  const {transform, visualTransform, rect, initialScroll, mouse, initialOffset: offset} =
    draggableData || {};

  return {
    setNodeRef,
    transform,
    visualTransform: transform ? visualTransform : null,
    isDragging: !!transform,
    listeners,
    rect,
    initialScroll,
    mouse,
    offset,
    ref,
  };
}
