(function() {
  'use strict';

  angular.module('fintrackApp', [])
    .service('WebSocketService', ['$rootScope', function($rootScope) {
      var service = this;
      service.socket = null;
      service.isConnected = false;

      service.connect = function(url) {
        service.socket = new WebSocket(url);

        service.socket.onopen = function() {
          service.isConnected = true;
          $rootScope.$apply(function() {
            $rootScope.$broadcast('wsConnected');
          });
        };

        service.socket.onmessage = function(event) {
          var data = JSON.parse(event.data);
          $rootScope.$apply(function() {
            $rootScope.$broadcast('wsMessage', data);
          });
        };

        service.socket.onclose = function() {
          service.isConnected = false;
          $rootScope.$apply(function() {
            $rootScope.$broadcast('wsDisconnected');
          });
        };

        service.socket.onerror = function(error) {
          $rootScope.$apply(function() {
            $rootScope.$broadcast('wsError', error);
          });
        };
      };

      service.send = function(message) {
        if (service.isConnected && service.socket.readyState === WebSocket.OPEN) {
          service.socket.send(JSON.stringify(message));
        }
      };
    }])
    .controller('DashboardController', ['$scope', 'WebSocketService', function($scope, WebSocketService) {
      $scope.balance = 0;
      $scope.income = 0;
      $scope.expenses = 0;
      $scope.savingRate = 0;

      $scope.transactions = [];

      // Connect to WebSocket server
      WebSocketService.connect('ws://localhost:8080'); // Adjust URL as needed

      $scope.$on('wsConnected', function() {
        console.log('WebSocket connected');
      });

      $scope.$on('wsMessage', function(event, data) {
        // Handle incoming real-time data updates
        if (data.type === 'updateDashboard') {
          $scope.balance = data.balance;
          $scope.income = data.income;
          $scope.expenses = data.expenses;
          $scope.savingRate = data.savingRate;
          $scope.$apply();
        }
        if (data.type === 'newTransaction') {
          $scope.transactions.push(data.transaction);
          $scope.$apply();
        }
      });

      $scope.$on('wsDisconnected', function() {
        console.log('WebSocket disconnected');
      });

      $scope.$on('wsError', function(event, error) {
        console.error('WebSocket error:', error);
      });
    }]);
})();
