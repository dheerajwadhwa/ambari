#!/usr/bin/env python

'''
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
'''
from mock.mock import MagicMock, call, patch
from stacks.utils.RMFTestCase import *

class TestSqoopServiceCheck(RMFTestCase):

  def test_service_check_secured(self):
    self.executeScript("2.0.6/services/SQOOP/package/scripts/service_check.py",
                       classname = "SqoopServiceCheck",
                       command = "service_check",
                       config_file="secured.json"
    )
    self.assertResourceCalled('Execute', '/usr/bin/kinit  -kt /etc/security/keytabs/smokeuser.headless.keytab ambari-qa',
                              user = 'ambari-qa'
    )
    self.assertResourceCalled('Execute', 'sqoop version',
                              logoutput = True,
                              path = ['/usr/bin'],
                              user = 'ambari-qa',)
    self.assertNoMoreResources()

  def test_service_check_default(self):
    self.executeScript("2.0.6/services/SQOOP/package/scripts/service_check.py",
                       classname = "SqoopServiceCheck",
                       command = "service_check",
                       config_file="default.json"
    )
    self.assertResourceCalled('Execute', 'sqoop version',
                              logoutput = True,
                              path = ['/usr/bin'],
                              user = 'ambari-qa',)
    self.assertNoMoreResources()




