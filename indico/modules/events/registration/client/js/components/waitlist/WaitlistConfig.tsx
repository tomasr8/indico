// This file is part of Indico.
// Copyright (C) 2002 - 2025 CERN
//
// Indico is free software; you can redistribute it and/or
// modify it under the terms of the MIT License; see the
// LICENSE file for more details.

// import waitlistConfigUrl from 'indico-url:event_registration.registrations_manage_waitlist';

import React, {useState} from 'react';
import {Icon} from 'semantic-ui-react';
import {Translate} from 'indico/react/i18n';
import {indicoAxios, handleAxiosError} from 'indico/utils/axios';
import {FinalModalForm} from 'indico/react/forms/final-form';
import {FinalCheckbox} from 'indico/react/forms';

export default function WaitlistConfig({
  eventId,
  regformId,
  url,
}: {
  eventId: number;
  regformId: number;
  url: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  const onClick = () => {
    indicoAxios
      .get(waitlistConfigUrl({eventId, regformId}))
      .then(config => {
        // Handle success
      })
      .catch(handleAxiosError);
  };

  const handleSubmit = () => {};

  return (
    <>
      <button type="button" onClick={() => setModalOpen(true)}>
        <Translate>Configure waitlist</Translate>
      </button>
      {modalOpen && (
        <FinalModalForm
          id="waitlist-config-modal"
          header={Translate.string('Configure waitlist')}
          onClose={() => setModalOpen(false)}
          onSubmit={handleSubmit}
          submitLabel={Translate.string('Save')}
          initialValues={{}}
        >
          <FinalCheckbox label={Translate.string('Enabled')} name="enabled" showAsToggle />
        </FinalModalForm>
      )}
    </>
  );
}
