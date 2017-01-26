var app = angular.module('esco', ['ui.bootstrap', 'ngCookies', 'pascalprecht.translate', 'timer', 'angular-growl', 'angular-ellipses', 'GTMLogger','utilsModule']);
var db = {};
var bidder_id = "0";
var auction_doc_id = auction_doc_id || "";
var db_url = db_url || "";

app.constant('AuctionConfig', {
  auction_doc_id: auction_doc_id,
  remote_db: db_url,
  restart_retries: 10,
  default_lang: 'uk',
  debug: false
});

app.filter('formatnumber', ['$filter',
  function(filter) {
    return function(val) {
      return (filter('number')(val) || "").replace(/,/g, " ") || "";
    }
  }
]);

app.config(['$logProvider', 'AuctionConfig', 'growlProvider', 'GTMLoggerProvider', function($logProvider, AuctionConfig, growlProvider, GTMLoggerProvider) {
    GTMLoggerProvider.level('INFO').includeTimestamp( true )
    $logProvider.debugEnabled(AuctionConfig.debug); // default is true
    growlProvider.globalTimeToLive({
        success: 4000,
        error: 10000,
        warning: 10000,
        info: 4000
    });
    growlProvider.globalPosition('top-center');
    growlProvider.onlyUniqueMessages(false);
}]);

function logMSG(MSG)
{
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open("POST", '/log', true);
    xmlHttp.send(JSON.stringify(MSG));
}

var evtSrc = {};

var dataLayer = dataLayer || [];

