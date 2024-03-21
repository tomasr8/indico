// This file is part of Indico.
// Copyright (C) 2002 - 2024 CERN
//
// Indico is free software; you can redistribute it and/or
// modify it under the terms of the MIT License; see the
// LICENSE file for more details.

import moment from 'moment';
import React, {useState} from 'react';
import {Calendar, momentLocalizer} from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import {useDispatch, useSelector} from 'react-redux';

import {toClasses} from 'indico/react/util';

import * as actions from './actions';
import Entry from './Entry';
import EntryDetails from './EntryDetails';
import {entryStyleGetter, layoutAlgorithm} from './layout';
import * as selectors from './selectors';
import Toolbar from './Toolbar';
import {isChildOf} from './util';

import 'react-big-calendar/lib/addons/dragAndDrop/styles.scss';

import './Timetable.module.scss';

const localizer = momentLocalizer(moment);
const DnDCalendar = withDragAndDrop(Calendar);

export default function Timetable() {
  const dispatch = useDispatch();
  const displayMode = useSelector(selectors.getDisplayMode);
  const entries = useSelector(selectors.getAllEntries);
  const blocks = useSelector(selectors.getBlocks);
  const selected = useSelector(selectors.getSelectedEntry);
  const [date, setDate] = useState(
    entries.reduce((min, {start}) => (start < min ? start : min), entries[0].start)
  );
  const currentDateEntries = entries.filter(e => e.start.getDate() === date.getDate());
  const numColumns = Math.max(...currentDateEntries.map(e => e.columnId).filter(e => e), 1);

  const minHour = currentDateEntries.reduce((min, {start}) => {
    const hours = start.getHours();
    if (hours > min) {
      return min;
    }
    return start.getMinutes() === 0 ? hours - 1 : hours;
  }, 9);

  const maxHour = currentDateEntries.reduce((max, {end}) => {
    const hours = end.getHours();
    if (hours < max - 1) {
      return max;
    }
    return end.getMinutes() === 0 ? hours + 1 : hours + 2;
  }, 17);

  return (
    <div styleName={toClasses({timetable: true, compact: displayMode === 'compact'})}>
      <DnDCalendar
        date={date}
        defaultView="day"
        events={entries}
        localizer={localizer}
        views={{day: true}}
        components={{toolbar: Toolbar, event: Entry}}
        resources={[...Array(numColumns).keys()].map(n => ({id: n + 1}))}
        onEventDrop={args => dispatch(actions.moveEntry(args))}
        onEventResize={args => dispatch(actions.resizeEntry(args))}
        onSelectSlot={(...args) => {
          dispatch(actions.selectEntry(null));
          console.debug('onSelectSlot', ...args);
        }}
        onSelectEvent={e => dispatch(actions.selectEntry(e))}
        onNavigate={setDate}
        eventPropGetter={entryStyleGetter(entries, selected)}
        dayLayoutAlgorithm={layoutAlgorithm(entries, numColumns, displayMode === 'compact')}
        allDayMaxRows={0}
        step={5}
        timeslots={6}
        min={new Date(1972, 0, 1, minHour, 0, 0)}
        max={new Date(1972, 0, 1, maxHour, 0, 0)}
        tooltipAccessor={null}
        resourceAccessor={e => e.columnId || blocks.find(p => isChildOf(e, p)).columnId}
        resizable
        selectable
      />
      {selected && <EntryDetails />}
    </div>
  );
}
