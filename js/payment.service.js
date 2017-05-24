(function() {
    'use strict';

    var app = angular.module('insuranceApp');

    app.factory('paymentService', [
          'jsHelperService', 'InitService', 'eziClientService', 'LogService', 'bizClientService', 'OverlayService', '$q',  '$rootScope','$filter',
    function (jsHelperService, InitService, eziClientService, LogService, bizClientService, OverlayService, $q,  $rootScope,$filter) {

              var vm = this;

              vm.OverlayService = OverlayService;
              vm.LogService = LogService;
              vm.paymentRequired = InitService.appState.paymentRequired;
              vm.useAccountPayment = InitService.appState.allowAccountPayment;
              vm.jsHelperService = jsHelperService;
              vm.paymentClientsideErrorMsg = 'We are sorry, your payment was declined - [errorMessage]';
              vm.paymentServersideErrorMsg = 'We are sorry, your payment has been unsuccessful  - [errorMessage]';
              vm.orderServersideErrorMsg = 'We are sorry, your order has been unsuccessful  - [errorMessage]';

              vm.dbDateFormat = 'yyyy-MM-dd';

              vm.setProcessingStatus = function (status) {
                  OverlayService.showOverlay = status;
                  vm.isProcessing = status;
              };

              vm.isProcessing = false;           
              vm.useExistingPayment = false;// should pass inuserError              
              vm.updateUseExistingPayment = function (useExistingPayment) {
                  vm.useExistingPayment = useExistingPayment;
              };
                            
              vm.forceFetchBillingToken = false;

              vm.updateForceFetchBillingToken = function (value) {
                  vm.forceFetchBillingToken = value;

              };
              
              vm.CustomerRef = 0;

              vm.updateCustomerRef = function (customerRef) {
                  vm.CustomerRef = customerRef;
              };
            
              vm.updateManualReferral = function (manualReferral) {
                  vm.manualReferral = manualReferral;
              };

              vm.isSubmissionMode = function () {
                  var submissionRequired = InitService.appState.submissionRequired;
                  var isAdminReferral = !!vm.manualReferral && vm.manualReferral.adminReferral;
                  return submissionRequired || isAdminReferral;
              };

              vm.testKey = function () {

                  if (vm.useAccountPayment || vm.isSubmissionMode()) {
                      var deferred = $q.defer();
                      deferred.resolve(0);
                      return deferred.promise;
                  } else {
                      return eziClientService.testPublicKey().
                          then(function (data, status) {

                              //Success reponse
                              if (data != null && data.data != null & data.data.Error === 0) {
                                  //Success                                    
                                  LogService.update('paymentCtrl::testKey().success result code:');
                              } else {
                                  //Fail                                    
                                  LogService.update('paymentCtrl::testKey().fail result code:');

                                  var errMsg = '';
                                  if (data != null && data.data != null && data.data.ErrorMessage != null)
                                      errMsg = data.data.ErrorMessage;

                                  return $q.reject(errMsg);
                              }

                          }, function (errorMessage) {
                              //Error response

                              LogService.update('paymentCtrl::testKey().errorMessage' + errorMessage);
                              return $q.reject(errorMessage);
                          });
                  }
              };
              
              //see how to pass the error down to the payment and summary page
              vm.updateUserError = function (errorStr) {
                  vm.userError = errorStr;
              };

              
              vm.updateCustomerParams = function (params) {
                  vm.customerParams = updateParamsDateFormat(params);
              };

              vm.updateParamsForMarkOrdered = function (params) {
                  vm.paramsForMarkOrdered = updateParamsDateFormat(params);
              };

              vm.updateParamsForTokenPayment = function (params) {
                  vm.paramsForTokenPayment = updateParamsDateFormat(params);
              };
                            

              //move 
              vm.showErrorDetails = function () {

                  var msg = '';

                  if (vm.isError) {
                      msg = vm.userError;

                      //Server err messages
                      if (vm.PaymentResult != null &&
                          typeof vm.PaymentResult === 'object' &&
                          typeof vm.PaymentResult.data === 'object' &&
                          vm.PaymentResult.data.Message != null) {

                          msg = msg.replace('[errorMessage]', vm.PaymentResult.data.Message);
                      }
                          //client side err messages
                      else if (typeof vm.PaymentResult !== 'object' && vm.PaymentResult !== null)
                          //msg = msg + ' - ' + vm.PaymentResult;
                          msg = msg.replace('[errorMessage]', vm.PaymentResult);
                  }

                  msg = msg.replace('[errorMessage]', '');
                  vm.LogService.update('paymentCtrl::showErrorDetails::' + msg);
                  vm.userError = msg;
              }


              vm.isTokenExists = function () {

                  var customerRef = parseInt(vm.CustomerRef, 10);

                  if (!angular.isUndefined(vm.CustomerRef) && vm.CustomerRef !== '' && !angular.isUndefined(customerRef) && (customerRef >= 100))
                      return true;

                  else
                      return false;
              };

              vm.saveCustomer = function () {

                  vm.LogService.update('saveCustomer()');

                  return eziClientService.saveCustomer(vm.customerParams)
                      .then(function (data, status) {

                          //Success reponse
                          if (data != null && data.data != null & data.data.Error == 0) {
                              //Success

                              vm.LogService.update('paymentCtrl::saveCustomer().success.');
                              vm.CustomerRef = data.data.Data.CustomerRef;//get new token
                              updatetokenPaymentParams(vm.CustomerRef,vm.paramsForTokenPayment);
                              $rootScope.$broadcast('fetchedNewToken', vm.CustomerRef);
                              return 0;
                          } else {
                              //Fail

                              vm.LogService.update('paymentCtrl::saveCustomer().failed.');
                              //return $q.reject('Failed: saveCustomer');

                              var errMsg = '';
                              if (data != null && data.data != null && data.data.ErrorMessage != null)
                                  errMsg = data.data.ErrorMessage;

                              return $q.reject(errMsg);
                          }

                      }, function (data) {
                          //Error response
                          vm.LogService.update('paymentCtrl::saveCustomer().error response');
                          //return $q.reject('Monthly/System error');
                          return $q.reject(data);
                      });
              };


              vm.changeCustomer = function () {
                  return eziClientService.changeCustomer(vm.customerParams)
                      .then(function (data, status) {
                          //Success reponse

                          if (data != null && data.data != null & data.data.Error == 0) {
                              //Success
                              vm.LogService.update('paymentCtrl::changeCustomer().success.');
                              return 0;
                          } else {
                              //Fail                              
                              //Check if the request returned an error code  of 201.
                              //if yes, fetch billing token from eziDebit webservice and re-initiate payment
                              vm.forceFetchBillingToken = eziClientService.requireRefetch(data);//see this flag not effect the paymentandsummary page, then coould call an update method, or boadcast
                              $rootScope.$broadcast('forceFetchBillingToken', vm.forceFetchBillingToken);
                              var errMsg = '';
                              if (data != null && data.data != null && data.data.ErrorMessage != null)
                                  errMsg = '' + data.data.ErrorMessage + '';

                              vm.LogService.update('paymentCtrl::changeCustomer().fail result code:' + errMsg);

                              return $q.reject(errMsg);
                          }
                      }, function (data) {
                          //Error response
                          var errMsg = '';
                          if (data != null && data.data != null && data.data.ErrorMessage != null)
                              errMsg = '' + data.data.ErrorMessage + '';
                          vm.LogService.update('paymentCtrl::changeCustomer().error response::data::' + errMsg);
                          //return $q.reject('Customer/System error');
                          return $q.reject(data);
                      });
              };

              //PremiumFunding - new wrapper function which calls 'saveCustomer' or 'changeCustomer' based on the Token
              vm.updateCustomerData = function () {

                  if (!vm.paymentRequired || vm.useExistingPayment || vm.useAccountPayment || vm.isSubmissionMode()) {
                      return 0;
                  }

                  var tokenExists = vm.isTokenExists();
                  vm.LogService.update('paymentCtrl::PaymentGateway - isTokenExists::' + tokenExists);

                  if (tokenExists)
                      return vm.changeCustomer();
                  else
                      return vm.saveCustomer();
              }

              vm.clearExistingPaymentOption = function () {
                  if (!vm.useExistingPayment) {
                      vm.showExistingPaymentOption = false; //after payment this flag should update the payment and summary page's flag
                      $rootScope.$broadcast('updateShowExistingPaymentOption', vm.showExistingPaymentOption);
                  }
                  return 0;
              };


              vm.markOrdered = function () {
                  return bizClientService.markOrdered(vm.paramsForMarkOrdered)
                      .then(function (response) {

                          if (!vm.jsHelperService.isNullUndefEmpty(response.data.redirectUrl)) {
                              return $q.reject('');
                          }

                          //Success reponse
                          vm.LogService.update('paymentCtrl::markOrdered().success code:' + response);
                          return 0;

                      }, function (error, status) {
                          //Error response
                          var strData = '';
                          if (angular.isDefined(error))
                              strData = JSON.stringify(error);


                          vm.LogService.update('paymentCtrl::markOrdered().error data:' + strData + status);


                          return $q.reject(error); // $q.reject('System error');
                      });
              };

              vm.tokenPayment = function () {
                  return bizClientService.tokenPayment(vm.paramsForTokenPayment)
                        .then(function (response) {

                          //vm.LogService.update('tokenPayment().success response');
                          //vm.LogService.update('paymentCtrl::tokenPayment().success result code:' + JSON.stringify(data));

                          window.location.href = response.data;

                      }, function (error, status) {
                          //Error response
                          vm.LogService.update('paymentCtrl::tokenPayment().error code:' + status);

                          //var err = 'System error';
                          //if (data && data.data && data.data.Message)
                          //    err = data.data.Message;

                          return $q.reject(error); // $q.reject('System error');
                      });
              };

              vm.doSaveAndTakePaymentPremiumFunding = function () {
                  vm.setProcessingStatus(true);
                  vm.userError = '';
                  vm.isError = false;
                  vm.PaymentResult = '';
                  vm.isProcessing = false;

                  //Call services using chained promises with error handlers
                  //http://solutionoptimist.com/2013/12/27/javascript-promise-chains-2/
                  vm.testKey()
                      .then(vm.updateCustomerData, //testKey success, continue promise chain and call saveCustomer next
                          function (errorMessage) { //testKey failed, stop promise chain
                              if (!errorMessage) {
                                  return $q.reject();
                              }

                              vm.userError = vm.paymentClientsideErrorMsg;
                              //vm.userError = 'Error processing payment step A1 [' + errorMessage + ']';
                              vm.LogService.update('paymentCtrl::testKey() failed, promise chain terminated');
                              vm.PaymentResult = errorMessage;
                              vm.isError = true;
                              vm.setProcessingStatus(false);
                              return $q.reject();
                          })
                      .then(vm.clearExistingPaymentOption, //saveCustomer success, continue promise chain and call tokenPayment next
                          function (errorMessage) { //saveCustomer failed, stop promise chain
                              if (!errorMessage) {
                                  return $q.reject();
                              }

                              vm.userError = vm.paymentClientsideErrorMsg;
                              //vm.userError = 'Error processing payment step A2 [' + errorMessage + ']';
                              vm.LogService.update('paymentCtrl::saveCustomer() failed, promise chain terminated - ' + errorMessage);
                              vm.PaymentResult = errorMessage;
                              vm.isError = true;
                              vm.setProcessingStatus(false);
                              return $q.reject();
                          })
                      .then(vm.markOrdered)
                      .then(vm.tokenPayment, //markOrdered success, continue promise chain and call tokenPayment next
                          function (errorMessage) { //markOrdered failed, stop promise chain
                              if (vm.jsHelperService.isNullUndefEmpty(errorMessage)) {
                                  return $q.reject();
                              }

                              vm.userError = vm.orderServersideErrorMsg;
                              //vm.userError = 'Error processing payment step A3 [' + errorMessage + ']';
                              vm.LogService.update('paymentCtrl::markOrdered() failed, promise chain terminated');
                              vm.PaymentResult = errorMessage;
                              vm.isError = true;
                              vm.setProcessingStatus(false);
                              return $q.reject();
                          })
                      .then(null,
                          function (errorMessage) { //markOrdered failed, stop promise chain
                              if (!errorMessage) {
                                  return $q.reject();
                              }

                              vm.userError = vm.paymentServersideErrorMsg;
                              //vm.userError = 'Error processing payment step A4 [' + errorMessage + ']';
                              vm.LogService.update('paymentCtrl::tokenPayment() failed, promise chain terminated');
                              vm.PaymentResult = errorMessage;
                              vm.isError = true;
                              vm.setProcessingStatus(false);
                              return $q.reject();
                          })
                      .finally(function () {
                          
                          if (vm.isError) {
                              vm.showErrorDetails();
                          }

                          $rootScope.$broadcast('processingDone', {
                              'userError': vm.userError,
                              'paymentResult': vm.PaymentResult,
                              'isError': vm.isError,
                              'setProcessingStatus':false

                          })
                      });                
              }
           
              return vm;

              ///
              function updatetokenPaymentParams(customerRef, paramsForTokenPayment) {                  
                
                  if (paramsForTokenPayment.hasOwnProperty('BillingToken'))
                      paramsForTokenPayment.BillingToken = customerRef;
                  if(paramsForTokenPayment.hasOwnProperty('EzidebitCustomerRef'))
                      paramsForTokenPayment.EzidebitCustomerRef = customerRef;
              } 

              function updateParamsDateFormat(params) {
                  if (params == null)
                      return params;

                  var updatedParams = params;
                  var dateArray = ['StartDate', 'AnnualPaymentDate', 'FirstInstalmentDate', , 'ContractStartDate'];

                  _.each(dateArray, function(date) {
                      if (updatedParams.hasOwnProperty(date))
                          updatedParams[date] = $filter('date')(new Date(updatedParams[date]), vm.dbDateFormat);
                  });
                                 
                 return updatedParams;                  
              }
        }
    ]);

})();