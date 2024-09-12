// import momentjs
import {useDraggable, useDroppable} from '@dnd-kit/core';
import moment from 'moment';
import React, {useEffect, useRef, useState, MouseEvent as SyntheticMouseEvent} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {layout} from './layout';
import {ChildEntry, ContribEntry, BreakEntry, BlockEntry} from './types';
import {minutesToPixels, pixelsToMinutes} from './utils';
import * as actions from './actions';
import * as selectors from './selectors';

import './DayTimetable.module.scss';
import {TimetablePopup} from './entry_popups';

interface _DraggableEntryProps {
  selected: boolean;
  setDuration: (duration: number) => void;
  parentEndDt?: moment.Moment;
}

type DraggableEntryProps = _DraggableEntryProps & (ContribEntry | BreakEntry);
type DraggableBlockEntryProps = _DraggableEntryProps &
  BlockEntry & {setChildDuration: (childId: number, duration: number) => void};

const gridSize = minutesToPixels(5);

function ResizeHandle({
  forBlock = false,
  duration,
  minDuration,
  maxDuration,
  resizeStartRef,
  setLocalDuration,
  setGlobalDuration,
  setIsResizing,
}: {
  forBlock: boolean;
  duration: number;
  minDuration?: number;
  maxDuration?: number;
  resizeStartRef: React.MutableRefObject<number | null>;
  setLocalDuration: (d: number) => void;
  setGlobalDuration: (d: number) => void;
  setIsResizing: (b: boolean) => void;
}) {
  function resizeHandler(e: SyntheticMouseEvent) {
    e.stopPropagation();
    console.log('stopped propagation');
    resizeStartRef.current = e.clientY;
    document.body.style.cursor = 'ns-resize';
    setIsResizing(true);

    function mouseMoveHandler(e: MouseEvent) {
      if (resizeStartRef.current === null) {
        return;
      }

      let dy = e.clientY - resizeStartRef.current;
      dy = Math.ceil(dy / gridSize) * gridSize;
      const newDuration = duration + pixelsToMinutes(dy);
      if (newDuration >= 10) {
        setLocalDuration(newDuration);
      }
    }

    const mouseUpHandler = (e: MouseEvent) => {
      document.removeEventListener('mouseup', mouseUpHandler);
      document.removeEventListener('mousemove', mouseMoveHandler);
      document.body.style.cursor = '';

      if (resizeStartRef.current === null) {
        return;
      }

      let dy = e.clientY - resizeStartRef.current;
      dy = Math.ceil(dy / gridSize) * gridSize;
      const newDuration = duration + pixelsToMinutes(dy);

      if (
        (minDuration && newDuration < minDuration) ||
        (maxDuration && newDuration > maxDuration)
      ) {
        setLocalDuration(duration); // reset to original duration
      } else if (newDuration >= 10) {
        setGlobalDuration(newDuration);
      }
      setIsResizing(false);
    };

    document.addEventListener('mousemove', mouseMoveHandler);
    document.addEventListener('mouseup', mouseUpHandler);
  }

  return (
    <div
      styleName={`resize-handle ${forBlock ? 'block' : ''}`}
      onMouseDown={resizeHandler}
      onPointerDown={e => {
        e.stopPropagation(); // prevent drag start on the parent blokck
      }}
    />
  );
}

function snap(x: number, gridSize: number = 5) {
  return Math.ceil(x / gridSize) * gridSize;
}

