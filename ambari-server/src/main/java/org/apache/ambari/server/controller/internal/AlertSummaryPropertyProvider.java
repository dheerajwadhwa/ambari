/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.apache.ambari.server.controller.internal;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import org.apache.ambari.server.AmbariException;
import org.apache.ambari.server.StaticallyInject;
import org.apache.ambari.server.controller.spi.Predicate;
import org.apache.ambari.server.controller.spi.PropertyProvider;
import org.apache.ambari.server.controller.spi.Request;
import org.apache.ambari.server.controller.spi.Resource;
import org.apache.ambari.server.controller.spi.SystemException;
import org.apache.ambari.server.orm.dao.AlertHostSummaryDTO;
import org.apache.ambari.server.orm.dao.AlertSummaryDTO;
import org.apache.ambari.server.orm.dao.AlertsDAO;
import org.apache.ambari.server.state.AlertState;
import org.apache.ambari.server.state.Cluster;
import org.apache.ambari.server.state.Clusters;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.common.collect.ImmutableSet;
import com.google.inject.Inject;
import com.google.inject.Provider;

/**
 * Property provider that adds alert summary information to endpoints.
 */
@StaticallyInject
public class AlertSummaryPropertyProvider extends BaseProvider implements PropertyProvider {

  private final static Logger LOG = LoggerFactory.getLogger(AlertSummaryPropertyProvider.class);

  /**
   * The property ID for a summary of all cluster-wide alerts.
   */
  private final static String ALERTS_SUMMARY = "alerts_summary";

  /**
   * The property ID for a summary of all cluster-wide alerts that have a host
   * associated with them.
   */
  private final static String ALERTS_SUMMARY_HOSTS = "alerts_summary_hosts";

  @Inject
  private static Provider<Clusters> s_clusters = null;

  @Inject
  private static AlertsDAO s_dao = null;

  private Resource.Type m_resourceType = null;
  private String m_clusterPropertyId = null;
  private String m_typeIdPropertyId = null;

  /**
   * Constructor.
   *
   * @param type
   * @param clusterPropertyId
   * @param typeIdPropertyId
   */
  AlertSummaryPropertyProvider(Resource.Type type,
      String clusterPropertyId, String typeIdPropertyId) {
    super(ImmutableSet.<String> of(ALERTS_SUMMARY, ALERTS_SUMMARY_HOSTS));
    m_resourceType = type;
    m_clusterPropertyId = clusterPropertyId;
    m_typeIdPropertyId = typeIdPropertyId;
  }

  @Override
  public Set<Resource> populateResources(Set<Resource> resources,
      Request request, Predicate predicate) throws SystemException {

    Set<String> propertyIds = getRequestPropertyIds(request, predicate);

    try {
      for (Resource res : resources) {
        populateResource(res, propertyIds);
      }
    } catch (AmbariException e) {
      LOG.error("Could not load built-in alerts - Executor exception ({})",
          e.getMessage());
    }

    return resources;
  }

  private void populateResource(Resource resource, Set<String> requestedIds) throws AmbariException {

    AlertSummaryDTO summary = null;
    AlertHostSummaryDTO hostSummary = null;

    String clusterName = (String) resource.getPropertyValue(m_clusterPropertyId);

    if (null == clusterName) {
      return;
    }

    String typeId = null == m_typeIdPropertyId ? null : (String) resource.getPropertyValue(m_typeIdPropertyId);
    Cluster cluster = s_clusters.get().getCluster(clusterName);

    switch (m_resourceType.getInternalType()) {
      case Cluster:
        long clusterId = cluster.getClusterId();

        // only make the calculation of asked
        if (BaseProvider.isPropertyRequested(ALERTS_SUMMARY, requestedIds)) {
          summary = s_dao.findCurrentCounts(cluster.getClusterId(), null, null);
        }

        // only make the calculation of asked
        if (BaseProvider.isPropertyRequested(ALERTS_SUMMARY_HOSTS,
            requestedIds)) {
          hostSummary = s_dao.findCurrentHostCounts(clusterId);
        }

        break;
      case Service:
        summary = s_dao.findCurrentCounts(cluster.getClusterId(), typeId, null);
        break;
      case Host:
        summary = s_dao.findCurrentCounts(cluster.getClusterId(), null, typeId);
        break;
      default:
        break;
    }

    // all alerts in the cluster, in summary count form
    if (null != summary) {
      Map<AlertState, Integer> map = new HashMap<AlertState, Integer>();
      map.put(AlertState.OK, Integer.valueOf(summary.getOkCount()));
      map.put(AlertState.WARNING, Integer.valueOf(summary.getWarningCount()));
      map.put(AlertState.CRITICAL, Integer.valueOf(summary.getCriticalCount()));
      map.put(AlertState.UNKNOWN, Integer.valueOf(summary.getUnknownCount()));

      setResourceProperty(resource, ALERTS_SUMMARY, map, requestedIds);
    }

    // the summary of hosts with warning or critical alerts
    if (null != hostSummary) {
      Map<AlertState, Integer> map = new HashMap<AlertState, Integer>();
      map.put(AlertState.OK, Integer.valueOf(hostSummary.getOkCount()));
      map.put(AlertState.WARNING, Integer.valueOf(hostSummary.getWarningCount()));
      map.put(AlertState.CRITICAL, Integer.valueOf(hostSummary.getCriticalCount()));
      map.put(AlertState.UNKNOWN, Integer.valueOf(hostSummary.getUnknownCount()));
      setResourceProperty(resource, ALERTS_SUMMARY_HOSTS, map, requestedIds);
    }

  }

  @Override
  public Set<String> checkPropertyIds(Set<String> propertyIds) {
    Set<String> rejects = new HashSet<String>();

    for (String id : propertyIds) {
      if (!id.startsWith(ALERTS_SUMMARY)) {
        rejects.add(id);
      }
    }

    return rejects;
  }

}
