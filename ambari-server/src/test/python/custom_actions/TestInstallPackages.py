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
import json
import os
import socket
from resource_management import Script,ConfigDictionary
from mock.mock import patch
from mock.mock import MagicMock
from stacks.utils.RMFTestCase import *
from install_packages import InstallPackages
from mock.mock import patch, MagicMock


class TestInstallPackages(RMFTestCase):

  @patch("resource_management.libraries.script.Script.put_structured_out")
  def test_normal_flow(self, put_structured_out):
    self.executeScript("scripts/install_packages.py",
                       classname="InstallPackages",
                       command="actionexecute",
                       config_file="install_packages_config.json",
                       target=RMFTestCase.TARGET_CUSTOM_ACTIONS,
                       os_type=('Suse', '11', 'Final'),
    )
    self.assertTrue(put_structured_out.called)
    self.assertEquals(put_structured_out.call_args[0][0],
                      {'package_installation_result': 'SUCCESS',
                       'installed_repository_version': u'2.2.0.1-885',
                       'ambari_repositories': []})
    self.assertResourceCalled('Repository', 'HDP-UTILS-2.2.0.1-885',
                              base_url='http://s3.amazonaws.com/dev.hortonworks.com/HDP/centos5/2.x/updates/2.2.0.0',
                              action=['create'],
                              components=[u'HDP-UTILS-1.1.0.20', 'main'],
                              repo_template='repo_suse_rhel.j2',
                              repo_file_name='HDP-UTILS-2.2.0.1-885',
                              mirror_list=None,
    )
    self.assertResourceCalled('Repository', 'HDP-2.2.0.1-885',
                              base_url='http://s3.amazonaws.com/dev.hortonworks.com/HDP/centos5/2.x/updates/2.2.0.0',
                              action=['create'],
                              components=[u'HDP-2.2', 'main'],
                              repo_template='repo_suse_rhel.j2',
                              repo_file_name='HDP-2.2.0.1-885',
                              mirror_list=None,
    )
    self.assertResourceCalled('Package', 'hadoop_2_2_*', use_repos=['base', 'HDP-UTILS-2.2.0.1-885', 'HDP-2.2.0.1-885'])
    self.assertResourceCalled('Package', 'snappy', use_repos=['base', 'HDP-UTILS-2.2.0.1-885', 'HDP-2.2.0.1-885'])
    self.assertResourceCalled('Package', 'snappy-devel', use_repos=['base', 'HDP-UTILS-2.2.0.1-885', 'HDP-2.2.0.1-885'])
    self.assertResourceCalled('Package', 'lzo', use_repos=['base', 'HDP-UTILS-2.2.0.1-885', 'HDP-2.2.0.1-885'])
    self.assertResourceCalled('Package', 'hadooplzo_2_2_*', use_repos=['base', 'HDP-UTILS-2.2.0.1-885', 'HDP-2.2.0.1-885'])
    self.assertResourceCalled('Package', 'hadoop_2_2_*-libhdfs', use_repos=['base', 'HDP-UTILS-2.2.0.1-885', 'HDP-2.2.0.1-885'])
    self.assertResourceCalled('Package', 'ambari-log4j', use_repos=['base', 'HDP-UTILS-2.2.0.1-885', 'HDP-2.2.0.1-885'])
    self.assertNoMoreResources()


  @patch("resource_management.libraries.functions.list_ambari_managed_repos.list_ambari_managed_repos",
         new=MagicMock(return_value=["HDP-UTILS-2.2.0.1-885"]))
  @patch("resource_management.libraries.script.Script.put_structured_out")
  def test_exclude_existing_repo(self, put_structured_out):
    self.executeScript("scripts/install_packages.py",
                       classname="InstallPackages",
                       command="actionexecute",
                       config_file="install_packages_config.json",
                       target=RMFTestCase.TARGET_CUSTOM_ACTIONS,
                       os_type=('Suse', '11', 'Final'),
    )
    self.assertTrue(put_structured_out.called)
    self.assertEquals(put_structured_out.call_args[0][0],
                      {'package_installation_result': 'SUCCESS',
                       'installed_repository_version': u'2.2.0.1-885',
                       'ambari_repositories': ["HDP-UTILS-2.2.0.1-885"]})
    self.assertResourceCalled('Repository', 'HDP-UTILS-2.2.0.1-885',
                              base_url='http://s3.amazonaws.com/dev.hortonworks.com/HDP/centos5/2.x/updates/2.2.0.0',
                              action=['create'],
                              components=[u'HDP-UTILS-1.1.0.20', 'main'],
                              repo_template='repo_suse_rhel.j2',
                              repo_file_name='HDP-UTILS-2.2.0.1-885',
                              mirror_list=None,
    )
    self.assertResourceCalled('Repository', 'HDP-2.2.0.1-885',
                              base_url='http://s3.amazonaws.com/dev.hortonworks.com/HDP/centos5/2.x/updates/2.2.0.0',
                              action=['create'],
                              components=[u'HDP-2.2', 'main'],
                              repo_template='repo_suse_rhel.j2',
                              repo_file_name='HDP-2.2.0.1-885',
                              mirror_list=None,
    )
    self.assertResourceCalled('Package', 'hadoop_2_2_*', use_repos=['base', 'HDP-UTILS-2.2.0.1-885', 'HDP-2.2.0.1-885'])
    self.assertResourceCalled('Package', 'snappy', use_repos=['base', 'HDP-UTILS-2.2.0.1-885', 'HDP-2.2.0.1-885'])
    self.assertResourceCalled('Package', 'snappy-devel', use_repos=['base', 'HDP-UTILS-2.2.0.1-885', 'HDP-2.2.0.1-885'])
    self.assertResourceCalled('Package', 'lzo', use_repos=['base', 'HDP-UTILS-2.2.0.1-885', 'HDP-2.2.0.1-885'])
    self.assertResourceCalled('Package', 'hadooplzo_2_2_*', use_repos=['base', 'HDP-UTILS-2.2.0.1-885', 'HDP-2.2.0.1-885'])
    self.assertResourceCalled('Package', 'hadoop_2_2_*-libhdfs', use_repos=['base', 'HDP-UTILS-2.2.0.1-885', 'HDP-2.2.0.1-885'])
    self.assertResourceCalled('Package', 'ambari-log4j', use_repos=['base', 'HDP-UTILS-2.2.0.1-885', 'HDP-2.2.0.1-885'])
    self.assertNoMoreResources()


