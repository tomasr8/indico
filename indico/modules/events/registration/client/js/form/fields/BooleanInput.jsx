// This file is part of Indico.
// Copyright (C) 2002 - 2021 CERN
//
// Indico is free software; you can redistribute it and/or
// modify it under the terms of the MIT License; see the
// LICENSE file for more details.

import PropTypes from 'prop-types';
import React, {useState} from 'react';
import {useSelector} from 'react-redux';
import {Dropdown, Form, Label} from 'semantic-ui-react';

import {FinalDropdown, FinalInput, validators as v} from 'indico/react/forms';
import {Translate} from 'indico/react/i18n';

import {getCurrency} from '../../form_setup/selectors';

import '../../../styles/regform.module.scss';

export default function BooleanInput({
  htmlName,
  disabled,
  title,
  isRequired,
  defaultValue,
  price,
  placesLimit,
}) {
  const [value, setValue] = useState(defaultValue);
  const currency = useSelector(getCurrency);
  const options = [
    {
      key: 'yes',
      value: 'yes',
      text: Translate.string('Yes'),
      description: price ? `${price.toFixed(2)} ${currency}` : null,
    },
    {
      key: 'no',
      value: 'no',
      text: Translate.string('No'),
    },
  ];

  return (
    <Form.Field required={isRequired} disabled={disabled} styleName="field">
      <label>{title}</label>
      <div styleName="boolean-field">
        <Dropdown
          selection
          fluid
          options={options}
          name={htmlName}
          defaultValue={defaultValue}
          onChange={(_, {value: newValue}) => setValue(newValue)}
        />
        {!!price && value === 'yes' && (
          <Label pointing="left" styleName="price-tag">
            {price.toFixed(2)} {currency}
          </Label>
        )}
        {placesLimit}
      </div>
    </Form.Field>
  );
}

BooleanInput.propTypes = {
  htmlName: PropTypes.string.isRequired,
  disabled: PropTypes.bool,
  title: PropTypes.string.isRequired,
  isRequired: PropTypes.bool,
  defaultValue: PropTypes.string,
  price: PropTypes.number,
  placesLimit: PropTypes.number,
};

BooleanInput.defaultProps = {
  disabled: false,
  isRequired: false,
  defaultValue: '',
  price: 0,
  placesLimit: 0,
};

export function BooleanSettings() {
  const options = [
    {key: 'yes', value: 'yes', text: Translate.string('Yes')},
    {key: 'no', value: 'no', text: Translate.string('No')},
  ];
  return (
    <>
      <FinalInput
        name="placesLimit"
        type="number"
        label={Translate.string('Places limit')}
        placeholder={Translate.string('None')}
        step="1"
        min="1"
        validate={v.optional(v.min(0))}
        parse={val => (val === '' ? 0 : val)}
        format={val => (val === 0 ? '' : val)}
      />
      <FinalDropdown
        name="defaultValue"
        label={Translate.string('Default value')}
        options={options}
        placeholder={Translate.string('None')}
        selection
      />
    </>
  );
}