angular.module('esco').controller('escoController', [
  '$scope', 'AuctionConfig', 'utilsService',
  '$timeout', '$http', '$log', '$cookies', '$cookieStore', '$window',
  '$rootScope', '$location', '$translate', '$filter', 'growl', 'growlMessages', 'aside', '$q',
  function(
    $scope, AuctionConfig, utilsService,
    $timeout, $http, $log, $cookies, $cookieStore, $window,
    $rootScope, $location, $translate, $filter, growl, growlMessages, $aside, $q
  ) {
    if (utilsService.inIframe()) {
      $log.error('Starts in iframe');
      window.open(location.href, '_blank');
      return false;
    }
    $scope.lang = 'uk';
    $rootScope.normilized = false;
    $rootScope.format_date = utilsService.format_date;
    $scope.bidder_id = null;
    $scope.bid = null;
    $scope.allow_bidding = true;
    $rootScope.form = {};
    $rootScope.alerts = [];
    $scope.default_http_error_timeout = 500;
    $scope.http_error_timeout = $scope.default_http_error_timeout;
    $scope.browser_client_id = utilsService.generateUUID();
    $scope.$watch(function() {return $cookies.logglytrackingsession}, function(newValue, oldValue) {
      $scope.browser_session_id = $cookies.logglytrackingsession;
    })
    $log.info({
      message: "Start session",
      browser_client_id: $scope.browser_client_id,
      user_agent: navigator.userAgent,
      tenderId: AuctionConfig.auction_doc_id
    })
    $rootScope.change_view = function() {
      if ($scope.bidder_coeficient) {
        $rootScope.normilized = !$rootScope.normilized
      }
    }
    $scope.start = function() {

      $log.info({
        message: "Setup connection to remote_db",
        auctions_loggedin: $cookies.auctions_loggedin||utilsService.detectIE()
      })
      if ($cookies.auctions_loggedin||utilsService.detectIE()) {
        AuctionConfig.remote_db = AuctionConfig.remote_db + "_secured";
      }
      $scope.changes_options = {
        timeout: 40000 - Math.ceil(Math.random() * 10000),
        heartbeat: 10000,
        live: true,
        style: 'main_only',
        continuous: true,
        include_docs: true,
        doc_ids: [AuctionConfig.auction_doc_id],
        since: 0
      };
      new PouchDB(AuctionConfig.remote_db).then(function(db) {
        $scope.db = db;
        $scope.http_error_timeout = $scope.default_http_error_timeout;
        $scope.start_auction_process();
      }).catch(function(err) {
        $log.error({
          message: "Error on setup connection to remote_db",
          error_data: error
        });
        $scope.http_error_timeout = $scope.http_error_timeout * 2;
        $timeout(function() {
          $scope.start();
        }, $scope.http_error_timeout);
      });
    };
    $scope.growlMessages = growlMessages;
    growlMessages.initDirective(0, 10);
    dataLayer.push({
      "tenderId": AuctionConfig.auction_doc_id
    });
    if (($translate.storage().get($translate.storageKey()) === "undefined") || ($translate.storage().get($translate.storageKey()) === undefined)) {
      $translate.use(AuctionConfig.default_lang);
      $scope.lang = AuctionConfig.default_lang;
    } else {
      $scope.lang = $translate.storage().get($translate.storageKey()) || $scope.lang;
    }

    /*      Time stopped events    */
    $rootScope.$on('timer-stopped', function(event) {
      if (($scope.auction_doc) && (event.targetScope.timerid == 1) && ($scope.auction_doc.current_stage == -1)) {
        if (!$scope.auction_not_started){
          $scope.auction_not_started = $timeout(function() {
            if($scope.auction_doc.current_stage === -1){
              growl.warning('Please wait for the auction start.', {ttl: 120000, disableCountDown: true});
              $log.info({message: "Please wait for the auction start."});
            }
          }, 10000);
        }

        $timeout(function() {
          if($scope.auction_doc.current_stage === -1){
            $scope.sync_times_with_server();
          }
        }, 120000);
      }
    })
    /*      Time tick events    */
    $rootScope.$on('timer-tick', function(event) {
      if (($scope.auction_doc) && (event.targetScope.timerid == 1)) {
        if (((($rootScope.info_timer || {}).msg || "") === 'until your turn') && (event.targetScope.minutes == 1) && (event.targetScope.seconds == 50)) {
          $http.post('./check_authorization').success(function(data) {
            $log.info({
              message: "Authorization checked"
            });
          }).error(function(data, status, headers, config) {
            $log.error({
              message: "Error while check_authorization"
            });
            if (status == 401) {
              growl.error('Ability to submit bids has been lost. Wait until page reloads.');
              $log.error({
                message: "Ability to submit bids has been lost. Wait until page reloads."
              });
              $timeout(function() {
                window.location.replace(window.location.href + '/relogin');
              }, 3000);
            }
          });
        };
        $timeout(function() {
          $rootScope.time_in_title = event.targetScope.days ? (event.targetScope.days + $filter('translate')('days') + " ") : "";
          $rootScope.time_in_title += event.targetScope.hours ? (utilsService.pad(event.targetScope.hours) + ":") : "";
          $rootScope.time_in_title += (utilsService.pad(event.targetScope.minutes) + ":");
          $rootScope.time_in_title += (utilsService.pad(event.targetScope.seconds) + " ");
        }, 10);
      } else {
        var date = new Date();
        $scope.seconds_line = utilsService.polarToCartesian(24, 24, 16, (date.getSeconds() / 60) * 360);
        $scope.minutes_line = utilsService.polarToCartesian(24, 24, 16, (date.getMinutes() / 60) * 360);
        $scope.hours_line = utilsService.polarToCartesian(24, 24, 14, (date.getHours() / 12) * 360);
      }
    });

    /*      Kick client event    */
    $scope.$on('kick_client', function(event, client_id, msg) {
      $log.info({
        message: 'disable connection for client' + client_id
      });
      $scope.growlMessages.deleteMessage(msg);
      $http.post('./kickclient', {
        'client_id': client_id
      }).success(
        function(data) {
          $log.info({
            message: 'disable connection for client ' + client_id
          });
        });
    });
    //


    $scope.start_subscribe = function(argument) {
      $log.info({
        message: 'Start event source'
      });
      response_timeout = $timeout(function() {
        $http.post('./set_sse_timeout', {
          timeout: '7'
        }).success(function(data) {
          $log.info({
            message: 'Handled set_sse_timeout on event source'
          });
        });
        $log.info({
          message: 'Start set_sse_timeout on event source'
        });
      }, 20000);
      evtSrc = new EventSource(window.location.href.replace(window.location.search, '') + '/event_source', {
        'withCredentials': true
      });
      $scope.restart_retries_events = 3;
      evtSrc.addEventListener('ClientsList', function(e) {
        var data = angular.fromJson(e.data);
        $log.info({
          message: 'Get Clients List',
          clients: data
        });
        $scope.$apply(function() {
          var i;
          if (angular.isObject($scope.clients)) {
            for (i in data) {
              if (!(i in $scope.clients)) {
                growl.warning($filter('translate')('In the room came a new user') + ' (IP:' + data[i].ip + ')' + '<button type="button" ng-click="$emit(\'kick_client\', + \'' + i + '\', message )" class="btn btn-link">' + $filter('translate')('prohibit connection') + '</button>', {
                  ttl: 30000,
                  disableCountDown: true
                });
              }
            }
          }
          $scope.clients = data;
        });
      }, false);
      evtSrc.addEventListener('Tick', function(e) {
        $scope.restart_retries_events = 3;
        var data = angular.fromJson(e.data);
        $scope.last_sync = new Date(data.time);
        $log.debug({
          message: "Tick: " + data
        });
        if ($scope.auction_doc.current_stage > -1) {
          $rootScope.info_timer = utilsService.prepare_info_timer_data($scope.last_sync, $scope.auction_doc, $scope.bidder_id, $scope.Rounds);
          $log.debug({
            message: "Info timer data",
            info_timer: $rootScope.info_timer
          });
          $rootScope.progres_timer = utilsService.prepare_progress_timer_data($scope.last_sync, $scope.auction_doc);
          $log.debug({
            message: "Progres timer data",
            progress_timer: $rootScope.progres_timer
          });
        }
      }, false);
      evtSrc.addEventListener('Identification', function(e) {
        if (response_timeout) {
          $timeout.cancel(response_timeout);
        }
        var data = angular.fromJson(e.data);
        $log.info({
          message: "Get Identification",
          bidder_id: data.bidder_id,
          client_id: data.client_id
        });
        $scope.start_sync_event.resolve('start');
        $scope.$apply(function() {
          $scope.bidder_id = data.bidder_id;
          $scope.client_id = data.client_id;
          $scope.return_url = data.return_url;
          if ('coeficient' in data) {
            $scope.bidder_coeficient = math.fraction(data.coeficient);
            $log.info({
              message: "Get coeficient " + $scope.bidder_coeficient
            });
          }
        });
      }, false);

      evtSrc.addEventListener('RestoreBidAmount', function(e) {
        if (response_timeout) {
          $timeout.cancel(response_timeout);
        }
        var data = angular.fromJson(e.data);
        $log.debug({
          message: "RestoreBidAmount"
        });
        $scope.$apply(function() {
          $rootScope.form.bid = data.last_amount;
        });
      }, false);

      evtSrc.addEventListener('KickClient', function(e) {
        var data = angular.fromJson(e.data);
        $log.info({
          message: "Kicked"
        });
        window.location.replace(window.location.protocol + '//' + window.location.host + window.location.pathname + '/logout');
      }, false);
      evtSrc.addEventListener('Close', function(e) {
        $timeout.cancel(response_timeout);
        $log.info({
          message: "Handle close event source"
        });
        if (!$scope.follow_login_allowed) {
          growl.info($filter('translate')('You are an observer and cannot bid.'), {
            ttl: -1,
            disableCountDown: true
          });
          var params = utilsService.parseQueryString(location.search);
          if (params.loggedin) {
            $timeout(function() {
              window.location.replace(window.location.protocol + '//' + window.location.host + window.location.pathname);
            }, 1000);
          }
        }
        $scope.start_sync_event.resolve('start');
        evtSrc.close();
      }, false);
      evtSrc.onerror = function(e) {
        $timeout.cancel(response_timeout);
        $log.error({
          message: "Handle event source error",
          error_data: e
        });
        $scope.restart_retries_events = $scope.restart_retries_events - 1;
        if ($scope.restart_retries_events === 0) {
          evtSrc.close();
          $log.info({
            message: "Handle event source stoped"
          });
          if (!$scope.follow_login_allowed) {
            growl.info($filter('translate')('You are an observer and cannot bid.'), {
              ttl: -1,
              disableCountDown: true
            });
          }
        }
        return true;
      };
    };
    $scope.changeLanguage = function(langKey) {
      $translate.use(langKey);
      $scope.lang = langKey;
    };
    // Bidding form msgs
    $scope.closeAlert = function(msg_id) {
      for (var i = 0; i < $rootScope.alerts.length; i++) {
        if ($rootScope.alerts[i].msg_id == msg_id) {
          $rootScope.alerts.splice(i, 1);
          return true;
        }
      }
    };
    $scope.auto_close_alert = function(msg_id) {
      $timeout(function() {
        $scope.closeAlert(msg_id);
      }, 4000);
    };
    $scope.get_round_number = function(pause_index) {
      return utilsService.get_round_data(pause_index, $scope.auction_doc, $scope.Rounds);
    };
    $scope.show_bids_form = function(argument) {
      if ((angular.isNumber($scope.auction_doc.current_stage)) && ($scope.auction_doc.current_stage >= 0)) {
        if (($scope.auction_doc.stages[$scope.auction_doc.current_stage].type == 'bids') && ($scope.auction_doc.stages[$scope.auction_doc.current_stage].bidder_id == $scope.bidder_id)) {
          $log.info({
            message: "Allow view bid form"
          });
          $scope.max_bid_amount()
          $scope.view_bids_form = true;
          return $scope.view_bids_form;
        }
      }
      $scope.view_bids_form = true;
      return $scope.view_bids_form;
    };

    $scope.sync_times_with_server = function(start) {
      $http.get('../get_current_server_time', {
        'params': {
          '_nonce': Math.random().toString()
        }
      }).success(function(data, status, headers, config) {
        $scope.last_sync = new Date(new Date(headers().date));
        $rootScope.info_timer = utilsService.prepare_info_timer_data($scope.last_sync, $scope.auction_doc, $scope.bidder_id, $scope.Rounds);
        $log.debug({
          message: "Info timer data:",
          info_timer: $rootScope.info_timer
        });
        $rootScope.progres_timer = utilsService.prepare_progress_timer_data($scope.last_sync, $scope.auction_doc);
        $log.debug({
          message: "Progres timer data:",
          progress_timer: $rootScope.progres_timer
        });
        var params = utilsService.parseQueryString(location.search);
        if ($scope.auction_doc.current_stage == -1){
          if ($rootScope.progres_timer.countdown_seconds < 900) {
            $scope.start_changes_feed = true;
          }else{
            $timeout(function() {
              $scope.follow_login = true;
              $scope.start_changes_feed = true;
            }, ($rootScope.progres_timer.countdown_seconds - 900) * 1000);
          }
        }
        if ($scope.auction_doc.current_stage >= -1 && params.wait) {
          $scope.follow_login_allowed = true;
          if ($rootScope.progres_timer.countdown_seconds < 900) {
            $scope.follow_login = true;
          } else {
            $scope.follow_login = false;
            $timeout(function() {
              $scope.follow_login = true;
            }, ($rootScope.progres_timer.countdown_seconds - 900) * 1000);
          }
          $scope.login_params = params;
          delete $scope.login_params.wait;
          $scope.login_url = './login?' + utilsService.stringifyQueryString($scope.login_params);
        } else {
          $scope.follow_login_allowed = false;
        }
      }).error(function(data, status, headers, config) {

      });
    };
    $scope.warning_post_bid = function(){
      growl.error('Unable to place a bid. Check that no more than 2 auctions are simultaneously opened in your browser.');
    };
    $scope.post_bid = function(bid) {
      $log.info({
        message: "Start post bid",
        bid_data: parseFloat(bid) || parseFloat($rootScope.form.bid) || 0
      });

      if (parseFloat($rootScope.form.bid) == -1) {
        msg_id = Math.random();
        $rootScope.alerts.push({
          msg_id: msg_id,
          type: 'danger',
          msg: 'To low value'
        });
        $scope.auto_close_alert(msg_id);
        return 0;
      }
      if ($rootScope.form.BidsForm.$valid) {
        $rootScope.alerts = [];
        var bid_amount = parseFloat(bid) || parseFloat($rootScope.form.bid) || 0;
        if (bid_amount == $scope.minimal_bid.amount) {
          msg_id = Math.random();
          $rootScope.alerts.push({
            msg_id: msg_id,
            type: 'warning',
            msg: 'The proposal you have submitted coincides with a proposal of the other participant. His proposal will be considered first, since it has been submitted earlier.'
          });
        }
        $rootScope.form.active = true;
        $timeout(function() {
          $rootScope.form.active = false;
        }, 5000);
        if (!$scope.post_bid_timeout) {
          $scope.post_bid_timeout = $timeout($scope.warning_post_bid, 10000);
        }
        $http.post('./postbid', {
            'bid': parseFloat(bid) || parseFloat($rootScope.form.bid) || 0,
            'bidder_id': $scope.bidder_id || bidder_id || "0"
          }).success(function(data) {
            if ($scope.post_bid_timeout){
              $timeout.cancel($scope.post_bid_timeout);
              delete $scope.post_bid_timeout;
            }
            $rootScope.form.active = false;
            var msg_id = '';
            if (data.status == 'failed') {
              for (var error_id in data.errors) {
                for (var i in data.errors[error_id]) {
                  msg_id = Math.random();
                  $rootScope.alerts.push({
                    msg_id: msg_id,
                    type: 'danger',
                    msg: data.errors[error_id][i]
                  });
                  $log.info({
                    message: "Handle failed response on post bid",
                    bid_data: data.errors[error_id][i]
                  });
                  $scope.auto_close_alert(msg_id);
                }
              }
            } else {
              var bid = data.data.bid;
              if ((bid <= ($scope.max_bid_amount() * 0.1)) && (bid != -1)) {
                msg_id = Math.random();
                $rootScope.alerts.push({
                  msg_id: msg_id,
                  type: 'warning',
                  msg: 'Your bid appears too low'
                });
              }
              msg_id = Math.random();
              if (bid == -1) {
                $rootScope.alerts = [];
                $scope.allow_bidding = true;
                $log.info({
                  message: "Handle cancel bid response on post bid"
                });
                $rootScope.alerts.push({
                  msg_id: msg_id,
                  type: 'success',
                  msg: 'Bid canceled'
                });
                $log.info({
                  message: "Handle cancel bid response on post bid"
                });
                $rootScope.form.bid = "";
                $rootScope.form.full_price = '';
                $rootScope.form.bid_temp = '';

              } else {
                $log.info({
                  message: "Handle success response on post bid",
                  bid_data: data.data.bid
                });
                $rootScope.alerts.push({
                  msg_id: msg_id,
                  type: 'success',
                  msg: 'Bid placed'
                });
                $scope.allow_bidding = false;
              }
              $scope.auto_close_alert(msg_id);
            }
          })
          .error(function(data, status, headers, config) {
            $log.info({
              message: "Handle error on post bid",
              bid_data: status
            });
            if ($scope.post_bid_timeout){
              $timeout.cancel($scope.post_bid_timeout);
              delete $scope.post_bid_timeout;
            }
            if (status == 401) {
              $rootScope.alerts.push({
                msg_id: Math.random(),
                type: 'danger',
                msg: 'Ability to submit bids has been lost. Wait until page reloads, and retry.'
              });
              $log.error({
                message: "Ability to submit bids has been lost. Wait until page reloads, and retry."
              });
              relogin = function() {
                window.location.replace(window.location.href + '/relogin?amount=' + $rootScope.form.bid);
              }
              $timeout(relogin, 3000);
            } else {
              $log.error({
                message: "Unhandled Error while post bid",
                error_data: data
              });
              $timeout($scope.post_bid, 2000);
            }
          });
      }
    };
    $scope.edit_bid = function() {
      $scope.allow_bidding = true;
    };
    $scope.max_bid_amount = function() {
      var amount = 0;
      if ((angular.isString($scope.bidder_id)) && (angular.isObject($scope.auction_doc))) {
        var current_stage_obj = $scope.auction_doc.stages[$scope.auction_doc.current_stage] || null;
        if ((angular.isObject(current_stage_obj)) && (current_stage_obj.amount || current_stage_obj.amount_features)) {
          if ($scope.bidder_coeficient && ($scope.auction_doc.auction_type || "default" == "meat")) {
            amount = math.fraction(current_stage_obj.amount_features) * $scope.bidder_coeficient - math.fraction($scope.auction_doc.minimalStep.amount);
          } else {
            amount = math.fraction(current_stage_obj.amount) - math.fraction($scope.auction_doc.minimalStep.amount);
          }
        }
      };
      if (amount < 0) {
        $scope.calculated_max_bid_amount = 0;
        return 0;
      }
      $scope.calculated_max_bid_amount = amount;
      return amount;
    };
    $scope.calculate_minimal_bid_amount = function() {
      if ((angular.isObject($scope.auction_doc)) && (angular.isArray($scope.auction_doc.stages)) && (angular.isArray($scope.auction_doc.initial_bids))) {
        var bids = [];
        if ($scope.auction_doc.auction_type == 'meat') {
          filter_func = function(item, index) {
            if (!angular.isUndefined(item.amount_features)) {
              bids.push(item);
            }
          };
        } else {
          filter_func = function(item, index) {
            if (!angular.isUndefined(item.amount)) {
              bids.push(item);
            }
          };
        }
        $scope.auction_doc.stages.forEach(filter_func);
        $scope.auction_doc.initial_bids.forEach(filter_func);
        $scope.minimal_bid = bids.sort(function(a, b) {
          if ($scope.auction_doc.auction_type == 'meat') {
            var diff = math.fraction(a.amount_features) - math.fraction(b.amount_features);
          } else {
            var diff = b.amount - a.amount;
          }
          if (diff == 0) {
            return Date.parse(a.time || "") - Date.parse(b.time || "");
          }
          return diff;
        })[0];
      }
    };
    $scope.start_sync = function() {
      $scope.start_changes = new Date();
      $scope.changes = $scope.db.changes($scope.changes_options).on('change', function(resp) {
        $scope.restart_retries = AuctionConfig.restart_retries;
        if (resp.id == AuctionConfig.auction_doc_id) {
          $scope.replace_document(resp.doc);
          if ($scope.auction_doc.current_stage == ($scope.auction_doc.stages.length - 1)) {
            $scope.changes.cancel();
          }
        }
      }).on('error', function(err) {
        $log.error({
          message: "Changes error",
          error_data: err
        });
        $scope.end_changes = new Date()
        if ((($scope.end_changes - $scope.start_changes) > 40000)||($scope.force_heartbeat)) {
           $scope.force_heartbeat = true;
        } else {
          $scope.changes_options['heartbeat'] = false;
          $log.info({
            message: "Change heartbeat to false (Use timeout)",
            heartbeat: false
          });
        }
        $timeout(function() {
          if ($scope.restart_retries != AuctionConfig.restart_retries) {
            growl.warning('Internet connection is lost. Attempt to restart after 1 sec', {
              ttl: 1000
            });
          }
          $scope.restart_retries -= 1;
          if ($scope.restart_retries) {
            $log.debug({
              message: 'Restart feed pooling...'
            });
            $scope.restart_changes();
          } else {
            growl.error('Synchronization failed');
            $log.error({
              message: 'Synchronization failed'
            });
          }
        }, 1000);
      });
    };
    $scope.start_auction_process = function() {
      $scope.db.get(AuctionConfig.auction_doc_id, function(err, doc) {
        if (err) {
          if (err.status == 404) {
            $log.error({
              message: 'Not Found Error',
              error_data: err
            });
            $rootScope.document_not_found = true;
          } else {
            $log.error({
              message: 'Server Error',
              error_data: err
            });
            $scope.http_error_timeout = $scope.http_error_timeout * 2;
            $timeout(function() {
              $scope.start_auction_process()
            }, $scope.http_error_timeout);
          }
          return;
        }
        $scope.http_error_timeout = $scope.default_http_error_timeout;
        var params = utilsService.parseQueryString(location.search);

        $scope.start_sync_event = $q.defer();
        //
        if (doc.current_stage >= -1 && params.wait) {
          $scope.follow_login_allowed = true;
          $log.info({
            message: 'client wait for login'
          });
        } else {
          $scope.follow_login_allowed = false;
        };
        $scope.title_ending = utilsService.prepare_title_ending_data(doc, $scope.lang);
        $scope.replace_document(doc);
        //doc.auction_type && doc.auction_type == 'esco'  ? $scope.document_exists = true : $scope.document_exists = false;
        $scope.document_exists = true ;
        if (utilsService.UnsupportedBrowser()) {
            $timeout(function() {
              $scope.unsupported_browser = true;
              growl.error($filter('translate')('Your browser is out of date, and this site may not work properly.') + '<a style="color: rgb(234, 4, 4); text-decoration: underline;" href="http://browser-update.org/uk/update.html">' + $filter('translate')('Learn how to update your browser.') + '</a>', {
                  ttl: -1,
                  disableCountDown: true
                });
            }, 500);
        };
        $scope.scroll_to_stage();
        if ($scope.auction_doc.current_stage != ($scope.auction_doc.stages.length - 1)) {
          if ($cookieStore.get('auctions_loggedin')||utilsService.detectIE()) {
            $log.info({
              message: 'Start private session'
            });
            $scope.start_subscribe();
          } else {
            $log.info({
              message: 'Start anonymous session'
            });
            if ($scope.auction_doc.current_stage == - 1){
              $scope.$watch('start_changes_feed', function(newValue, oldValue){
                if(newValue && !($scope.sync)){
                   $log.info({
                    message: 'Start changes feed'
                  });
                  $scope.sync = $scope.start_sync()
                }
              })
            } else {
              $scope.start_sync_event.resolve('start');
            }
            if (!$scope.follow_login_allowed) {
              $timeout(function() {
                growl.info($filter('translate')('You are an observer and cannot bid.'), {
                  ttl: -1,
                  disableCountDown: true
                });
              }, 500)
            }
          }
          $scope.restart_retries = AuctionConfig.restart_retries;
          $scope.start_sync_event.promise.then(function() {
            $scope.sync = $scope.start_sync()
          });
        } else {
          // TODO: CLEAR COOKIE
          $log.info({
            message: 'Auction ends already'
          })
        }
      });
    };
    $scope.restart_changes = function() {
      $scope.changes.cancel();
      $timeout(function() {
        $scope.start_sync();
      }, 1000);
    };
    $scope.replace_document = function(new_doc) {
      if ((angular.isUndefined($scope.auction_doc)) || (new_doc.current_stage - $scope.auction_doc.current_stage === 0) || (new_doc.current_stage === -1)) {
        if (angular.isUndefined($scope.auction_doc)) {
          $log.info({
            message: 'Change current_stage',
            current_stage: new_doc.current_stage,
            stages: (new_doc.stages || []).length - 1
          });
        }
        $scope.auction_doc = new_doc;
      } else {
        $log.info({
          message: 'Change current_stage',
          current_stage: new_doc.current_stage,
          stages: (new_doc.stages || []).length - 1
        });
        $rootScope.form.bid = null;
        $scope.allow_bidding = true;
        $scope.auction_doc = new_doc;
      }
      $scope.sync_times_with_server();
      $scope.calculate_rounds();
      $scope.calculate_minimal_bid_amount();
      $scope.scroll_to_stage();
      $scope.show_bids_form();

      $scope.$apply();

    };
    $scope.calculate_rounds = function(argument) {
      $scope.Rounds = [];
      $scope.auction_doc.stages.forEach(function(item, index) {
        if (item.type == 'pause') {
          $scope.Rounds.push(index);
        }
      });
    };
    $scope.scroll_to_stage = function() {
      utilsService.scroll_to_stage($scope.auction_doc, $scope.Rounds);
    };
    $scope.array = function(int) {
      return new Array(int);
    };
    $scope.open_menu = function() {
      var modalInstance = $aside.open({
        templateUrl: 'templates/menu.html',
        controller: 'OffCanvasController',
        scope: $scope,
        size: 'lg',
        backdrop: true
      });
    };
    /* 2-WAY INPUT */
    $scope.calculate_bid_temp = function() {
      $rootScope.form.bid_temp = Number(math.fraction(($rootScope.form.bid * 100).toFixed(), 100));
      $rootScope.form.full_price = $rootScope.form.bid_temp / $scope.bidder_coeficient;
      $log.debug("Set bid_temp:", $rootScope.form);
    };
    $scope.calculate_full_price_temp = function() {
      $rootScope.form.bid = (math.fix((math.fraction($rootScope.form.full_price) * $scope.bidder_coeficient) * 100)) / 100;
      $rootScope.form.full_price_temp = $rootScope.form.bid / $scope.bidder_coeficient;
    };
    $scope.set_bid_from_temp = function() {
      $rootScope.form.bid = $rootScope.form.bid_temp;
      if ($rootScope.form.bid){
        $rootScope.form.BidsForm.bid.$setViewValue(math.format($rootScope.form.bid, {
          notation: 'fixed',
          precision: 2
        }).replace(/(\d)(?=(\d{3})+\.)/g, '$1 ').replace(/\./g, ","));
      }
    }
    $scope.start();
  }
]);


