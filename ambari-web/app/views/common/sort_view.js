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

var misc = require('utils/misc');
var stringUtils = require('utils/string_utils');
var App = require('app');

/**
 * Wrapper View for all sort components. Layout template and common actions are located inside of it.
 * Logic specific for sort fields
 * located in inner view - <code>fieldView</code>.
 *
 * @type {*}
 */
var wrapperView = Em.View.extend({
  tagName: 'tr',

  classNames: ['sort-wrapper'],

  willInsertElement: function () {
    if (this.get('parentView.tableFilteringComplete')) {
      this.get('parentView').set('filteringComplete', true);
    }
  },

  /**
   * Load sort statuses from local storage
   * Works only after finish filtering in the parent View
   */
  loadSortStatuses: function () {
    var statuses = App.db.getSortingStatuses(this.get('controller.name'));
    if (!this.get('parentView.filteringComplete')) return;
    if (statuses) {
      var childViews = this.get('childViews');
      var self = this;
      statuses.forEach(function (st) {
        if (st.status != 'sorting') {
          var sortOrder = false;
          if (st.status == 'sorting_desc') {
            sortOrder = true;
          }
          self.sort(childViews.findProperty('name', st.name), sortOrder);
          childViews.findProperty('name', st.name).set('status', (sortOrder) ? 'sorting_desc' : 'sorting_asc');
          self.get('controller').set('sortingColumn', childViews.findProperty('name', st.name));
        }
        else {
          childViews.findProperty('name', st.name).set('status', st.status);
        }
      });
    }
  }.observes('parentView.filteringComplete'),

  /**
   * Save sort statuses to local storage
   * Works only after finish filtering in the parent View
   */
  saveSortStatuses: function () {
    if (!this.get('parentView.filteringComplete')) return;

    var statuses = [];
    this.get('childViews').forEach(function (childView) {
      statuses.push({
        name: childView.get('name'),
        status: childView.get('status')
      });
    });
    App.db.setSortingStatuses(this.get('controller.name'), statuses);
  },

  /**
   * sort content by property
   * @param property {object}
   * @param order {Boolean} true - DESC, false - ASC
   * @param returnSorted {Boolean}
   */
  sort: function (property, order, returnSorted) {
    var content = this.get('content').toArray();
    var sortFunc = this.getSortFunc(property, order);
    var status = order ? 'sorting_desc' : 'sorting_asc';

    this.resetSort();
    this.get('childViews').findProperty('name', property.get('name')).set('status', status);
    this.saveSortStatuses(property, order);
    content.sort(sortFunc);

    if (!!returnSorted) {
      return content;
    } else {
      this.set('content', content);
    }
  },

  isSorting: false,

  onContentChange: function () {
    if (!this.get('isSorting') && this.get('content.length')) {
      this.get('childViews').forEach(function (view) {
        if (view.status !== 'sorting') {
          var status = view.get('status');
          this.set('isSorting', true);
          this.sort(view, status == 'sorting_desc');
          this.set('isSorting', false);
          view.set('status', status);
        }
      }, this);
    }
  }.observes('content.length'),

  /**
   * reset all sorts fields
   */
  resetSort: function () {
    this.get('childViews').setEach('status', 'sorting');
  },
  /**
   * determines sort function depending on the type of sort field
   * @param property
   * @param order
   * @return {*}
   */
  getSortFunc: function (property, order) {
    var func;
    switch (property.get('type')) {
      case 'ip':
        func = function (a, b) {
          var a = misc.ipToInt(a.get(property.get('name')));
          var b = misc.ipToInt(b.get(property.get('name')));
          if (order) {
            return b - a;
          } else {
            return a - b;
          }
        };
        break;
      case 'number':
        func = function (a, b) {
          var a_p = a.get(property.get('name'));
          var b_p = b.get(property.get('name'));
          a_p = Em.isNone(a_p) ? -Infinity : parseFloat(a_p);
          b_p = Em.isNone(b_p) ? -Infinity : parseFloat(b_p);
          if (order) {
            return b_p - a_p;
          } else {
            return a_p - b_p;
          }
        };
        break;
      case 'version':
        func = function (a, b) {
          var res = stringUtils.compareVersions(a.get(property.get('name')), b.get(property.get('name')));
          if (order) {
            return res;
          } else {
            return -res;
          }
        };
        break;
      case 'alert_status':
        func = function (a, b) {
          var a_summary = a.get('summary'),
            b_summary = b.get('summary'),
            st_order = a.get('severityOrder'),
            ret = 0;
          for (var i = 0; i < st_order.length; i++) {
            var a_v = Em.isNone(a_summary[st_order[i]]) ? 0 : a_summary[st_order[i]],
              b_v = Em.isNone(b_summary[st_order[i]]) ? 0 : b_summary[st_order[i]];
            ret = b_v - a_v;
            if (ret !== 0) {
              break;
            }
          }
          if (order) {
            return ret;
          }
          else {
            return -ret;
          }
        };
        break;
      default:
        func = function (a, b) {
          var a_p = a.get(property.get('name'));
          var b_p = b.get(property.get('name'));
          a_p = Em.isNone(a_p) ? '' : '' + a_p;
          b_p = Em.isNone(b_p) ? '' : '' + b_p;
          return order ? a_p.localeCompare(b_p) : b_p.localeCompare(a_p)
        };
    }
    return func;
  }
});

