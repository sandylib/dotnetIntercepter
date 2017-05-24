(function() {

    'use strict';

    var app = angular.module('insuranceApp');

    app.factory('eziClientService', [
        '$http', 'InitService', 'LogService', function ($http, InitService, LogService) {

            var vm = this;
            vm.LogService = LogService;

            vm.testPublicKey = function () {
                var eziURL = null;
                var eziPublicKey = null;               

                if (InitService.appState.payObject.isValid) {
                    eziURL = InitService.appState.payObject.eziJSUrl;
                    eziPublicKey = InitService.appState.payObject.eziPublicKey;

                    vm.LogService.update('eziClientService::testPublicKey::query::' + eziURL + '/TestPublicKey?PublicKey=' + eziPublicKey + '&callback=JSON_CALLBACK');

                    //console.log("vm.testPublicKey::" + eziURL);
                    //if (!eziURL)
                    //    return null;

                    return $http.jsonp(eziURL + '/TestPublicKey?PublicKey=' + eziPublicKey + '&callback=JSON_CALLBACK');
                }

                return null;
            };
           
            //go to the ezidebit
            vm.saveCustomer = function (params) {
                var eziURL = null;
                var eziPublicKey = null;
                vm.LogService.update('eziClientService::saveCustomer');

                if (InitService.appState.payObject.isValid) {
                    eziURL = InitService.appState.payObject.eziJSUrl;
                    eziPublicKey = InitService.appState.payObject.eziPublicKey;

                    //NOTE: Both saveCustomer and saveCustomerAccount both calls the same API. This one calls with CreditCard details
                    var query = eziURL + '/AddCustomer?PublicKey=' + eziPublicKey + '&';

                    for (var key in params) {
                        query += encodeURIComponent(key) + '=' + encodeURIComponent(params[key]) + '&';
                    }
                    query += 'callback=JSON_CALLBACK';

                    //console.log('eziClientService::saveCustomer::' + query);
                    return $http.jsonp(query);
                }
                return null;
            };
           
            vm.changeCustomer = function (params) {               
                var eziURL = null;
                var eziPublicKey = null;
                vm.LogService.update('eziClientService::changeCustomer');

                if (InitService.appState.payObject.isValid) {
                    eziURL = InitService.appState.payObject.eziJSUrl;
                    eziPublicKey = InitService.appState.payObject.eziPublicKey;

                    var query = eziURL + '/ChangeCustomerPaymentInfo?PublicKey=' + eziPublicKey + '&';

                    for (var key in params) {
                        query += encodeURIComponent(key) + '=' + encodeURIComponent(params[key]) + '&';
                    }
                    query += 'callback=JSON_CALLBACK';

                    //console.log('eziClientService::changeCustomer::' + query);
                    return $http.jsonp(query);
                }
                return null;
            };
            

            vm.requireRefetch = function (responseData) {

                return (responseData != null &&
                        responseData.data != null &&
                        responseData.data.Error === 201);
            }

            return vm;
        }
    ]);
})();