angular.module('esco').controller('OffCanvasController', ['$scope', '$modalInstance',
  function($scope, $modalInstance) {
    $scope.allert = function() {
    };
    $scope.ok = function() {
      $modalInstance.close($scope.selected.item);
    };
    $scope.cancel = function() {
      $modalInstance.dismiss('cancel');
    };
  }
]);


angular.module('esco').directive('nghReplace', function($compile, $parse, $rootScope) {
  return {
    replace: true,
    link: function(scope, element, attr) {
      scope.$watch(attr.content, function() {
        element.html($parse(attr.content)(scope));
        $compile(element.contents())(scope);
      }, true);
    }
  };
});

angular.module('esco')
  .directive('format', ['$filter', function($filter) {
    return {
      require: '?ngModel',
      link: function(scope, elem, attrs, ctrl) {
        if (!ctrl) return;
        ctrl.$formatters.unshift(function(value) {
          if (value) {
            var formatters_value = math.format(Number(value), {
              notation: 'fixed',
              precision: 2
            }).replace(/(\d)(?=(\d{3})+\.)/g, '$1 ').replace(/\./g, ",");
            ctrl.prev_value = formatters_value;
            return formatters_value
          } else {
            return ""
          }
        });
        ctrl.$parsers.unshift(function(viewValue) {
          console.log(viewValue);
          if (viewValue) {
            var plainNumber = Number((viewValue || "").replace(/ /g, '').replace(/,/g, "."));
            if (plainNumber >= 0) {
              var newviewValue = viewValue;
              ctrl.prev_value = viewValue;
            } else {
              try {
                var plainNumber = Number((ctrl.prev_value || null ).replace(/ /g, '').replace(/,/g, "."));
              }
              catch (e) {
                var plainNumber = null;
              }
              var newviewValue = ctrl.prev_value;
            }
            ctrl.$viewValue = newviewValue;
            ctrl.$render();
          } else {
            var plainNumber = null
          }
          return plainNumber
        });
      }
    };
  }]);