/**
 * view that carry on sorting on server-side via <code>refresh()</code> in parentView
 * @type {*}
 */
var serverWrapperView = Em.View.extend({
  tagName: 'tr',

  classNames: ['sort-wrapper'],

  willInsertElement: function () {
    this.loadSortStatuses();
  },

  /**
   * Initialize and save sorting statuses: publicHostName sorting_asc
   */
  loadSortStatuses: function () {
    var statuses = [];
    var childViews = this.get('childViews');
    childViews.forEach(function (childView) {
      var sortStatus = (childView.get('name') == 'publicHostName' && childView.get('status') == 'sorting') ? 'sorting_asc' : childView.get('status');
      statuses.push({
        name: childView.get('name'),
        status: sortStatus
      });
      childView.set('status', sortStatus);
    });
    App.db.setSortingStatuses(this.get('controller.name'), statuses);
    this.get('controller').set('sortingColumn', childViews.findProperty('name', 'publicHostName'));
  },

  /**
   * Save sort statuses to local storage
   * Works only after finish filtering in the parent View
   */
  saveSortStatuses: function () {
    var statuses = [];
    this.get('childViews').forEach(function (childView) {
      statuses.push({
        name: childView.get('name'),
        status: childView.get('status')
      });
    });
    App.db.setSortingStatuses(this.get('controller.name'), statuses);
  },

  /**
   * sort content by property
   * @param property {object}
   * @param order {Boolean} true - DESC, false - ASC
   */
  sort: function (property, order) {
    var status = order ? 'sorting_desc' : 'sorting_asc';

    this.resetSort();
    this.get('childViews').findProperty('name', property.get('name')).set('status', status);
    this.saveSortStatuses();
    this.get('parentView').refresh();
  },

  /**
   * reset all sorts fields
   */
  resetSort: function () {
    this.get('childViews').setEach('status', 'sorting');
  }
});
/**
 * particular view that contain sort field properties:
 * name - name of property in content table
 * type(optional) - specific type to sort
 * displayName - label to display
 * @type {*}
 */
var fieldView = Em.View.extend({
  template: Em.Handlebars.compile('<span {{bindAttr class="view.status :column-name"}}>{{view.displayName}}</span>'),
  classNameBindings: ['viewNameClass'],
  tagName: 'th',
  name: null,
  displayName: null,
  status: 'sorting',
  viewNameClass: function () {
    return 'sort-view-' + this.get('column');
  }.property(),
  type: null,
  column: 0,
  /**
   * callback that run sorting and define order of sorting
   * @param event
   */
  click: function (event) {
    this.get('parentView').sort(this, (this.get('status') !== 'sorting_desc'));
    this.get('controller').set('sortingColumn', this);
  }
});

/**
 * Result object, which will be accessible outside
 * @type {Object}
 */
module.exports = {
  serverWrapperView: serverWrapperView,
  wrapperView: wrapperView,
  fieldView: fieldView
};