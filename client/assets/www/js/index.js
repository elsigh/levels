/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
var app = {
    // Application Constructor
    initialize: function() {
        app.bindEvents();
    },
    // Bind Event Listeners
    //
    // Bind any events that are required on startup. Common events are:
    // 'load', 'deviceready', 'offline', and 'online'.
    bindEvents: function() {
        document.addEventListener('deviceready', app.onDeviceReady, false);
        console.log('deviceready is bound');
    },
    // deviceready Event Handler
    //
    // The scope of 'this' is the event. In order to call the 'receivedEvent'
    // function, we must explicity call 'app.receivedEvent(...);'
    onDeviceReady: function() {
        console.log('onDeviceReady!');
        app.receivedEvent('deviceready');
        $('#deviceready').attr('class', '');

        var $batteryInfoEl = $('#battery-info');
        window.addEventListener('batterystatus', function(batteryInfo) {
            var html = '<ul>';
            _.each(['timeStamp', 'isPlugged', 'level'], function(key) {
                var val = batteryInfo[key];
                html += '<li><b>' + key + '</b>: <span>' + val + '</span></li>';
            });
            html += '</ul>';
            $batteryInfoEl.html(html);
        }, false);

        console.log('All set up and monitoring batterystatus.');
    },
    // Update DOM on a Received Event
    receivedEvent: function(id) {
        console.log('Received Event: ', id);
        var $parentElement = $('#' + id);
        $parentElement.find('.listening').hide();
        $parentElement.find('.received').show();
    }
};
