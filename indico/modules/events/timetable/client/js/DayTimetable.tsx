import {
  DndContext,
  // useDroppable,
  pointerWithin,
  DragEndEvent,
  useSensor,
  PointerSensor,
  useSensors,
} from '@dnd-kit/core';
import {createSnapModifier, restrictToParentElement} from '@dnd-kit/modifiers';
import moment, {Moment} from 'moment';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import './DayTimetable.module.scss';
import * as actions from './actions';
import * as selectors from './selectors';
import {DraggableBlockEntry, DraggableEntry} from './Entry';
import {computeYoffset, getGroup, layout, layoutGroupAfterMove} from './layout';
import {TopLevelEntry, BlockEntry, ChildEntry} from './types';
import {minutesToPixels, pixelsToMinutes} from './utils';
import UnscheduledContributions from './UnscheduledContributions';
import {useDroppable, DnDProvider} from './dnd/dnd';
import {createRestrictToElement} from './dnd';

interface DayTimetableProps {
  dt: Moment;
  minHour: number;
  maxHour: number;
  entries: TopLevelEntry[];
}

function TopLevelEntries({dt, entries}: {dt: Moment; entries: TopLevelEntry[]}) {
  const dispatch = useDispatch();
  const selectedId = useSelector(selectors.getSelectedId);

  const makeSetDuration = useCallback(
    (id: number) => (duration: number) => {
      const newEntries = layout(
        entries.map(entry => {
          if (entry.id === id) {
            return {
              ...entry,
              duration,
            };
          }
          return entry;
        })
      );
      dispatch(actions.resizeEntry(dt.format('YYYYMMDD'), newEntries));
    },
    [dispatch, entries, dt]
  );

  const makeSetChildDuration = useCallback(
    (parentId: number) => (childId: number, duration: number) => {
      const newEntries = layout(
        entries.map(entry => {
          if (entry.type === 'block' && entry.id === parentId) {
            return {
              ...entry,
              children: entry.children.map(child => {
                if (child.id === childId) {
                  return {
                    ...child,
                    duration: moment(entry.startDt)
                      .add(duration, 'minutes')
                      .isBefore(moment(child.startDt).add(entry.duration, 'minutes'))
                      ? duration
                      : entry.duration,
                  };
                }
                return child;
              }),
            };
          }
          return entry;
        })
      );
      dispatch(actions.resizeEntry(dt.format('YYYYMMDD'), newEntries));
    },
    [dispatch, entries, dt]
  );

  const fn = useCallback(() => {}, []);

  return (
    <>
      {entries.map(entry =>
        entry.type === 'block' ? (
          <DraggableBlockEntry
            key={entry.id}
            selected={selectedId === entry.id}
            // setDuration={fn}
            // setChildDuration={fn}
            setDuration={makeSetDuration(entry.id)}
            setChildDuration={makeSetChildDuration(entry.id)}
            {...entry}
          />
        ) : (
          <DraggableEntry
            key={entry.id}
            // x={entry.x}
            // y={entry.y}
            // type={entry.type}
            // title={entry.title}
            // duration={entry.duration}
            // id={entry.id}
            // setDuration={fn}
            setDuration={makeSetDuration(entry.id)}
            {...entry}
          />
        )
      )}
    </>
  );
}

const MemoizedTopLevelEntries = React.memo(TopLevelEntries);