angular.module('esco')
  .directive('svgTimer', function() {
    return {

      templateNamespace: 'svg',
      template: '<g><circle cx="24" cy="24" r="21"  stroke="#494949" stroke-width="5" fill="#DBDBDB" />' + '<line x1="24" y1="24" ng-attr-x2="{{minutes_line.x}}" ng-attr-y2="{{minutes_line.y}}" stroke="#15293D" style="stroke-width:2" />' + '<line x1="24" y1="24" ng-attr-x2="{{seconds_line.x}}" ng-attr-y2="{{seconds_line.y}}" stroke="#88BDA4" style="stroke-width:1" />' + '<line x1="24" y1="24" ng-attr-x2="{{hours_line.x}}" ng-attr-y2="{{hours_line.y}}" stroke="#26374A" style="stroke-width:2" />' + '<path ng-attr-d="{{arc_params}}" fill="#A5A5A5" />' + '<circle cx="24" cy="24" r="2.5" stroke="white" stroke-width="1.5" fill="192B3F" /></g>',
      restrict: 'E',
      replace: true
    };
  });

angular.module('esco')
  .filter('fraction', ['$filter',
    function(filter) {
      return function(val, coeficient) {
        var format_function = function(val) {
          return math.format(Number(val), {
            notation: 'fixed',
            precision: 2
          }).replace(/(\d)(?=(\d{3})+\.)/g, '$1 ').replace(/\./g, ",")
        }
        if (!angular.isUndefined(val)) {
          if (angular.isNumber(val)){
            return format_function(val);
          }
          if (coeficient) {
            return format_function(math.eval(math.format(math.fraction(val) * math.fraction(coeficient))).toFixed(2));
          }
          return format_function(math.eval(math.format(math.fraction(val))).toFixed(2));
        }
        return "";
      }
    }
  ]);