export function DraggableEntry({
  type,
  id,
  startDt,
  duration: _duration,
  title,
  selected,
  x,
  y,
  width,
  column,
  maxColumn,
  setDuration: _setDuration,
  parentEndDt,
}: DraggableEntryProps) {
  const dispatch = useDispatch();
  const resizeStartRef = useRef<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const popupsEnabled = useSelector(selectors.getPopupsEnabled);
  const [open, setOpen] = useState(!!selected);
  const [duration, setDuration] = useState(_duration);
  const popupRef = useRef<HTMLButtonElement | null>(null);
  const {attributes, listeners, setNodeRef, transform, isDragging} = useDraggable({
    id,
  });
  let style: Record<string, string | number | undefined> = transform
    ? {
        transform: `translate3d(${transform.x}px, ${snap(transform.y, 10)}px, 0)`,
        zIndex: 900,
      }
    : {};
  style = {
    ...style,
    position: 'absolute',
    top: y,
    left: x,
    width: column === maxColumn ? width : `calc(${width} - 6px)`,
    height: minutesToPixels(duration - 2),
    zIndex: isResizing ? 900 : selected ? 800 : style.zIndex,
    cursor: isResizing ? undefined : isDragging ? 'grabbing' : 'grab',
    filter: selected ? 'drop-shadow(0 0 2px #000)' : undefined,
  };

  // if (transform) {
  //   console.log('transform.y', transform.y);
  // }
  const deltaMinutes = snap(pixelsToMinutes(transform ? transform.y : 0));
  const newStart = moment(startDt)
    .add(deltaMinutes, 'minutes')
    .format('HH:mm');
  const newEnd = moment(startDt)
    .add(deltaMinutes + duration, 'minutes')
    .format('HH:mm');

  const closePopup = () => {
    setOpen(false);
    dispatch(actions.selectEntry(null));
  };

  useEffect(() => {
    if (selected) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [selected, setOpen]);

  useEffect(() => {
    setDuration(_duration);
  }, [_duration]);

  // console.log(listeners);

  const trigger = (
    <button
      ref={popupRef}
      type="button"
      styleName={`entry ${type === 'break' ? 'break' : ''}`}
      style={style}
    >
      <div
        styleName="drag-handle"
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        onClick={e => {
          e.stopPropagation();
          dispatch(actions.selectEntry(id));
        }}
      >
        <ContributionTitle title={title} start={newStart} end={newEnd} duration={duration} />
      </div>
      <ResizeHandle
        duration={duration}
        maxDuration={parentEndDt ? parentEndDt.diff(startDt, 'minutes') : undefined}
        resizeStartRef={resizeStartRef}
        setLocalDuration={setDuration}
        setGlobalDuration={_setDuration}
        setIsResizing={setIsResizing}
      />
    </button>
  );

  if (!popupsEnabled) {
    return trigger;
  }

  return (
    <>
      {trigger}
      {!!popupRef.current && (
        <TimetablePopup
          open={open}
          onClose={closePopup}
          entry={{type, id, startDt, duration, title}}
          type={type}
          rect={popupRef.current.getBoundingClientRect()}
        />
      )}
    </>
  );
}

function ContributionTitle({
  title,
  start,
  end,
  duration,
}: {
  title: string;
  start: string;
  end: string;
  duration: number;
}) {
  if (duration <= 10) {
    return (
      <div style={{whiteSpace: 'nowrap', lineHeight: '1em', paddingLeft: 8}}>
        {title}, {start} - {end}
      </div>
    );
  } else if (duration <= 20) {
    return (
      <div style={{whiteSpace: 'nowrap', padding: '4px 8px'}}>
        {title}, {start} - {end}
      </div>
    );
  }
  return (
    <div style={{padding: '4px 8px'}}>
      <div>{title}</div>
      <div>
        {start} - {end}
      </div>
    </div>
  );
}

export function DraggableBlockEntry({
  id,
  startDt,
  duration: _duration,
  title,
  selected,
  x,
  y,
  width,
  column,
  maxColumn,
  children: _children,
  setDuration: _setDuration,
  setChildDuration,
}: DraggableBlockEntryProps) {
  const dispatch = useDispatch();
  const selectedId = useSelector(selectors.getSelectedId);
  const mouseEventRef = useRef<MouseEvent | null>(null);
  const resizeStartRef = useRef(null);
  const [isResizing, setIsResizing] = useState(false);
  const [duration, setDuration] = useState(_duration);
  const {attributes, listeners, setNodeRef, transform, isDragging} = useDraggable({
    id,
  });
  const {setNodeRef: setDroppableNodeRef} = useDroppable({
    id,
    disabled: true,
  });
  let style: Record<string, string | number | undefined> = transform
    ? {
        transform: `translate3d(${transform.x}px, ${snap(transform.y, 10)}px, 0)`,
        zIndex: 900,
      }
    : {};
  style = {
    ...style,
    position: 'absolute',
    top: y,
    left: x,
    width: column === maxColumn ? width : `calc(${width} - 6px)`,
    height: minutesToPixels(duration - 2),
    textAlign: 'left',
    zIndex: isResizing ? 900 : selected ? 800 : style.zIndex,
    filter: selected ? 'drop-shadow(0 0 2px #000)' : undefined,
  };

  useEffect(() => {
    function onMouseMove(event: MouseEvent) {
      mouseEventRef.current = event;
    }

    document.addEventListener('mousemove', onMouseMove);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  const deltaMinutes = snap(pixelsToMinutes(transform ? transform.y : 0));
  const newStart = moment(startDt)
    .add(deltaMinutes, 'minutes')
    .format('HH:mm');
  const newEnd = moment(startDt)
    .add(deltaMinutes + duration, 'minutes')
    .format('HH:mm');

  // shift children startDt by deltaMinutes
  const children = _children.map(child => ({
    ...child,
    startDt: moment(child.startDt).add(deltaMinutes, 'minutes'),
  }));

  const makeSetDuration = (id: number) => (d: number) => setChildDuration(id, d);

  const latestChildEndDt = children.reduce((acc, child) => {
    const endDt = moment(child.startDt).add(child.duration, 'minutes');
    return endDt.isAfter(acc) ? endDt : acc;
  }, moment(startDt));

  // console.log('listeners', listeners);

  return (
    <button type="button" styleName="entry block" style={style}>
      <div
        styleName="drag-handle"
        ref={setNodeRef}
        style={{
          cursor: isResizing ? undefined : isDragging ? 'grabbing' : 'grab',
          display: 'flex',
          padding: 0,
        }}
        {...listeners}
        {...attributes}
        onClick={e => {
          e.stopPropagation();
          dispatch(actions.selectEntry(id));
        }}
      >
        <div style={{padding: '4px 8px'}}>
          <SessionBlockTitle title={title} start={newStart} end={newEnd} />
        </div>
        <div
          ref={setDroppableNodeRef}
          style={{
            flexGrow: 1,
            position: 'relative',
            borderRadius: 6,
          }}
        >
          {children.map(child => (
            <DraggableEntry
              key={child.id}
              selected={child.id === selectedId}
              setDuration={makeSetDuration(child.id)}
              parentEndDt={moment(startDt).add(deltaMinutes + duration, 'minutes')}
              {...child}
            />
          ))}
        </div>
      </div>
      {/* TODO cannot resize to be smaller than its contents */}
      <ResizeHandle
        forBlock
        duration={duration}
        minDuration={latestChildEndDt.diff(startDt, 'minutes')}
        resizeStartRef={resizeStartRef}
        setLocalDuration={setDuration}
        setGlobalDuration={_setDuration}
        setIsResizing={setIsResizing}
      />
    </button>
  );
}

function SessionBlockTitle({title, start, end}: {title: string; start: string; end: string}) {
  return (
    <div>
      {title} ({start} - {end})
    </div>
  );
}
