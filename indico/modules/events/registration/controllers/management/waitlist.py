# This file is part of Indico.
# Copyright (C) 2002 - 2025 CERN
#
# Indico is free software; you can redistribute it and/or
# modify it under the terms of the MIT License; see the
# LICENSE file for more details.

from flask import flash, jsonify, redirect, request, session
from pkg_resources import require

from indico.core.db import db
from indico.modules.events.registration import logger
from indico.modules.events.registration.controllers.management import RHManageRegFormsBase
from indico.modules.events.registration.controllers.management.reglists import RHRegistrationsActionBase
from indico.modules.events.registration.forms import RegistrationTagForm, RegistrationTagsAssignForm
from indico.modules.events.registration.models.tags import RegistrationTag
from indico.modules.events.registration.views import WPManageRegistration
from indico.util.i18n import _
from indico.util.marshmallow import ModelList
from indico.web.args import use_kwargs, use_rh_kwargs
from indico.web.flask.util import url_for
from indico.web.util import jsonify_data, jsonify_form
from indico.modules.events.registration import registration_settings
from webargs import fields, validate


class RHManageWaitlistsBase(RHManageRegFormsBase):
    def _process_args(self):
        RHManageRegFormsBase._process_args(self)


class RHManageWaitlist(RHManageWaitlistsBase):
    """Manage waitlist settings for a registration form."""

    def _process_GET(self):
        return jsonify({'enabled': True})

    @use_kwargs({'enabled': fields.Bool(required=True)})
    def _process_POST(self, enabled):
        """Update waitlist settings."""
        # registration_settings.set(self.event, 'waitlist_settings', {'enabled': enabled})
        # flash(_('Waitlist settings updated.'), 'success')
        # return jsonify_data(flash=False)
        return jsonify({'enabled': True})