angular.module('esco')
  .filter('fraction_string', ['$filter',
    function(filter) {
      return function(val) {
        return math.fraction(val).toString();
      }
    }
  ]);

angular.module('esco')
  .filter('eval_string', ['$filter',
    function(filter) {
      return function(val) {
        return math.eval(val);
      }
    }
  ]);

angular.module('utilsModule', [])
  .service('utilsService',  ['$filter', '$timeout', '$log', '$window', function($filter, $timeout, $log, $window) {
    // Format msg for timer
    'use strict';

    function pad(d) {
      return (d < 10) ? '0' + d.toString() : d.toString();
    }

    function prepare_info_timer_data(current_time, auction, bidder_id, Rounds) {
      var i;
      if (auction.current_stage === -101) {
        return {
          'countdown': false,
          'start_time': true,
          'msg': 'Auction has not started and will be rescheduled'
        };
      }
      if (auction.current_stage === -100) {
        return {
          'countdown': false,
          'start_time': true,
          'msg': 'Tender cancelled'
        };
      }
      if (auction.current_stage === -1) {
        var until_seconds = (new Date(auction.stages[0].start) - current_time) / 1000;
        if (until_seconds > -120){
          return {
            'countdown': (until_seconds) + Math.random(),
            'start_time': false,
            'msg': 'until the auction starts'
          };
        }else{
          return {
            'countdown': false,
            'start_time': true,
            'msg': 'Auction has not started and will be rescheduled'
          };
        }

      }
      if ((auction.stages[auction.current_stage].type || '') == "pre_announcement") {
        var client_time = new Date();
        var ends_time = new Date(auction.stages[auction.current_stage].start);
        if (client_time < ends_time) {
          ends_time = client_time;
        }
        return {
          'countdown': false,
          'start_time': ends_time,
          'msg': 'Аuction was completed',
          'msg_ending': 'Waiting for the disclosure of the participants\' names'
        };
      }
      if ((auction.stages[auction.current_stage].type || '') == "announcement") {
        var client_time = new Date();
        var ends_time = new Date(auction.stages[auction.current_stage - 1].start);
        if (client_time < ends_time) {
          ends_time = client_time;
        }
        return {
          'countdown': false,
          'start_time': ends_time,
          'msg': 'Аuction was completed'
        };
      }
      if (bidder_id) {
        if (auction.stages[auction.current_stage].bidder_id === bidder_id) {
          return {
            'countdown': ((new Date(auction.stages[auction.current_stage + 1].start) - current_time) / 1000) + Math.random(),
            'start_time': false,
            'msg': 'until your turn ends'
          };
        }
        var all_rounds = Rounds.concat(auction.stages.length - 2);
        for (i in all_rounds) {
          if (auction.current_stage < all_rounds[i]) {
            for (var index = auction.current_stage; index <= all_rounds[i]; index++) {
              if ((auction.stages[index].bidder_id) && (auction.stages[index].bidder_id === bidder_id)) {
                return {
                  'countdown': ((new Date(auction.stages[index].start) - current_time) / 1000) + Math.random(),
                  'start_time': false,
                  'msg': 'until your turn'
                };
              }
            }
            break;
          }
        }
      }
      for (i in Rounds) {
        if (auction.current_stage == Rounds[i]) {
          return {
            'countdown': ((new Date(auction.stages[auction.current_stage + 1].start) - current_time) / 1000) + Math.random(),
            'start_time': false,
            'msg': 'until the round starts'
          };
        }
        if (auction.current_stage < Rounds[i]) {
          return {
            'countdown': ((new Date(auction.stages[Rounds[i]].start) - current_time) / 1000) + Math.random(),
            'start_time': false,
            'msg': 'until the round ends'
          };
        }
      }
      return {
        'countdown': ((new Date(auction.stages[auction.stages.length - 2].start) - current_time) / 1000) + Math.random(),
        'start_time': false,
        'msg': 'until the results announcement'
      }
    }

    function prepare_progress_timer_data(current_time, auction) {

      if ((((auction.stages[auction.current_stage] || {}).type || '').indexOf('announcement') != -1) || (auction.current_stage === -100) || (auction.current_stage === -101)) {
        return {
          'countdown_seconds': false,
          'rounds_seconds': 0,
        };
      }
      if (auction.current_stage === -1) {
        var until_seconds = (new Date(auction.stages[0].start) - current_time) / 1000;
        if (until_seconds > -120){
          return {
            'countdown_seconds': until_seconds + Math.random(),
            'rounds_seconds': until_seconds,
          };
        }else{
          return {
            'countdown_seconds': false,
            'rounds_seconds': 0,
          };
        }
      }
      return {
        'countdown_seconds': ((new Date(auction.stages[auction.current_stage + 1].start) - current_time) / 1000) + Math.random(),
        'rounds_seconds': ((new Date(auction.stages[auction.current_stage + 1].start) - new Date(auction.stages[auction.current_stage].start)) / 1000),
      };

    }
    // characters 100 true
    function prepare_title_ending_data(auction, lang) {
      var ending = auction.tenderID + " - " + $filter('characters')((auction['title_' + lang] || auction['title'] || auction['title_en'] || auction['title_ru'] || ""), 50, true);
      ending += " - ";
      ending += $filter('characters')(auction.procuringEntity['name_' + lang] || auction.procuringEntity['name'] || auction.procuringEntity['name_en'] || auction.procuringEntity['name_ru'] || "", 50, true);
      return ending;
    }
    // Get bidder_id from query
    function get_bidder_id() {
      var query = window.location.search.substring(1);
      var vars = query.split('&');
      for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split('=');
        if (decodeURIComponent(pair[0]) == 'bidder_id') {
          return decodeURIComponent(pair[1]);
        }
      }
    }
    // Format date with traslations
    function format_date(date, lang, format) {
      var temp_date = moment(date).locale(lang);
      if (typeof temp_date.format === 'function') {
        return temp_date.format(format);
      }
      return "";
    }

    // Get round data
    function get_round_data(pause_index, auction_doc, Rounds) {
      if (pause_index == -1) {
        return {
          'type': 'waiting'
        };
      }
      if (pause_index <= Rounds[0]) {
        return {
          'type': 'pause',
          'data': ['', '1', ]
        };
      }
      for (var i in Rounds) {
        if (pause_index < Rounds[i]) {
          return {
            'type': 'round',
            'data': parseInt(i)
          };
        } else if (pause_index == Rounds[i]) {
          return {
            'type': 'pause',
            'data': [(parseInt(i)).toString(), (parseInt(i) + 1).toString(), ]
          };
        }
      }

      if (pause_index < (auction_doc.stages.length - 1)) {
        return {
          'type': 'round',
          'data': Rounds.length
        };
      } else {
        return {
          'type': 'finish'
        };
      }
    }
    // Scroll functionality
    function scroll_to_stage(auction_doc, Rounds) {
      $timeout(function() {
        var current_round = 0;
        for (var index in Rounds) {
          if ((auction_doc.current_stage >= Rounds[index]) && (auction_doc.current_stage <= (Rounds[index] + auction_doc.initial_bids.length))) {
            current_round = parseInt(index) + 1;
            break;
          }
        }
        if (auction_doc.current_stage >= 0) {
          if (current_round) {
            var scroll_tag_id = 'round-header-' + current_round.toString();
            var round_elem = document.getElementById(scroll_tag_id);
          } else {
            var scroll_tag_id = 'results-header'
            var round_elem = document.getElementById(scroll_tag_id);
          };
        }
        if (round_elem) {
          var round_elem_dimensions = round_elem.getBoundingClientRect();
          if (($window.innerHeight - 169) < round_elem_dimensions.height) {
            if (current_round) {
              var scroll_tag_id = 'stage-' + auction_doc.current_stage.toString();
            } else {
              var scroll_tag_id = 'results-header';
            }
            var stage_elem = document.getElementById(scroll_tag_id);
            if (stage_elem){
              stage_elem.scrollIntoView(true);
              var stage_elem_dimensions = stage_elem.getBoundingClientRect();
              $window.scrollBy(0, stage_elem_dimensions.top - 96);
            }
          } else {
            round_elem.scrollIntoView(true);
            var round_elem_dimensions = document.getElementById(scroll_tag_id).getBoundingClientRect()
            $window.scrollBy(0, round_elem_dimensions.top - 96);
          }
        }
      }, 0);
    }

    function detectIE() {
        var ua = window.navigator.userAgent;

        var msie = ua.indexOf('MSIE ');
        if (msie > 0) {
            return parseInt(ua.substring(msie + 5, ua.indexOf('.', msie)), 10);
        }

        var trident = ua.indexOf('Trident/');
        if (trident > 0) {
            var rv = ua.indexOf('rv:');
            return parseInt(ua.substring(rv + 3, ua.indexOf('.', rv)), 10);
        }

        var edge = ua.indexOf('Edge/');
        if (edge > 0) {
           return parseInt(ua.substring(edge + 5, ua.indexOf('.', edge)), 10);
        }

        return false;
    }

    function parseQueryString(str) {
      if (typeof str !== 'string') {
        return {};
      }

      str = str.trim().replace(/^(\?|#)/, '');

      if (!str) {
        return {};
      }

      return str.trim().split('&').reduce(function(ret, param) {
        var parts = param.replace(/\+/g, ' ').split('=');
        var key = parts[0];
        var val = parts[1];
        key = decodeURIComponent(key);
        val = val === undefined ? null : decodeURIComponent(val);
        if (!ret.hasOwnProperty(key)) {
          ret[key] = val;
        } else if (Array.isArray(ret[key])) {
          ret[key].push(val);
        } else {
          ret[key] = [ret[key], val];
        }
        return ret;
      }, {});
    }

    function stringifyQueryString(obj) {
      return obj ? Object.keys(obj).map(function(key) {
        var val = obj[key];
        if (Array.isArray(val)) {
          return val.map(function(val2) {
            return encodeURIComponent(key) + '=' + encodeURIComponent(val2);
          }).join('&');
        }
        return encodeURIComponent(key) + '=' + encodeURIComponent(val);
      }).join('&') : '';
    }

    function inIframe() {
      try {
        return window.self !== window.top;
      } catch (e) {
        return true;
      }
    }

    function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
      var angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;

      return {
        x: centerX + (radius * Math.cos(angleInRadians)),
        y: centerY + (radius * Math.sin(angleInRadians))
      };
    }

    function generateUUID() {
        var d = new Date().getTime();
        var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = (d + Math.random()*16)%16 | 0;
            d = Math.floor(d/16);
            return (c=='x' ? r : (r&0x3|0x8)).toString(16);
        });
        return uuid;
    };

    function UnsupportedBrowser(){
        var parser = new UAParser();
        var Browser = parser.getBrowser();
        if (Browser.name === "Opera"){
          if (parseFloat(Browser.version) < 12.10 ){
              return true
            }
        }
        if (Browser.name === "IE"){
          if (parseFloat(Browser.major) < 10 ){
              return true
            }
        }
        if (Browser.name === "Opera Mini"){
           return true
        }
        return false;
    }

    return {
      'prepare_info_timer_data': prepare_info_timer_data,
      'prepare_progress_timer_data': prepare_progress_timer_data,
      'get_bidder_id': get_bidder_id,
      'format_date': format_date,
      'get_round_data': get_round_data,
      'scroll_to_stage': scroll_to_stage,
      'parseQueryString': parseQueryString,
      'stringifyQueryString': stringifyQueryString,
      'prepare_title_ending_data': prepare_title_ending_data,
      'pad': pad,
      'inIframe': inIframe,
      'polarToCartesian': polarToCartesian,
      'generateUUID': generateUUID,
      'detectIE': detectIE,
      'UnsupportedBrowser': UnsupportedBrowser
    };
  }]);


  angular.module('utilsModule')
    .factory('aside', ['$modal', function($modal) {

      var asideFactory = {
        open: function(config) {
          var options = angular.extend({}, config);
          // check placement is set correct
          // set aside classes
          options.windowClass = 'ng-aside horizontal left' + (options.windowClass ? ' ' + options.windowClass : '');
          // delete options.placement
          return $modal.open(options);
        }
      };
      return angular.extend({}, $modal, asideFactory);
    }]);

