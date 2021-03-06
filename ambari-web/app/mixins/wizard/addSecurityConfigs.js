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

var App = require('app');

/**
 * Mixin for loading and setting secure configs
 *
 * @type {Ember.Mixin}
 */
App.AddSecurityConfigs = Em.Mixin.create({

  kerberosDescriptor: {},

  secureProperties: function () {
    if (App.get('isHadoop2Stack')) {
      return require('data/HDP2/secure_properties').configProperties;
    } else {
      return require('data/secure_properties').configProperties;
    }
  }.property('App.isHadoop2Stack'),

  secureMapping: function () {
    return (App.get('isHadoop2Stack')) ? require('data/HDP2/secure_mapping') : require('data/secure_mapping');
  }.property('App.isHadoop2Stack'),

  serviceUsersBinding: 'App.router.mainAdminSecurityController.serviceUsers',

  componentsConfig: [
    {
      serviceName: 'OOZIE',
      componentName: 'OOZIE_SERVER',
      configName: 'oozieserver_host'
    },
    {
      serviceName: 'HIVE',
      componentName: 'HIVE_METASTORE',
      configName: 'hivemetastore_host'
    },
    {
      serviceName: 'HIVE',
      componentName: 'WEBHCAT_SERVER',
      configName: 'webhcat_server'
    }
  ],

  /**
   * mock users used in testMode
   */
  testModeUsers: [
    {
      name: 'hdfs_user',
      value: 'hdfs'
    },
    {
      name: 'mapred_user',
      value: 'mapred'
    },
    {
      name: 'hbase_user',
      value: 'hbase'
    },
    {
      name: 'hive_user',
      value: 'hive'
    }
  ],

  /**
   * security configs, which values should be modified after APPLY CONFIGURATIONS stage
   */
  secureConfigs: function () {
    var configs = [
      {
        name: 'nagios_principal_name',
        serviceName: 'NAGIOS'
      },
      {
        name: 'zookeeper_principal_name',
        serviceName: 'ZOOKEEPER'
      },
      {
        name: 'knox_principal_name',
        serviceName: 'KNOX'
      },
      {
        name: 'storm_principal_name',
        serviceName: 'STORM'
      }
    ];
    if (App.get('isHadoop22Stack')) {
      configs.push({
        name: 'nimbus_principal_name',
        serviceName: 'STORM'
      });
    }
    return configs;
  }.property('App.isHadoop22Stack'),

  secureServices: function() {
    return  this.get('content.services');
  }.property('content.services'),

  /**
   * prepare secure configs
   */
  prepareSecureConfigs: function () {
    var configs = this.get('content.serviceConfigProperties');
    this.set('configs', configs);
    this.loadStaticConfigs(); //Hack for properties which are declared in site_properties.js and not able to retrieve values declared in secure_properties.js
    this.loadUsersToConfigs();
    this.loadHostNames();
    this.loadPrimaryNames();
    var uiConfigs = this.loadUiSideSecureConfigs();
    this.set('configs', this.get('configs').concat(uiConfigs));
  },


  /**
   * push users to configs
   */
  loadUsersToConfigs: function () {
    if (!this.get('serviceUsers').length) {
      this.loadUsersFromServer();
    }
    App.router.get('mainAdminSecurityController.serviceUsers').forEach(function (_user) {
      this.get('configs').pushObject(_user);
    }, this);
  },

  /**
   * add component config that contain host name as value
   * @param serviceName
   * @param componentName
   * @param configName
   * @return {Boolean}
   */
  addHostConfig: function (serviceName, componentName, configName) {
    var service = App.Service.find(serviceName);
    var isServiceSecure = this.get('secureServices').someProperty('serviceName', serviceName);

    if (service.get('isLoaded') && isServiceSecure) {
      var hostComponent = service.get('hostComponents').findProperty('componentName', componentName);
      if (hostComponent) {
        var hostName = hostComponent.get('hostName');
        this.get('configs').push({
          id: 'puppet var',
          name: configName,
          value: hostName
        });
        return true;
      }
    }
    return false;
  },

  /**
   * add hosts' names to configs
   */
  loadHostNames: function () {
    var componentsConfig = this.get('componentsConfig');
    componentsConfig.forEach(function (host) {
      this.addHostConfig(host.serviceName, host.componentName, host.configName);
    }, this);
  },

  /**
   * load static configs
   */
  loadStaticConfigs: function () {
    this.get('configs').forEach(function (_property) {
      switch (_property.name) {
        case 'security_enabled':
          _property.value = 'true';
          break;
      }
    }, this);
  },

  /**
   * add principals to properties
   */
  loadPrimaryNames: function () {
    var principalProperties = this.getPrincipalNames();
    principalProperties.forEach(function (_principalProperty) {
      var name = _principalProperty.name.replace('principal', 'primary');
      var value = _principalProperty.value.split('/')[0];
      this.get('configs').push({name: name, value: value});
    }, this);
  },

  /**
   * gather and return properties with "principal_name"
   * @return {Array}
   */
  getPrincipalNames: function () {
    var principalNames = [];
    this.get('configs').forEach(function (_property) {
      if (/principal_name?$/.test(_property.name)) {
        principalNames.push(_property);
      }
    }, this);
    this.get('secureProperties').forEach(function (_secureProperty) {
      if (/principal_name?$/.test(_secureProperty.name)) {
        var principalName = principalNames.findProperty('name', _secureProperty.name);
        if (!principalName) {
          _secureProperty.value = _secureProperty.defaultValue;
          principalNames.push(_secureProperty);
        }
      }
    }, this);
    return principalNames;
  },

  /**
   * load users from server
   */
  loadUsersFromServer: function () {
    if (App.get('testMode')) {
      var serviceUsers = this.get('serviceUsers');
      this.get('testModeUsers').forEach(function (user) {
        user.id = 'puppet var';
        serviceUsers.push(user);
      }, this);
    } else {
      App.router.set('mainAdminSecurityController.serviceUsers', App.db.getSecureUserInfo());
    }
  },

  /**
   * load configs from UI side
   * @return {Array}
   */
  loadUiSideSecureConfigs: function () {
    var uiConfig = [];
    var configs = this.get('secureMapping').filterProperty('foreignKey', null).filter(function(_configProperty){
      return (App.Service.find().mapProperty('serviceName').contains(_configProperty.serviceName));
    },this);
    configs.forEach(function (_config) {
      var value = _config.value;
      if (_config.hasOwnProperty('dependedServiceName')) {
        value = this.checkServiceForConfigValue(value, _config.dependedServiceName);
      }
      value = this.getConfigValue(_config.templateName, value);
      uiConfig.push({
        "id": "site property",
        "name": _config.name,
        "value": value,
        "filename": _config.filename
      });
    }, this);
    var dependentConfig = this.get('secureMapping').filterProperty('foreignKey');
    dependentConfig.forEach(function (_config) {
      if (App.Service.find().mapProperty('serviceName').contains(_config.serviceName)) {
        this.setConfigValue(_config);
        this.formatConfigName(uiConfig, _config);
        uiConfig.push({
          "id": "site property",
          "name": _config._name || _config.name,
          "value": _config.value,
          "filename": _config.filename
        });
      }
    }, this);
    return uiConfig;
  },

  /**
   * erase template rules from config value if service is not loaded
   * @param value
   * @param services
   * @return {*}
   */
  checkServiceForConfigValue: function (value, services) {
    services.forEach(function (_service) {
      if (!App.Service.find(_service.name).get('isLoaded')) {
        value = value.replace(_service.replace, '');
      }
    }, this);
    return value;
  },

  /**
   * Set all site property that are derived from other puppet-variable
   * @param templateName
   * @param expression
   * @return {String|null}
   */
  getConfigValue: function (templateName, expression) {
    var express = expression.match(/<(.*?)>/g);
    var value = expression;
    if (Em.isNone(express)) return expression;

    express.forEach(function (_express) {
      var index = parseInt(_express.match(/\[([\d]*)(?=\])/)[1]);
      var configs = this.get('configs').findProperty('name', templateName[index]);

      if (!!value) {
        value = (configs) ? value.replace(_express, configs.value) : null;
      }
    }, this);
    return value;
  },

  /**
   * format name of config values of configs which match foreignKey
   * @param uiConfig
   * @param config
   * @return {Boolean}
   */
  formatConfigName: function (uiConfig, config) {
    if (Em.isNone(config.value)) return false;

    var fkValue = config.name.match(/<(foreignKey.*?)>/g);
    if (fkValue) {
      fkValue.forEach(function (_fkValue) {
        var index = parseInt(_fkValue.match(/\[([\d]*)(?=\])/)[1]);
        var value;
        if (uiConfig.someProperty('name', config.foreignKey[index])) {
          value = uiConfig.findProperty('name', config.foreignKey[index]).value;
          config._name = config.name.replace(_fkValue, value);
        } else if (this.get('configs').someProperty('name', config.foreignKey[index])) {
          value = this.get('configs').findProperty('name', config.foreignKey[index]).value;
          config._name = config.name.replace(_fkValue, value);
        }
      }, this);
      return true;
    }
    return false;
  },

  /**
   * Set config value with values of configs which match template
   * @param config
   * @return {Boolean}
   */
  setConfigValue: function (config) {
    if (Em.isNone(config.value)) return false;

    //For properties in the configMapping file having foreignKey and templateName properties.
    var templateValue = config.value.match(/<(templateName.*?)>/g);
    if (templateValue) {
      templateValue.forEach(function (_value) {
        var index = parseInt(_value.match(/\[([\d]*)(?=\])/)[1]);
        var cfgValue = this.get('configs').findProperty('name', config.templateName[index]);

        config.value = (cfgValue) ? config.value.replace(_value, cfgValue.value) : null;
      }, this);
      return true;
    }
    return false;
  },

  /**
   * set value of principal property
   * @param serviceName
   * @param principalName
   * @return {Boolean}
   */
  setPrincipalValue: function (serviceName, principalName) {
    var siteProperties = this.get('configs');

    var realmName = siteProperties.findProperty('name', 'kerberos_domain');

    if (this.get('secureServices').someProperty('serviceName', serviceName)) {
      var principalProperty = siteProperties.findProperty('name', principalName);
      principalProperty.value = principalProperty.value + '@' + realmName.value;
      return true;
    }
    return false;
  },

  /**
   * Generate stack descriptor configs.
   *
   * @returns {$.Deferred} 
   */
  getStackDescriptorConfigs: function() {
    return this.loadStackDescriptorConfigs().pipe(this.createServicesStackDescriptorConfigs.bind(this));
  },

  /**
   * 
   * @param {object[]} items - stack descriptor json response
   * @returns {App.ServiceConfigProperty[]} 
   */
  createServicesStackDescriptorConfigs: function(items) {
    var self = this;
    var configs = [];
    var clusterConfigs = [];
    var kerberosDescriptor = items.Versions.kerberos_descriptor;
    this.set('kerberosDescriptor', kerberosDescriptor);
    // generate configs for root level properties object, currently realm, keytab_dir
    clusterConfigs = clusterConfigs.concat(this.expandKerberosStackDescriptorProps(kerberosDescriptor.properties));
    // generate configs for root level identities object, currently spnego property
    clusterConfigs = clusterConfigs.concat(this.createConfigsByIdentities(kerberosDescriptor.identities, 'Cluster'));
    clusterConfigs.setEach('serviceName', 'Cluster');
    // generate properties for services object
    kerberosDescriptor.services.forEach(function(service) {
      var serviceName = service.name;
      service.components.forEach(function(component) {
        var componentName = component.name;
        var identityConfigs = self.createConfigsByIdentities(component.identities, componentName);
        identityConfigs.setEach('serviceName', serviceName);
        configs = configs.concat(identityConfigs);
      });
    });    
    // unite cluster and service configs
    configs = configs.concat(clusterConfigs);
    // return configs with uniq names
    return configs.reduce(function(p,c) {
      if (!p.findProperty('name', c.get('name'))) p.push(c);
      return p;
    }, []);
  },

  /**
   * Create service properties based on component identity
   *
   * @param {object[]} identities
   * @param {string} componentName
   * @returns {App.ServiceConfigProperty[]} 
   */
  createConfigsByIdentities: function(identities, componentName) {
    var self = this;
    var configs = [];
    
    identities.forEach(function(identity) {
      var defaultObject = {
        isOverridable: false,
        isVisible: true,
        isSecureConfig: true,
        componentName: componentName,
        name: identity.name
      };
      if (identity.name == '/spnego') {
        defaultObject.isEditable = false;
      }
      self.parseIdentityObject(identity).forEach(function(item) {
        configs.push(App.ServiceConfigProperty.create($.extend({}, defaultObject, item)));
      });
    });

    return configs;
  },

  /**
   * Bootstrap base object according to identity info. Generate objects will be converted to
   * App.ServiceConfigProperty model class instances.
   *
   * @param {object} identity
   * @returns {object[]} 
   */
  parseIdentityObject: function(identity) {
    var result = [];
    var name = identity.name;
    var keys = Em.keys(identity).without('name');
    keys.forEach(function(item) {
      var configObject = {};
      var prop = identity[item];
      if (name == '/spnego') configObject.observesValueFrom = 'spnego_' + item;
      configObject.defaultValue = configObject.value = item == 'principal' ? prop.value : prop.file;
      configObject.filename = prop.configuration ? prop.configuration.split('/')[0] : 'cluster-env';
      configObject.name = configObject.displayName = prop.configuration ? prop.configuration.split('/')[1] : name + '_' + item;
      result.push(configObject);
    });
    return result;
  },

  /**
   * Wrap kerberos properties to App.ServiceConfigProperty model class instances.
   * 
   * @param {object} kerberosProperties
   * @returns {App.ServiceConfigProperty[]} 
   */
  expandKerberosStackDescriptorProps: function(kerberosProperties) {
    var configs = [];
    
    for (var propertyName in kerberosProperties) {
      var propertyObject = {
        name: propertyName,
        value: kerberosProperties[propertyName],
        defaultValue: kerberosProperties[propertyName],
        serviceName: 'Cluster',
        displayName: propertyName,
        isOverridable: false,
        isEditable: propertyName != 'realm',
        isSecureConfig: true
      };
      configs.push(App.ServiceConfigProperty.create(propertyObject));
    }

    return configs;
  },

  /**
   * update the kerberos descriptor to be put on cluster resource with user customizations
   * @param kerberosDescriptor {Object}
   * @param configs {Object}
   */
  updateKerberosDescriptor: function(kerberosDescriptor, configs) {
    configs.forEach(function(_config){
      if (Object.keys(kerberosDescriptor.properties).contains(_config.name)) {
        for (var key in kerberosDescriptor.properties) {
          if (key === _config.name) {
            kerberosDescriptor.properties[key] =  _config.value;
          }
        }
      } else if (_config.name.endsWith('_principal') || _config.name.endsWith('_keytab')) {
        var identities = kerberosDescriptor.identities;
        identities.forEach(function(_identity){
          if (_config.name.startsWith(_identity.name)) {
            if (_config.name.endsWith('_principal')) {
              _identity.principal.value =  _config.value;
            } else if (_config.name.endsWith('_keytab')) {
              _identity.keytab.file =  _config.value;
            }
          }
        },this);
      }  else {
        kerberosDescriptor.services.forEach(function(_service) {
          _service.components.forEach(function(_component){
            _component.identities.forEach(function(_identity){
              if (_identity.principal && _identity.principal.configuration && _identity.principal.configuration.endsWith(_config.name)) {
                _identity.principal.value = _config.value;
              } else if (_identity.keytab && _identity.keytab.configuration && _identity.keytab.configuration.endsWith(_config.name)) {
                _identity.keytab.file = _config.value;
              }
            },this);
          }, this);
        },this);
      }
    }, this);
  },

  /**
   * Make request for stack descriptor configs.
   *
   * @returns {$.ajax} 
   */
  loadStackDescriptorConfigs: function() {
    return App.ajax.send({
      sender: this,
      name: 'admin.kerberize.stack_descriptor',
      data: {
        stackName: App.get('currentStackName'),
        stackVersionNumber: App.get('currentStackVersionNumber')
      }
    });
  }
});