export function DayTimetable({dt, minHour, maxHour, entries}: DayTimetableProps) {
  const dispatch = useDispatch();
  const mouseEventRef = useRef<MouseEvent | null>(null);
  const gridSize = minutesToPixels(5);
  const snapToGridModifier = createSnapModifier(gridSize);
  const selectedId = useSelector(selectors.getSelectedId);
  const unscheduled = useSelector(selectors.getUnscheduled);
  const calendarRef = useRef<HTMLDivElement | null>(null);
  // const dnd = useSelector(state => state.dnd);
  // console.log('DND', dnd);

  function modifier(...args) {
    const result = snapToGridModifier(...args);
    // console.log(args, result);
    return result;
  }

  entries = computeYoffset(entries, minHour);

  function handleDragEnd(who, where, delta, mouse, rect) {
    console.log('handleDragEnd', who, where, delta, mouse, rect);
    if (where === 'calendar') {
      handleDropOnCalendar(who, delta, mouse, rect);
    } else {
      // handleDropOnBlock(event);
    }
  }

  function handleUnscheduledDrop(event: DragEndEvent) {
    const {id: _id} = event.active;
    const id = parseInt((_id as string).slice('unscheduled-'.length), 10);
    const {x, y} = event.delta;
    const deltaMinutes = pixelsToMinutes(y);
    const mousePosition =
      (mouseEventRef.current.pageX - event.over.rect.left) / event.over.rect.width;
    const mousePositionY = mouseEventRef.current.pageY - event.over.rect.top - window.scrollY;

    // console.log(
    //   'mousePosition',
    //   mouseEventRef.current.pageY,
    //   event.over.rect.top,
    //   mousePositionY,
    //   moment(dt)
    //     .startOf('day')
    //     .add(pixelsToMinutes(mousePositionY), 'minutes')
    //     .format('HH:mm')
    // );
    const startDt = moment(dt)
      .startOf('day')
      .add(Math.ceil(pixelsToMinutes(mousePositionY) / 5) * 5, 'minutes');

    let entry = unscheduled.find(entry => entry.id === id);
    if (!entry) {
      return;
    }
    entry = {
      ...entry,
      startDt,
      x,
      // y: entry.y + y,
      y: minutesToPixels(
        moment(startDt)
          .add(deltaMinutes, 'minutes')
          .diff(moment(entry.startDt).startOf('day'), 'minutes')
      ),
    };

    const groupIds = getGroup(entry, entries);
    let group = entries.filter(e => groupIds.has(e.id));
    group = layoutGroupAfterMove(group, entry, mousePosition);

    const otherEntries = entries.filter(e => !groupIds.has(e.id) && e.id !== entry.id);
    dispatch(
      actions.scheduleEntry(
        dt.format('YYYYMMDD'),
        layout([...otherEntries, ...group]),
        unscheduled.filter(e => e.id !== id)
      )
    );
  }

  function handleDropOnCalendar(who, delta, mouse, rect) {
    // if (!event.over) {
    //   return; // not over any droppable area, the item will return back to its original position
    // }

    // if (mouseEventRef.current === null) {
    //   return;
    // }

    const id = who;

    // console.log('handleDropOnCalendar', id, typeof id, id.startsWith('unscheduled-'));

    // if (typeof id === 'string' && id.startsWith('unscheduled-')) {
    //   return handleUnscheduledDrop(event);
    // }

    const {x, y} = delta;
    const deltaMinutes = Math.ceil(pixelsToMinutes(y) / 5) * 5;
    // const mousePosition =
    //   (mouseEventRef.current.pageX - event.over.rect.left) / event.over.rect.width;
    const mousePosition = (mouse.pageX - rect.left) / rect.width;

    let entry = entries.find(entry => entry.id === id);
    let fromBlock: BlockEntry | undefined;
    if (!entry) {
      // maybe a break from inside a block
      fromBlock = entries
        .filter(e => e.type === 'block')
        .find(b => b.children.find(c => c.id === id));

      if (!fromBlock) {
        return;
      }

      entry = fromBlock.children.find(c => c.id === id);
      if (!entry || entry.type !== 'break') {
        return;
      }
    }

    if (entry.type === 'contrib' && entry.session) {
      return; // contributions with sessions assigned cannot be scheduled at the top level
    }

    entry = {
      ...entry,
      startDt: moment(entry.startDt).add(deltaMinutes, 'minutes'),
      x: entry.x + x,
      // y: entry.y + y,
      y: minutesToPixels(
        moment(entry.startDt)
          .add(deltaMinutes, 'minutes')
          .diff(moment(entry.startDt).startOf('day'), 'minutes')
      ),
    };
    if (entry.type === 'block') {
      entry = {
        ...entry,
        children: entry.children.map(e => ({
          ...e,
          startDt: moment(e.startDt).add(deltaMinutes, 'minutes'),
        })),
      };
    }

    const groupIds = getGroup(entry, entries.filter(e => e.id !== entry.id));
    let group = entries.filter(e => groupIds.has(e.id));
    group = layoutGroupAfterMove(group, entry, mousePosition);

    if (!fromBlock) {
      const otherEntries = entries.filter(e => !groupIds.has(e.id) && e.id !== entry.id);
      dispatch(actions.moveEntry(dt.format('YYYYMMDD'), layout([...otherEntries, ...group])));
    } else {
      const otherEntries = entries.filter(
        e => !groupIds.has(e.id) && e.id !== entry.id && e.id !== fromBlock.id
      );
      const fromChildren = fromBlock.children.filter(e => e.id !== entry.id);
      group = group.filter(e => e.id !== fromBlock.id); // might contain the block
      dispatch(
        actions.moveEntry(
          dt.format('YYYYMMDD'),
          layout([...otherEntries, ...group, {...fromBlock, children: fromChildren}])
        )
      );
    }
  }

  function handleDropOnBlock(event: DragEndEvent) {
    if (!event.over) {
      return;
    }

    if (mouseEventRef.current === null) {
      return;
    }

    console.log('handleDropOnBlock', event);

    const overId = event.over.id;
    const toBlock: BlockEntry = entries.find(entry => entry.id === overId)! as BlockEntry;
    const fromBlock = entries
      .filter(e => e.type === 'block')
      .find(entry => !!entry.children.find(c => c.id === event.active.id));

    console.log(overId, toBlock, fromBlock);

    const {id} = event.active;
    const {x, y} = event.delta;
    const deltaMinutes = Math.ceil(pixelsToMinutes(y) / 5) * 5;
    const mousePosition =
      (mouseEventRef.current.pageX - event.over.rect.left) / event.over.rect.width;

    let entry: ChildEntry | undefined;
    if (!fromBlock) {
      entry = entries.find(e => e.id === event.active.id) as ChildEntry; // TODO: fix this
      if (!entry || entry.type !== 'break') {
        return;
      }
    } else {
      entry = fromBlock.children.find(e => e.id === id);
    }

    if (!entry) {
      return;
    }

    if (entry.type === 'contrib' && (!entry.session || entry.session.id !== toBlock.session.id)) {
      return; // contributions cannot be moved to blocks of different sessions
    }

    entry = {
      ...entry,
      startDt: moment(entry.startDt).add(deltaMinutes, 'minutes'),
      x: entry.x + x,
      // y: entry.y + y,
      y: minutesToPixels(
        moment(entry.startDt)
          .add(deltaMinutes, 'minutes')
          .diff(moment(toBlock.startDt), 'minutes')
      ),
    };

    if (entry.startDt.isBefore(moment(toBlock.startDt))) {
      return;
    }
    if (
      moment(entry.startDt)
        .add(entry.duration, 'minutes')
        .isAfter(moment(toBlock.startDt).add(toBlock.duration, 'minutes'))
    ) {
      return;
    }

    const groupIds = getGroup(entry, toBlock.children.filter(e => e.id !== entry.id));
    let group = toBlock.children.filter(e => groupIds.has(e.id));
    group = layoutGroupAfterMove(group, entry, mousePosition);

    const otherChildren = toBlock.children.filter(e => !groupIds.has(e.id) && e.id !== entry.id);

    if (!fromBlock) {
      dispatch(
        actions.moveEntry(
          dt.format('YYYYMMDD'),
          layout([
            ...entries.filter(e => e.id !== entry.id && e.id !== toBlock.id),
            {...toBlock, children: [...otherChildren, ...group]},
          ])
        )
      );
    } else if (toBlock.id === fromBlock.id) {
      const otherEntries = entries.filter(e => e.id !== toBlock.id);
      dispatch(
        actions.moveEntry(
          dt.format('YYYYMMDD'),
          layout([...otherEntries, {...toBlock, children: [...otherChildren, ...group]}])
        )
      );
    } else {
      const otherEntries = entries.filter(e => e.id !== toBlock.id && e.id !== fromBlock.id);
      const fromChildren = fromBlock.children.filter(e => e.id !== entry.id);

      dispatch(
        actions.moveEntry(
          dt.format('YYYYMMDD'),
          layout([
            ...otherEntries,
            {...fromBlock, children: fromChildren},
            {...toBlock, children: [...otherChildren, ...group]},
          ])
        )
      );
    }
  }

  // useEffect(() => {

  //   dispatch(actions.registerOnDrop(handleDragEnd));
  // }, [dispatch, dt, entries, unscheduled]);

  // const makeSetDuration = (id: number) => (duration: number) => {
  //   const newEntries = layout(
  //     entries.map(entry => {
  //       if (entry.id === id) {
  //         return {
  //           ...entry,
  //           duration,
  //         };
  //       }
  //       return entry;
  //     })
  //   );
  //   dispatch(actions.resizeEntry(dt.format('YYYYMMDD'), newEntries));
  // };

  // const makeSetChildDuration = (parentId: number) => (childId: number, duration: number) => {
  //   const newEntries = layout(
  //     entries.map(entry => {
  //       if (entry.type === 'block' && entry.id === parentId) {
  //         return {
  //           ...entry,
  //           children: entry.children.map(child => {
  //             if (child.id === childId) {
  //               return {
  //                 ...child,
  //                 duration: moment(entry.startDt)
  //                   .add(duration, 'minutes')
  //                   .isBefore(moment(child.startDt).add(entry.duration, 'minutes'))
  //                   ? duration
  //                   : entry.duration,
  //               };
  //             }
  //             return child;
  //           }),
  //         };
  //       }
  //       return entry;
  //     })
  //   );
  //   dispatch(actions.resizeEntry(dt.format('YYYYMMDD'), newEntries));
  // };

  // Needed to get onClick events workings on draggable elements
  // https://github.com/clauderic/dnd-kit/issues/800
  const sensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 5,
    },
  });
  const sensors = useSensors(sensor);

  useEffect(() => {
    function onMouseMove(event: MouseEvent) {
      mouseEventRef.current = event;
    }

    // function onClick(event: MouseEvent) {
    //   dispatch(actions.selectEntry(null));
    // }

    document.addEventListener('mousemove', onMouseMove);
    // document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      // document.removeEventListener('click', onClick);
    };
  }, []);

  const restrictToCalendar = useMemo(() => createRestrictToElement(calendarRef), [calendarRef]);

  return (
    // <DndContext
    //   // autoScroll={{interval: minutesToPixels(5)}}
    //   onDragEnd={handleDragEnd}
    //   modifiers={[restrictToCalendar, modifier]}
    //   collisionDetection={pointerWithin}
    //   sensors={sensors}
    // >
    <DnDProvider onDrop={handleDragEnd} modifier={restrictToCalendar}>
      <UnscheduledContributions />
      <div styleName="wrapper">
        <TimeGutter minHour={minHour} maxHour={maxHour} />
        <DnDCalendar>
          <div ref={calendarRef}>
            <Lines minHour={minHour} maxHour={maxHour} />
            <MemoizedTopLevelEntries dt={dt} entries={entries} />
          </div>
        </DnDCalendar>
      </div>
    </DnDProvider>
    // </DndContext>
  );
}

interface TimeGutterProps {
  minHour: number;
  maxHour: number;
}

function Lines({minHour, maxHour}: TimeGutterProps) {
  const oneHour = minutesToPixels(60);

  return (
    <div styleName="lines">
      {Array.from({length: maxHour - minHour + 1}, (_, i) => (
        <div key={i} style={{height: oneHour}} styleName="line" />
      ))}
    </div>
  );
}

function TimeGutter({minHour, maxHour}: TimeGutterProps) {
  const oneHour = minutesToPixels(60);

  return (
    <div styleName="time-gutter">
      <div style={{height: 10}} />
      {Array.from({length: maxHour - minHour + 1}, (_, i) => (
        <TimeSlot key={i} height={oneHour} time={`${minHour + i}:00`} />
      ))}
    </div>
  );
}

function TimeSlot({height, time}: {height: number; time: string}) {
  return (
    <div styleName="time-slot" style={{height}}>
      <div>{time}</div>
    </div>
  );
}

function DnDCalendar({children}: {children: React.ReactNode}) {
  const {setNodeRef} = useDroppable({
    id: 'calendar',
  });

  return (
    <div ref={setNodeRef} styleName="calendar" style={{marginTop: 10}}>
      {children}
    </div>
  );
}