angular.module('utilsModule')
  .config(['$translateProvider', function($translateProvider) {
    $translateProvider.useLocalStorage();
    $translateProvider.translations('en', {
      'at': 'at',
      'Announcement': 'Announcement',
      'Bid': 'Bid',
      'Bidder': 'Bidder',
      'Bidders': ' Bidders',
      'Bidding': 'Bidding',
      'English': 'English',
      'Russian': 'Russian',
      'Ukrainian': 'Ukrainian',
      'Client': 'Client',
      'Edit': 'Edit',
      'Info': 'Info',
      'Initial bids': 'Initial bids',
      'Language': 'Language',
      'Login in as viewer': 'Login in as viewer',
      'Login': 'Login',
      'Logout': 'Logout',
      'Place a bid': 'Place a bid',
      'Cancel': 'Cancel',
      'Preliminary bids': 'Preliminary bids',
      'Round': 'Round',
      'Settings': 'Settings',
      'Time': 'Time',
      'You': 'You',
      'All bidders': 'All bidders',
      'Pause': 'Pause',
      'Results Release': 'Results Release',
      'Waiting': 'Waiting',
      'or lower': 'or lower',
      'or higher': 'or higher',
      'UAH': 'UAH',
      'shortTime': 'h:mm a',
      'Restart sync': 'Restart sync',
      'Too low value': 'Too low value',
      'Too high value': 'Too high value',
      'Not valid bidder': 'Not valid bidder',
      'Stage not for bidding': 'Stage not for bidding',
      'Bid placed': 'Bid placed',
      'Normilized Price': 'Normalized price:',
      'Full Price': 'Full price:',
      'Bidder Coeficient':'Coeficient:',
      'Your proposal': 'Your proposal',
      'Finish': 'Finish',
      'days': 'days',
      'hours': 'hr',
      'minutes': 'min',
      'seconds': 'sec',
      'minimum': 'minimum',
      'maximum': 'maximum',
      'Internet connection is lost. Attempt to restart after 1 sec': 'Internet connection is lost. Attempt to restart after 1 sec',
      'Synchronization failed': 'Synchronization failed',
      'Possible results': 'Possible results',
      'In the room came a new user': 'In the room came a new user',
      'until the auction starts': 'until the auction starts',
      'until your turn': 'until your turn',
      'until your turn ends': 'until your turn ends',
      'until the round starts': 'until the round starts',
      'until the round ends': 'until the round ends',
      'until the results announcement': 'until the results announcement',
      'Аuction was completed': 'Аuction was completed on',
      'prohibit connection': 'prohibit connection',
      'Step reduction of Bid': 'Step reduction of Bid',
      'Step auction of Bid': 'Step auction of Bid',
      'Start value': 'Start value',
      'Your bid appears too low': 'Your bid appears too low',
      'Return to Tender': 'Return to Tender',
      'Your latest bid': 'Your latest bid',
      'Tender cancelled': 'Tender cancelled',
      'Bid canceled': 'Bid canceled',
      'Login is currently closed.': 'Login is currently closed.',
      'Please try again later.': 'Please try again later.',
      'Cancel Bid': 'Cancel Bid',
      'Ability to submit bids has been lost. Wait until page reloads, and retry.': 'Ability to submit bids has been lost. Wait until page reloads, and retry.',
      'Ability to submit bids has been lost. Wait until page reloads.': 'Ability to submit bids has been lost. Wait until page reloads',
      'You are registered as a bidder. Wait for the start of the auction.': 'You are registered as a bidder. Wait for the start of the auction.',
      'You are an observer and cannot bid.': 'You are an observer and cannot bid.',
      'Your browser is out of date, and this site may not work properly.': 'Your browser is out of date, and this site may not work properly.',
      'Learn how to update your browser.': 'Learn how to update your browser.',
      'Not Found': 'Not Found',
      'to Mine': 'to Mine',
      'Clear': 'Clear',
      'to General': 'to General',
      'The proposal you have submitted coincides with a proposal of the other participant. His proposal will be considered first, since it has been submitted earlier.': 'The proposal you have submitted coincides with a proposal of the other participant. His proposal will be considered first, since it has been submitted earlier.',
      'Waiting for the disclosure of the participants\' names': 'Waiting for the disclosure of the participants\' names',
      'Unable to place a bid. Check that no more than 2 auctions are simultaneously opened in your browser.': 'Unable to place a bid. Check that no more than 2 auctions are simultaneously opened in your browser.'
    });

    $translateProvider.translations('uk', {
      'at': 'о',
      'Announcement': 'Оголошення результатів',
      'Bid': 'Заявка',
      'Bidder': 'Учасник',
      'Bidders': ' Учасники',
      'Bidding': 'Торги',
      'English': 'Англійська',
      'Russian': 'Російська',
      'Ukrainian': 'Українська',
      'Client': 'Клієнт',
      'Edit': 'Змінити',
      'Info': 'Інформація',
      'Initial bids': 'Початкові заявки',
      'Language': 'Мова',
      'Login in as viewer': 'Вхід в якості глядача',
      'Login': 'Вхід',
      'Logout': 'Вийти',
      'Place a bid': 'Зробити заявку',
      'Cancel': 'Відмінити',
      'Preliminary bids': 'Попередні заявки',
      'Round': 'Раунд',
      'Settings': 'Налаштування',
      'Time': 'Час',
      'You': 'Ви',
      'All bidders': 'Всі учасники торгів',
      'Pause': 'Пауза',
      'Results Release': 'Результати',
      'Waiting': 'Очікування',
      'or lower': 'або менше',
      'or higher': 'або більше',
      'UAH': 'грн',
      'shortTime': 'HH:mm',
      'Restart sync': 'Перезапуск синхронізації',
      'Too low value': 'Надто низька заявка',
      'Too high value': 'Надто висока заявка',
      'Not valid bidder': 'Ви не є валідний користувачем',
      'Stage not for bidding': 'Даний етап аукціону не передбачає приймання заявок',
      'Bid placed': 'Заявку прийнято',
      'Normilized Price': 'Приведена ціна:',
      'Full Price': 'Повна ціна:',
      'Bidder Coeficient':'Коефіцієнт:',
      'Your proposal': 'Ваша заявка',
      'Finish': 'Завершено',
      'days': 'дн',
      'hours': 'год',
      'minutes': 'хв',
      'seconds': 'сек',
      'minimum': 'мінімум',
      'maximum': 'максимум',
      'Internet connection is lost. Attempt to restart after 1 sec': 'З\'єднання з інтернетом втрачено. спроба перезавантаження через 1 сек',
      'Synchronization failed': 'Помилка синхронізації',
      'Possible results': 'Можливі результати',
      'In the room came a new user': 'В кабінет зайшов новий користувач',
      'until the auction starts': 'до початку аукціону',
      'until your turn': 'до вашої черги',
      'until your turn ends': 'до закінчення вашої черги',
      'until the round starts': 'до початку раунду',
      'until the round ends': 'до закінчення раунду',
      'until the results announcement': 'до оголошення результатів',
      'Аuction was completed': 'Аукціон завершився',
      'prohibit connection': 'заборонити підключення',
      'Step reduction of Bid': 'Крок зменшення торгів',
      'Step auction of Bid': 'Крок зростання торгів',
      'Start value': 'Стартова сума',
      'Your bid appears too low': 'Ви ввели дуже малу суму, ви впевнені?',
      'Return to Tender': 'Повернутися до Закупівлі',
      'Your latest bid': 'Ваша остання заявка',
      'Tender cancelled': 'Закупівлю скасовано',
      'Bid canceled': 'Заявку відмінено',
      'Login is currently closed.': 'Вхід на даний момент закритий.',
      'Please try again later.': 'Спробуйте пізніше.',
      'Cancel Bid': 'Відмінити заявку',
      'Ability to submit bids has been lost. Wait until page reloads, and retry.': 'Втрачено можливість подавати заявки. Дочекайтесь перевантаження сторінки і повторіть спробу.',
      'Ability to submit bids has been lost. Wait until page reloads.': 'Втрачено можливість подавати заявки. Дочекайтесь перевантаження сторінки.',
      'You are registered as a bidder. Wait for the start of the auction.': 'Ви зареєстровані як учасник. Очікуйте старту аукціону.',
      'You are an observer and cannot bid.': 'Ви спостерігач і не можете робити ставки.',
      'Your browser is out of date, and this site may not work properly.': 'Ваш переглядач застарів, і цей сайт може некоректно працювати.',
      'Learn how to update your browser.': 'Дізнайтесь, як оновити Ваш браузер.',
      'Not Found': 'Аукціону із даною Id не знайдено',
      'to Mine': 'до Моєї',
      'Clear': 'Очистити',
      'to General': 'до Загальної',
      'The proposal you have submitted coincides with a proposal of the other participant. His proposal will be considered first, since it has been submitted earlier.': 'Подана вами пропозиція співпадає з пропозицією іншого учасника. Його пропозиція розглядатиметься першою, оскільки вона подана раніше.',
      'Waiting for the disclosure of the participants\' names': 'Очікуємо на розкриття імен учасників',
      'Unable to place a bid. Check that no more than 2 auctions are simultaneously opened in your browser.': 'Не вдається зробити ставку. Перевірте, що в переглядачі відкрито не більше 2-ох аукціонів.'
    });


    $translateProvider.translations('ru', {
      'at': 'о',
      'Announcement': 'Объявление результатов',
      'Bid': 'Ставка',
      'Bidder': ' Участник',
      'Bidders': ' Учасники',
      'Bidding': 'Торги',
      'English': 'Английский',
      'Russian': 'Русский',
      'Ukrainian': 'Украинский',
      'Client': 'Клиент',
      'Edit': 'Изменить',
      'Info': 'Информация',
      'Initial bids': 'Первоначальные ставки',
      'Language': 'Язык',
      'Login in as viewer': 'Вход в качестве зрителя',
      'Login': 'Вход',
      'Logout': 'Выйти',
      'Place a bid': 'Сделать ставку',
      'Cancel': 'Отменить',
      'Preliminary bids': 'Предварительные ставки',
      'Round': 'Раунд',
      'Settings': 'Настройки',
      'Time': 'Время',
      'You': 'Вы',
      'All bidders': 'Все участники торгов',
      'Pause': 'Пауза',
      'Results Release': 'Результаты',
      'Waiting': 'Ожидание',
      'or lower': 'или меньше',
      'or higher': 'или больше',
      'UAH': 'грн',
      'shortTime': 'HH:mm',
      'Restart sync': 'Перезапуск синхронизации',
      'Too low value': 'Слишком низкая ставка',
      'Too high value': 'Слишком высокая ставка',
      'Not valid bidder': ' Вы не являетесь валидный пользователем',
      'Stage not for bidding': 'Данный этап аукциона не предусматривает приема ставок',
      'Bid placed': 'Ставку принято',
      'Normilized Price': 'Приведённая цена:',
      'Full Price': 'Фактическая цена:',
      'Bidder Coeficient':'Коэффициент:',
      'Your proposal': 'Ваше предложение',
      'Finish': 'Окончен',
      'days': 'дн',
      'hours': 'час',
      'minutes': 'мин',
      'seconds': 'сек',
      'minimum': 'минимум',
      'maximum': 'максимум',
      'Internet connection is lost. Attempt to restart after 1 sec': 'Cоединения с интернетом потеряно. попытка перезагрузки через 1 сек',
      'Synchronization failed': 'Ошибка синхронизации',
      'Possible results': 'Возможные результаты',
      'In the room came a new user': 'В кабинет зашел новый пользователь',
      'until the auction starts': 'до начала аукциона',
      'until your turn': 'до вашей очереди',
      'until your turn ends': 'до завершения вашей очереди',
      'until the round starts': 'до начала раунда',
      'until the round ends': ' до окончания раунда',
      'until the results announcement': 'до объявления результатов',
      'Аuction was completed': 'Аукцион закончился',
      'prohibit connection': 'запретить подключение',
      'Step reduction of Bid': 'Шаг уменьшения торгов',
      'Step auction of Bid': 'Шаг увеличение торгов',
      'Start value': 'Стартовая сумма',
      'Your bid appears too low': 'Вы ввели очень маленькую сумму, вы уверены?',
      'Return to Tender': 'Вернуться к Закупке',
      'Your latest bid': 'Ваша последняя заявка',
      'Tender cancelled': 'Закупка отменена',
      'Bid canceled': 'Ставку отменено',
      'Login is currently closed.': 'Вход на данный момент закрыт.',
      'Please try again later.': 'Попробуйте позже.',
      'Cancel Bid': 'Отменить ставку',
      'Ability to submit bids has been lost. Wait until page reloads, and retry.': 'Потеряна возможность делать заявки. Подождите перезагрузки страницы и попробуйте еще раз.',
      'Ability to submit bids has been lost. Wait until page reloads.': 'Потеряна возможность делать заявки. Подождите перезагрузки страницы.',
      'You are registered as a bidder. Wait for the start of the auction.': 'Вы зарегистрированы как участник. Ожидайте старта аукциона.',
      'You are an observer and cannot bid.': 'Вы наблюдатель и не можете делать ставки.',
      'Your browser is out of date, and this site may not work properly.': 'Ваш браузер устарел, и этот сайт может некорректно работать.',
      'Learn how to update your browser.': 'Узнайте, как обновить Ваш браузер.',
      'Not Found': 'Аукциона по данной Id не найдено',
      'to Mine': 'к Моей',
      'Clear': 'Очистить',
      'to General': 'к Общей',
      'The proposal you have submitted coincides with a proposal of the other participant. His proposal will be considered first, since it has been submitted earlier.': 'Поданное вами предложение совпадает с предложением другого участника. Его предложение будет рассматриваться первым, поскольку оно подано раньше.',
      'Waiting for the disclosure of the participants\' names': 'Ожидаем раскрытия имен участников',
      'Unable to place a bid. Check that no more than 2 auctions are simultaneously opened in your browser.': 'Невозможно сделать ставку. Проверьте, что в браузере открыто не более 2-х аукционов.'
    });
  }]);

