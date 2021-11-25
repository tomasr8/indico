// This file is part of Indico.
// Copyright (C) 2002 - 2021 CERN
//
// Indico is free software; you can redistribute it and/or
// modify it under the terms of the MIT License; see the
// LICENSE file for more details.

import PropTypes from 'prop-types';
import React from 'react';
import {Form} from 'semantic-ui-react';

import '../../../styles/regform.module.scss';

export default function FileInput({htmlName, disabled, title, isRequired}) {
  return (
    <Form.Field required={isRequired} disabled={disabled} styleName="field">
      <label>{title}</label>
      <input type="file" name={htmlName} />
    </Form.Field>
  );
}

FileInput.propTypes = {
  htmlName: PropTypes.string.isRequired,
  disabled: PropTypes.bool,
  title: PropTypes.string.isRequired,
  isRequired: PropTypes.bool.isRequired,
};

FileInput.defaultProps = {
  disabled: false,
};
