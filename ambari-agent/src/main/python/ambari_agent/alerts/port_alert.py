#!/usr/bin/env python

"""
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
"""

import logging
import socket
import time
from alerts.base_alert import BaseAlert
from resource_management.libraries.functions.get_port_from_url import get_port_from_url

logger = logging.getLogger()

# default timeouts
DEFAULT_WARNING_TIMEOUT = 1.5
DEFAULT_CRITICAL_TIMEOUT = 5.0

class PortAlert(BaseAlert):

  def __init__(self, alert_meta, alert_source_meta):
    super(PortAlert, self).__init__(alert_meta, alert_source_meta)

    self.uri = None
    self.default_port = None
    self.warning_timeout = DEFAULT_WARNING_TIMEOUT
    self.critical_timeout = DEFAULT_CRITICAL_TIMEOUT

    # can be parameterized or static
    if 'uri' in alert_source_meta:
      self.uri = self._find_lookup_property(alert_source_meta['uri'])

    # always static
    if 'default_port' in alert_source_meta:
      self.default_port = alert_source_meta['default_port']

    if 'reporting' in alert_source_meta:
      reporting = alert_source_meta['reporting']
      reporting_state_warning = self.RESULT_WARNING.lower()
      reporting_state_critical = self.RESULT_CRITICAL.lower()

      if reporting_state_warning in reporting and \
        'value' in reporting[reporting_state_warning]:
        self.warning_timeout = reporting[reporting_state_warning]['value']

      if reporting_state_critical in reporting and \
        'value' in reporting[reporting_state_critical]:
        self.critical_timeout = reporting[reporting_state_critical]['value']


    # check warning threshold for sanity
    if self.warning_timeout >= 30:
      logger.warn("The alert warning threshold of {0}s is too large, resetting to {1}s".format(
        str(self.warning_timeout), str(DEFAULT_WARNING_TIMEOUT)))

      self.warning_timeout = DEFAULT_WARNING_TIMEOUT


    # check critical threshold for sanity
    if self.critical_timeout >= 30:
      logger.warn("The alert critical threshold of {0}s is too large, resetting to {1}s".format(
        str(self.critical_timeout), str(DEFAULT_CRITICAL_TIMEOUT)))

      self.critical_timeout = DEFAULT_CRITICAL_TIMEOUT


  def _collect(self):
    # if not parameterized, this will return the static value
    uri_value = self._lookup_property_value(self.uri)
    if uri_value is None:
      uri_value = self.host_name

    # in some cases, a single property is a comma-separated list like
    # host1:8080,host2:8081,host3:8083
    uri_value_array = uri_value.split(',')
    if len(uri_value_array) > 1:
      for item in uri_value_array:
        if item.startswith(self.host_name):
          uri_value = item

    host = BaseAlert.get_host_from_url(uri_value)
    if host is None:
      host = self.host_name

    try:
      port = int(get_port_from_url(uri_value))
    except:
      if self.default_port is None:
        label = 'Unable to determine port from URI {0}'.format(uri_value)
        return (self.RESULT_UNKNOWN, [label])

      port = self.default_port


    if logger.isEnabledFor(logging.DEBUG):
      logger.debug("checking {0} listening on port {1}".format(host, str(port)))
    
    try:
      s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
      s.settimeout(self.critical_timeout)

      t = time.time()
      s.connect((host, port))
      milliseconds = time.time() - t
      seconds = milliseconds/1000.0

      # not sure why this happens sometimes, but we don't always get a
      # socket exception if the connect() is > than the critical threshold
      if seconds >= self.critical_timeout:
        return (self.RESULT_CRITICAL, ['Socket Timeout', host, port])

      result = self.RESULT_OK
      if seconds >= self.warning_timeout:
        result = self.RESULT_WARNING

      return (result, [seconds, port])
    except Exception as e:
      return (self.RESULT_CRITICAL, [str(e), host, port])
    finally:
      if s is not None:
        try:
          s.close()
        except:
          # no need to log a close failure
          pass

  def _get_reporting_text(self, state):
    '''
    Gets the default reporting text to use when the alert definition does not
    contain any.
    :param state: the state of the alert in uppercase (such as OK, WARNING, etc)
    :return:  the parameterized text
    '''
    if state == self.RESULT_OK or state == self.RESULT_WARNING:
      return 'TCP OK - {0:.4f} response on port {1}'

    return 'Connection failed: {0} to {1}:{2}'