var app = angular.module('auction', ['ui.bootstrap', 'ngCookies', 'pascalprecht.translate', 'timer', 'angular-growl', 'angular-ellipses', 'GTMLogger', 'utilsModule']);
var db = {};
var bidder_id = "0";
var auction_doc_id = auction_doc_id || "";
var db_url = db_url || "";

app.constant('AuctionConfig', {
  auction_doc_id: auction_doc_id,
  remote_db: db_url,
  restart_retries: 10,
  default_lang: 'uk',
  debug: false
});

app.filter('formatnumber', ['$filter',
  function(filter) {
    return function(val) {
      return (filter('number')(val) || "").replace(/,/g, " ") || "";
    }
  }
]);

app.config(['$logProvider', 'AuctionConfig', 'growlProvider', 'GTMLoggerProvider', function($logProvider, AuctionConfig, growlProvider, GTMLoggerProvider, utilsModule) {
    GTMLoggerProvider.level('INFO').includeTimestamp( true )
    $logProvider.debugEnabled(AuctionConfig.debug); // default is true
    growlProvider.globalTimeToLive({
        success: 4000,
        error: 10000,
        warning: 10000,
        info: 4000
    });
    growlProvider.globalPosition('top-center');
    growlProvider.onlyUniqueMessages(false);
}]);

function logMSG(MSG)
{
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open("POST", '/log', true);
    xmlHttp.send(JSON.stringify(MSG));
}
