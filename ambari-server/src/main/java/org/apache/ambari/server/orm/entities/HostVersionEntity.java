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

package org.apache.ambari.server.orm.entities;

import org.apache.ambari.server.state.RepositoryVersionState;
import javax.persistence.Basic;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Enumerated;
import javax.persistence.EnumType;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.NamedQuery;
import javax.persistence.NamedQueries;
import javax.persistence.TableGenerator;
import javax.persistence.Table;

import static org.apache.commons.lang.StringUtils.defaultString;

@Table(name = "host_version")
@Entity
@TableGenerator(name = "host_version_id_generator",
    table = "ambari_sequences", pkColumnName = "sequence_name", valueColumnName = "sequence_value"
    , pkColumnValue = "host_version_id_seq"
    , initialValue = 0
    , allocationSize = 1
)
@NamedQueries({
    @NamedQuery(name = "hostVersionByClusterAndStackAndVersion", query =
        "SELECT hostVersion FROM HostVersionEntity hostVersion JOIN hostVersion.hostEntity host JOIN ClusterEntity cluster " +
            "WHERE cluster.clusterName=:clusterName AND hostVersion.stack=:stack AND hostVersion.version=:version"),

    @NamedQuery(name = "hostVersionByClusterAndHostname", query =
        "SELECT hostVersion FROM HostVersionEntity hostVersion JOIN hostVersion.hostEntity host JOIN ClusterEntity cluster " +
            "WHERE cluster.clusterName=:clusterName AND hostVersion.hostName=:hostName"),

    @NamedQuery(name = "hostVersionByHostname", query =
        "SELECT hostVersion FROM HostVersionEntity hostVersion JOIN hostVersion.hostEntity host " +
            "WHERE hostVersion.hostName=:hostName"),

    @NamedQuery(name = "hostVersionByClusterHostnameAndState", query =
        "SELECT hostVersion FROM HostVersionEntity hostVersion JOIN hostVersion.hostEntity host JOIN ClusterEntity cluster " +
            "WHERE cluster.clusterName=:clusterName AND hostVersion.hostName=:hostName AND hostVersion.state=:state"),

    @NamedQuery(name = "hostVersionByClusterStackVersionAndHostname", query =
        "SELECT hostVersion FROM HostVersionEntity hostVersion JOIN hostVersion.hostEntity host JOIN ClusterEntity cluster " +
            "WHERE cluster.clusterName=:clusterName AND hostVersion.stack=:stack AND hostVersion.version=:version AND " +
            "hostVersion.hostName=:hostName"),
})
public class HostVersionEntity {

  @Id
  @Column(name = "id", nullable = false, insertable = true, updatable = false)
  @GeneratedValue(strategy = GenerationType.TABLE, generator = "host_version_id_generator")
  private Long id;

  @Column(name = "host_name", nullable = false, insertable = false, updatable = false)
  private String hostName;

  @ManyToOne
  @JoinColumn(name = "host_name", referencedColumnName = "host_name", nullable = false)
  private HostEntity hostEntity;

  @Basic
  @Column(name = "stack", nullable = false, insertable = true, updatable = true)
  private String stack = "";

  @Basic
  @Column(name = "version", nullable = false, insertable = true, updatable = true)
  private String version = "";

  @Column(name = "state", nullable = false, insertable = true, updatable = true)
  @Enumerated(value = EnumType.STRING)
  private RepositoryVersionState state;

  /**
   * Empty constructor is needed by unit tests.
   */
  public HostVersionEntity() {
  }

  public HostVersionEntity(String hostName, String stack, String version, RepositoryVersionState state) {
    this.hostName = hostName;
    this.stack = stack;
    this.version = version;
    this.state = state;
  }

  /**
   * This constructor is mainly used by the unit tests in order to construct an object without the id.
   */
  public HostVersionEntity(HostVersionEntity other) {
    this.hostName = other.hostName;
    this.stack = other.stack;
    this.version = other.version;
    this.state = other.state;
  }

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public String getHostName() {
    return hostName;
  }

  public void setHostName(String hostName) {
    this.hostName = hostName;
  }

  public HostEntity getHostEntity() {
    return hostEntity;
  }

  public void setHostEntity(HostEntity hostEntity) {
    this.hostEntity = hostEntity;
  }

  public String getStack() {
    return defaultString(stack);
  }

  public void setStack(String stack) {
    this.stack = stack;
  }

  public String getVersion() {
    return defaultString(version);
  }

  public void setVersion(String version) {
    this.version = version;
  }

  public RepositoryVersionState getState() {
    return state;
  }

  public void setState(RepositoryVersionState state) {
    this.state = state;
  }

  @Override
  public boolean equals(Object o) {
    if (this == o) return true;
    if (o == null || getClass() != o.getClass()) return false;

    HostVersionEntity that = (HostVersionEntity) o;

    if (this.id != that.id || !this.hostName.equals(that.hostName) || !this.stack.equals(that.stack)
        || !this.version.equals(that.version) || !this.state.equals(that.state)) return false;

    return true;
  }

  @Override
  public int hashCode() {
    int result = id !=null ? id.intValue() : 0;
    result = 31 * result + (hostName != null ? hostName.hashCode() : 0);
    result = 31 * result + (stack != null ? stack.hashCode() : 0);
    result = 31 * result + (version != null ? version.hashCode() : 0);
    result = 31 * result + (state != null ? state.hashCode() : 0);
    return result;
  }
}
