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
 * Mixin for wizard controller for showing command progress on wizard pages
 * This should
 * @type {Ember.Mixin}
 */
App.wizardProgressPageControllerMixin = Em.Mixin.create({
  controllerName: '',
  clusterDeployState: 'WIZARD_DEPLOY',
  status: 'IN_PROGRESS',
  tasks: [],
  commands: [],
  currentRequestIds: [], //todo: replace with using requestIds from tasks
  logs: [],
  currentTaskId: null,
  POLL_INTERVAL: 4000,
  isSubmitDisabled: true,
  isBackButtonDisabled: true,
  stages: [],
  currentPageRequestId: null,
  isSingleRequestPage: false,
  isCommandLevelRetry: function () {
    return !this.get('isSingleRequestPage');
  }.property('isSingleRequestPage'),
  showRetry: false,

  k: Em.K,
  /**
   *  tasksMessagesPrefix should be overloaded by any controller including the mixin
   */
  tasksMessagesPrefix: '',

  loadStep: function () {
    var self = this;
    if (!self.isSingleRequestPage) {
      this.initStep();
    } else {
      var runningOperations = App.router.get('backgroundOperationsController.services').filterProperty('isRunning');
      var currentOperation = runningOperations.findProperty('name', this.contextForPollingRequest);
      if (!currentOperation) {
        this.submitRequest().done(function (data) {
          if (data) {
            self.set('currentPageRequestId', data.Requests.id);
            self.doPollingForPageRequest();
          } else {
            //Step has been successfully completed
          }
        });
      } else {
        self.set('currentPageRequestId',currentOperation.get('id'));
        self.doPollingForPageRequest();
      }
    }
  },

  initStep: function () {
    this.clearStep();
    this.initializeTasks();
    if (!this.isSingleRequestPage) {
      this.loadTasks();
    }
    this.addObserver('tasks.@each.status', this, 'onTaskStatusChange');
    if (this.isSingleRequestPage) {
      var dfd = $.Deferred();
      var dfdObject = {
        deferred: dfd,
        isJqueryPromise: true
      };
      this.onTaskStatusChange(dfdObject);
      return dfd.promise();
    } else {
      this.onTaskStatusChange();
    }
  },

  clearStep: function () {
    this.removeObserver('tasks.@each.status', this, 'onTaskStatusChange');
    this.set('isSubmitDisabled', true);
    this.set('isBackButtonDisabled', true);
    this.set('tasks', []);
    this.set('currentRequestIds', []);
  },

  retry: function () {
    this.set('showRetry', false);
    this.get('tasks').setEach('status','PENDING');
    this.loadStep();
  },

  submitRequest: function () {
    var dfd;
    var self = this;
    dfd = App.ajax.send({
      name: self.get('request.ajaxName'),
      data: self.get('request.ajaxData'),
      sender: this
    });
    return dfd.promise();
  },

  doPollingForPageRequest: function () {
    App.ajax.send({
      name: 'admin.poll.kerberize.cluster.request',
      sender: this,
      data: {
        requestId: this.get('currentPageRequestId')
      },
      success: 'initializeStages'
    });
  },

  initializeStages: function (data) {
    var self = this;
    var stages = [];
    this.set('logs', []);
    data.stages.forEach(function (_stage) {
      stages.pushObject(Em.Object.create(_stage.Stage));
    }, this);
    if (!this.get('stages').length) {
      this.get('stages').pushObjects(stages);
      this.initStep().done(function(){
        self.updatePageWithPolledData(data);
      });
    } else {
      this.updatePageWithPolledData(data);
    }
  },

  updatePageWithPolledData: function(data) {
    var self = this;
    var tasks = [];
    var currentPageRequestId = this.get('currentPageRequestId');
    var currentTaskId = this.get('currentTaskId');
    var currentTask = this.get('tasks').findProperty('id', currentTaskId);
    var currentStage =  data.stages.findProperty('Stage.stage_id', currentTask.get('stageId'));
    var tasksInCurrentStage =  currentStage.tasks;
    this.set('logs',tasksInCurrentStage);

    this.setRequestIds(this.get('currentTaskId'), [this.get('currentPageRequestId')]);

    if (!tasksInCurrentStage.someProperty('Tasks.status', 'PENDING') && !tasksInCurrentStage.someProperty('Tasks.status', 'QUEUED') && !tasksInCurrentStage.someProperty('Tasks.status', 'IN_PROGRESS')) {
      this.set('currentRequestIds', []);
      if (tasksInCurrentStage.someProperty('Tasks.status', 'FAILED') || tasksInCurrentStage.someProperty('Tasks.status', 'TIMEDOUT') || tasksInCurrentStage.someProperty('Tasks.status', 'ABORTED')) {
        this.setTaskStatus(currentTaskId, 'FAILED');
      } else {
        this.setTaskStatus(currentTaskId, 'COMPLETED');
      }
    } else {
      var completedActions = tasksInCurrentStage.filterProperty('Tasks.status', 'COMPLETED').length
        + tasksInCurrentStage.filterProperty('Tasks.status', 'FAILED').length
        + tasksInCurrentStage.filterProperty('Tasks.status', 'ABORTED').length
        + tasksInCurrentStage.filterProperty('Tasks.status', 'TIMEDOUT').length;
      var queuedActions = tasksInCurrentStage.filterProperty('Tasks.status', 'QUEUED').length;
      var inProgressActions = tasksInCurrentStage.filterProperty('Tasks.status', 'IN_PROGRESS').length;
      var progress = Math.ceil(((queuedActions * 0.09) + (inProgressActions * 0.35) + completedActions ) / tasksInCurrentStage.length * 100);
      this.get('tasks').findProperty('id', currentTaskId).set('progress', progress);
    }

    if (!(this.get('status') === 'COMPLETED')) {
      window.setTimeout(function () {
        self.doPollingForPageRequest();
      }, self.POLL_INTERVAL);
    }
  },

  initializeTasks: function () {
    var self = this;
    var commands = this.isSingleRequestPage ? this.get('stages') : this.get('commands');
    var currentStep = App.router.get(this.get('content.controllerName') + '.currentStep');
    var tasksMessagesPrefix = this.get('tasksMessagesPrefix');
    for (var i = 0; i < commands.length; i++) {
      this.get('tasks').pushObject(Ember.Object.create({
        title: self.isSingleRequestPage ? commands[i].get('context') : Em.I18n.t(tasksMessagesPrefix + currentStep + '.task' + i + '.title'),
        status: 'PENDING',
        id: i,
        stageId: self.isSingleRequestPage ? commands[i].get('stage_id') : null,
        command: self.isSingleRequestPage ? 'k' : commands[i],
        showRetry: false,
        showRollback: false,
        name: self.isSingleRequestPage ? commands[i].get('context') : Em.I18n.t(tasksMessagesPrefix + currentStep + '.task' + i + '.title'),
        displayName: self.isSingleRequestPage ? commands[i].get('context') : Em.I18n.t(tasksMessagesPrefix + currentStep + '.task' + i + '.title'),
        progress: 0,
        isRunning: false,
        requestIds: []
      }));
    }
  },

  loadTasks: function () {
    var self = this;
    var loadedStatuses = this.get('content.tasksStatuses');
    var loadedRequestIds = this.get('content.tasksRequestIds');
    if (loadedStatuses && loadedStatuses.length === this.get('tasks').length) {
      this.get('tasks').forEach(function (task, i) {
        self.setTaskStatus(task.get('id'), loadedStatuses[i]);
        self.setRequestIds(task.get('id'), loadedRequestIds[i]);
      });
      if (loadedStatuses.contains('IN_PROGRESS')) {
        var curTaskId = this.get('tasks')[loadedStatuses.indexOf('IN_PROGRESS')].get('id');
        this.set('currentRequestIds', this.get('content.requestIds'));
        this.set('currentTaskId', curTaskId);
        this.doPolling();
      } else if (loadedStatuses.contains('QUEUED')) {
        var curTaskId = this.get('tasks')[loadedStatuses.indexOf('QUEUED')].get('id');
        this.set('currentTaskId', curTaskId);
        this.runTask(curTaskId);
      }
    }
  },

  setTaskStatus: function (taskId, status) {
    this.get('tasks').findProperty('id', taskId).set('status', status);
  },

  setRequestIds: function (taskId, requestIds) {
    this.get('tasks').findProperty('id', taskId).set('requestIds', requestIds);
  },

  retryTask: function () {
    var task = this.get('tasks').findProperty('status', 'FAILED');
    task.set('showRetry', false);
    task.set('showRollback', false);
    task.set('status', 'PENDING');
  },

  onTaskStatusChange: function (dfdObject) {
    var statuses = this.get('tasks').mapProperty('status');
    var tasksRequestIds = this.get('tasks').mapProperty('requestIds');
    var requestIds = this.get('currentRequestIds');
    // save task info
    App.router.get(this.get('content.controllerName')).saveTasksStatuses(statuses);
    App.router.get(this.get('content.controllerName')).saveTasksRequestIds(tasksRequestIds);
    App.router.get(this.get('content.controllerName')).saveRequestIds(requestIds);
    // call saving of cluster status asynchronous
    // synchronous executing cause problems in Firefox
    var successCallbackData;
    if (dfdObject && dfdObject.isJqueryPromise) {
      successCallbackData =  {deferred: dfdObject.deferred};
    }
    App.clusterStatus.setClusterStatus({
      clusterName: App.router.getClusterName(),
      clusterState: this.get('clusterDeployState'),
      wizardControllerName: this.get('content.controllerName'),
      localdb: App.db.data
    }, {successCallback: this.statusChangeCallback, sender: this, successCallbackData: successCallbackData});
  },

  /**
   * Method that called after saving persist data to server.
   * Switch task according its status.
   */
  statusChangeCallback: function (data) {
    if (!this.get('tasks').someProperty('status', 'IN_PROGRESS') && !this.get('tasks').someProperty('status', 'QUEUED') && !this.get('tasks').someProperty('status', 'FAILED')) {
      var nextTask = this.get('tasks').findProperty('status', 'PENDING');
      if (nextTask) {
        this.set('status', 'IN_PROGRESS');
        var taskStatus = this.isSingleRequestPage ? 'IN_PROGRESS' : 'QUEUED';
        this.setTaskStatus(nextTask.get('id'), taskStatus);
        this.set('currentTaskId', nextTask.get('id'));
        this.runTask(nextTask.get('id'));
      } else {
        this.set('status', 'COMPLETED');
        this.set('isSubmitDisabled', false);
        this.set('isBackButtonDisabled', false);
      }
    } else if (this.get('tasks').someProperty('status', 'FAILED')) {
      this.set('status', 'FAILED');
      this.set('isBackButtonDisabled', false);
      if (this.get('isCommandLevelRetry')) {
        this.get('tasks').findProperty('status', 'FAILED').set('showRetry', true);
      } else {
        this.set('showRetry', true);
      }
      if (App.supports.autoRollbackHA) {
        this.get('tasks').findProperty('status', 'FAILED').set('showRollback', true);
      }
    }
    this.get('tasks').filterProperty('status', 'COMPLETED').setEach('showRetry', false);
    this.get('tasks').filterProperty('status', 'COMPLETED').setEach('showRollback', false);

    if (data && data.deferred) {
      data.deferred.resolve();
    }
  },

  /**
   * Run command of appropriate task
   */
  runTask: function (taskId) {
    this[this.get('tasks').findProperty('id', taskId).get('command')]();
  },

  onTaskError: function () {
    this.setTaskStatus(this.get('currentTaskId'), 'FAILED');
  },

  onTaskCompleted: function () {
    this.setTaskStatus(this.get('currentTaskId'), 'COMPLETED');
  },

  /**
   * check whether component installed on specified hosts
   * @param {string} componentName
   * @param {string[]} hostNames
   * @return {$.ajax}
   */
  checkInstalledComponents: function (componentName, hostNames) {
    return App.ajax.send({
      name: 'host_component.installed.on_hosts',
      sender: this,
      data: {
        componentName: componentName,
        hostNames: hostNames.join(',')
      }
    });
  },

  
  /**
   * Create component on single or multiple hosts.
   *
   * @method createComponent
   * @param {string} componentName - name of the component
   * @param {(string|string[])} hostName - host/hosts where components should be installed
   * @param {string} serviceName - name of the services
   */
  createComponent: function (componentName, hostName, serviceName) {
    var hostNames = (Array.isArray(hostName)) ? hostName : [hostName];
    var self = this;

    this.checkInstalledComponents(componentName, hostNames).then(function (data) {
      var hostsWithComponents = data.items.mapProperty('HostRoles.host_name');
      var result = hostNames.map(function(item) {
        return {
          componentName: componentName,
          hostName: item,
          hasComponent: hostsWithComponents.contains(item)
        };
      });
      var hostsWithoutComponents = result.filterProperty('hasComponent', false).mapProperty('hostName');
      var taskNum = 1;
      var requestData = {
        "RequestInfo": {
          "query": hostsWithoutComponents.map(function(item) {
            return 'Hosts/host_name=' + item;
          }).join('|')
        },
        "Body": {
          "host_components": [
            {
              "HostRoles": {
                "component_name": componentName
              }
            }
          ]
        }
      };
      if (!!hostsWithoutComponents.length) {
        App.ajax.send({
          name: 'wizard.step8.register_host_to_component',
          sender: self,
          data: {
            data: JSON.stringify(requestData),
            hostName: result.mapProperty('hostName'),
            componentName: componentName,
            serviceName: serviceName,
            taskNum: taskNum,
            cluster: App.get('clusterName')
          },
          success: 'onCreateComponent',
          error: 'onCreateComponent'
        });        
      } else {
        self.onCreateComponent(null, null, {
          hostName: result.mapProperty('hostName'),
          componentName: componentName,
          serviceName: serviceName,
          taskNum: taskNum
        }, self);
      }
    });
  },

  onCreateComponent: function () {
    var hostName = arguments[2].hostName;
    var componentName = arguments[2].componentName;
    var taskNum = arguments[2].taskNum;
    var serviceName = arguments[2].serviceName;
    this.updateComponent(componentName, hostName, serviceName, "Install", taskNum);
  },

  onCreateComponentError: function (error) {
    if (error.responseText.indexOf('org.apache.ambari.server.controller.spi.ResourceAlreadyExistsException') !== -1) {
      this.onCreateComponent();
    } else {
      this.onTaskError();
    }
  },

  /**
   * Update component status on selected hosts.
   * 
   * @param {string} componentName
   * @param {(string|string[])} hostName
   * @param {string} serviceName
   * @param {string} context
   * @param {number} taskNum
   * @returns {$.ajax}
   */
  updateComponent: function (componentName, hostName, serviceName, context, taskNum) {
    if (!(hostName instanceof Array)) {
      hostName = [hostName];
    }
    var state = context.toLowerCase() == "start" ? "STARTED" : "INSTALLED";
    return App.ajax.send({
      name: 'common.host_components.update',
      sender: this,
      data: {
        HostRoles: {
          state: state
        },
        query: 'HostRoles/component_name=' + componentName + '&HostRoles/host_name.in(' + hostName.join(',') + ')&HostRoles/maintenance_state=OFF',
        context: context + " " + App.format.role(componentName),
        hostName: hostName,
        taskNum: taskNum || 1,
        componentName: componentName,
        serviceName: serviceName
      },
      success: 'startPolling',
      error: 'onTaskError'
    });
  },

  startPolling: function (data) {
    if (data) {
      this.get('currentRequestIds').push(data.Requests.id);
      var tasksCount = arguments[2].taskNum || 1;
      if (tasksCount === this.get('currentRequestIds').length) {
        this.setRequestIds(this.get('currentTaskId'), this.get('currentRequestIds'));
        this.doPolling();
      }
    } else {
      this.onTaskCompleted();
    }
  },

  doPolling: function () {
    this.setTaskStatus(this.get('currentTaskId'), 'IN_PROGRESS');
    var requestIds = this.get('currentRequestIds');
    this.set('logs', []);
    for (var i = 0; i < requestIds.length; i++) {
      App.ajax.send({
        name: 'admin.high_availability.polling',
        sender: this,
        data: {
          requestId: requestIds[i]
        },
        success: 'parseLogs',
        error: 'onTaskError'
      });
    }
  },

  parseLogs: function (logs) {
    this.get('logs').pushObject(logs.tasks);
    if (this.get('currentRequestIds').length === this.get('logs').length) {
      var tasks = [];
      this.get('logs').forEach(function (logs) {
        tasks.pushObjects(logs);
      }, this);
      var self = this;
      var currentTaskId = this.get('currentTaskId');
      if (!tasks.someProperty('Tasks.status', 'PENDING') && !tasks.someProperty('Tasks.status', 'QUEUED') && !tasks.someProperty('Tasks.status', 'IN_PROGRESS')) {
        this.set('currentRequestIds', []);
        if (tasks.someProperty('Tasks.status', 'FAILED') || tasks.someProperty('Tasks.status', 'TIMEDOUT') || tasks.someProperty('Tasks.status', 'ABORTED')) {
          this.setTaskStatus(currentTaskId, 'FAILED');
        } else {
          this.setTaskStatus(currentTaskId, 'COMPLETED');
        }
      } else {
        var actionsPerHost = tasks.length;
        var completedActions = tasks.filterProperty('Tasks.status', 'COMPLETED').length
          + tasks.filterProperty('Tasks.status', 'FAILED').length
          + tasks.filterProperty('Tasks.status', 'ABORTED').length
          + tasks.filterProperty('Tasks.status', 'TIMEDOUT').length;
        var queuedActions = tasks.filterProperty('Tasks.status', 'QUEUED').length;
        var inProgressActions = tasks.filterProperty('Tasks.status', 'IN_PROGRESS').length;
        var progress = Math.ceil(((queuedActions * 0.09) + (inProgressActions * 0.35) + completedActions ) / actionsPerHost * 100);
        this.get('tasks').findProperty('id', currentTaskId).set('progress', progress);
        window.setTimeout(function () {
          self.doPolling();
        }, self.POLL_INTERVAL);
      }
    }
  },

  showHostProgressPopup: function (event) {
    var popupTitle = event.contexts[0].title;
    var requestIds = event.contexts[0].requestIds;
    var hostProgressPopupController = App.router.get('highAvailabilityProgressPopupController');
    hostProgressPopupController.initPopup(popupTitle, requestIds, this, true);
  },

  done: function () {
    if (!this.get('isSubmitDisabled')) {
      this.removeObserver('tasks.@each.status', this, 'onTaskStatusChange');
      App.router.send('next');
    }
  },

  back: function () {
    if (!this.get('isBackButtonDisabled')) {
      this.removeObserver('tasks.@each.status', this, 'onTaskStatusChange');
      App.router.send('back');
    }
  }

});


