// This file is part of Indico.
// Copyright (C) 2002 - 2024 CERN
//
// Indico is free software; you can redistribute it and/or
// modify it under the terms of the MIT License; see the
// LICENSE file for more details.

import moment from 'moment';
import React, {useEffect, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {Checkbox} from 'semantic-ui-react';

import * as actions from './actions';
import Entry from './Entry';
import EntryDetails from './EntryDetails';
import ContributionEntryForm from './forms/ContributionEntryForm';
import {entryStyleGetter, layoutAlgorithm} from './layout-old';
import * as selectors from './selectors';
import Toolbar from './Toolbar';
import UnscheduledContributions from './UnscheduledContributions';

import 'react-big-calendar/lib/addons/dragAndDrop/styles.scss';

import './Timetable.module.scss';
import {getEarliestDate} from './utils';
import {DayTimetable} from './DayTimetable';
import {WeekTimetable} from './WeekTimetable';

// const localizer = momentLocalizer(moment);
// const DnDCalendar = withDragAndDrop(Calendar);

export default function Timetable() {
  const dispatch = useDispatch();
  const displayMode = useSelector(selectors.getDisplayMode);
  const entries = useSelector(selectors.getDayEntries);
  // const blocks = useSelector(selectors.getBlocks);
  const selectedId = useSelector(selectors.getSelectedId);
  // const draggedContribs = useSelector(selectors.getDraggedContribs);
  const [date, setDate] = useState(moment(getEarliestDate(Object.keys(entries))));
  const [placeholderEntry, setPlaceholderEntry] = useState(null);
  const currentDateEntries = entries[date.format('YYYYMMDD')];
  let selectedEntry = currentDateEntries.find(e => e.id === selectedId);
  if (!selectedEntry) {
    selectedEntry = currentDateEntries
      .flatMap(e => (e.type === 'block' ? e.children : []))
      .find(e => e.id === selectedId);
  }
  const popupsEnabled = useSelector(selectors.getPopupsEnabled);

  const useWeekView = true;

  const minHour = Math.max(
    0,
    useWeekView
      ? Math.min(
          ...Object.values(entries)
            .flat()
            .map(e => moment(e.startDt).hour())
        ) - 1
      : Math.min(...currentDateEntries.map(e => moment(e.startDt).hour())) - 1
  );
  const maxHour = Math.min(
    24,
    useWeekView
      ? Math.max(
          ...Object.values(entries)
            .flat()
            .map(e =>
              moment(e.startDt)
                .add(e.duration, 'minutes')
                .hour()
            )
        ) + 1
      : Math.max(
          ...currentDateEntries.map(e =>
            moment(e.startDt)
              .add(e.duration, 'minutes')
              .hour()
          )
        ) + 1
  );

  console.log('minHour', minHour, 'maxHour', maxHour);

  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 'z') {
        dispatch(actions.undoChange());
      } else if (e.ctrlKey && e.key === 'y') {
        dispatch(actions.redoChange());
      }
    }

    document.addEventListener('keydown', onKeydown);
    return () => document.removeEventListener('keydown', onKeydown);
  }, [dispatch]);

  return (
    <div styleName={`timetable ${displayMode}`}>
      <div style={{height: 50}}>
        <Checkbox
          toggle
          checked={popupsEnabled}
          onChange={() => dispatch(actions.experimentalTogglePopups())}
          label="Experminetal: Use popups instead of sidebar"
        />
      </div>
      <Toolbar date={date} onNavigate={d => setDate(d)} />
      <div styleName="content">
        {useWeekView && <WeekTimetable minHour={minHour} maxHour={maxHour} entries={entries} />}
        {!useWeekView && (
          <DayTimetable
            dt={date}
            minHour={minHour}
            maxHour={maxHour}
            entries={currentDateEntries}
          />
        )}
        {!popupsEnabled && selectedEntry && <EntryDetails entry={selectedEntry} />}
        <ContributionEntryForm />
      </div>
    </div>
  );
}
