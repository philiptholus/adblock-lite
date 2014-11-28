// Load Firefox based resources
var self          = require("sdk/self"),
    data          = self.data,
    events        = require("sdk/system/events"),
    unload        = require("sdk/system/unload"),
    sp            = require("sdk/simple-prefs"),
    Request       = require("sdk/request").Request,
    prefs         = sp.prefs,
    timers        = require("sdk/timers"),
    buttons       = require('sdk/ui/button/action'),
    pageMod       = require("sdk/page-mod"),
    pageWorker    = require("sdk/page-worker"),
    tabs          = require("sdk/tabs"),
    windowUtils   = require('sdk/window/utils'),
    contextMenu   = require("sdk/context-menu"),
    array         = require('sdk/util/array'),
    filter        = require('../filter'),
    {Cc, Ci, Cu, Cr}  = require('chrome'),
    windows       = {
      get active () { // Chrome window
        return windowUtils.getMostRecentBrowserWindow()
      }
    };
    
Cu.import("resource://gre/modules/Promise.jsm");

var filters = filter.filters;
exports.timer = timers;

/* * Code for injecting content_script * */
var workers = [], content_script_arr = [];
function insertContentScript() {
  return pageMod.PageMod({
    include: ["*"],
    contentScriptFile: [data.url("content_script/inject.js")],
    contentScriptWhen: "start",
    contentScriptOptions: {
      allowedURLs: JSON.parse(prefs.allowedURLs),
      fullLite: prefs.fullLite, 
      manifest: self
    },
    onAttach: function(worker) {
      worker.port.emit("topLevelUrl", worker.tab.url);
      worker.port.emit("adblock-list", filters.adblockList);
      worker.port.emit("script-list", filters.scriptList);
      array.add(workers, worker);
      worker.on('pageshow', function() { array.add(workers, this); });
      worker.on('pagehide', function() { array.remove(workers, this); });
      worker.on('detach', function() { array.remove(workers, this); });
      content_script_arr.forEach(function (arr) {
        worker.port.on(arr[0], arr[1]);
      });
    }
  });
}
var myPageMode;
function reRunPageMode() {
  var startStop = prefs.startStop;
  if (myPageMode) myPageMode.destroy();
  if (startStop == "Enable") {
    myPageMode = insertContentScript();
  }
}
sp.on("fullLite", reRunPageMode);
sp.on("startStop", reRunPageMode);
sp.on("allowedURLs", reRunPageMode);

if (prefs.startStop == "Enable" && prefs.allowedURLs) {
  myPageMode = insertContentScript();
}

var popup = require("sdk/panel").Panel({
  width: 450,
  height: 418,
  contentURL: data.url("./popup/popup.html"),
  contentScriptFile: [data.url("./popup/popup.js")]
});
popup.on('show', function() {
  popup.port.emit('show', true);
});
popup.port.on("resize", function(obj) {
  popup.resize(obj.w, obj.h + 3);
});

var button = buttons.ActionButton({
  id: "iadblocklite",
  label: "AdBlock Lite",
  icon: {
    "16": "./icon16.png",
    "32": "./icon32.png",
    "64": "./icon64.png"
  },
  onClick: function (state) {
    popup.show({
      position: button
    });
  }
});

exports.storage = {
  read: function (id) {
    return (prefs[id] || prefs[id] + "" == "false") ? (prefs[id] + "") : null;
  },
  write: function (id, data) {
    data = data + "";
    if (data === "true" || data === "false") {
      prefs[id] = data === "true" ? true : false;
    }
    else if (parseInt(data) + "" === data) {
      prefs[id] = parseInt(data);
    }
    else {
      prefs[id] = data + "";
    }
  }
}

exports.get = function (url, headers, data) {
  var d = new Promise.defer();
  Request({
    url: url,
    headers: headers || {},
    content: data,
    onComplete: function (response) {
      if (response.status >= 400 || response.status < 200) {
        var e = new Error(response.status);
        e.status = response.status;
        d.reject(e);
      } 
      else {
        d.resolve(response.text);
      }
    }  
  })[data ? "post" : "get"]();
  return d.promise;
}

exports.popup = {
  send: function (id, data) {
    popup.port.emit(id, data);
  },
  receive: function (id, callback) {
    popup.port.on(id, callback);
  }
}

exports.content_script = {
  send: function (id, data, global) {
    workers.forEach(function (worker) {
      if (!global && worker.tab != tabs.activeTab) return;
      if (!worker) return;
      worker.port.emit(id, data);
    });
  },
  receive: function (id, callback) {
    content_script_arr.push([id, callback]);
  }
}

exports.tab = {
  open: function (url, inBackground, inCurrent) {
    if (inCurrent) {
      tabs.activeTab.url = url;
    }
    else {
      tabs.open({
        url: url,
        inBackground: typeof inBackground == 'undefined' ? false : inBackground
      });
    }
  },
  openOptions: function () {
    var optionsTab = false;
    for each (var tab in tabs) {
      if (tab.url.indexOf("dwtFBkQjb3SIQp-at-jetpack/adblock-lite") != -1) {
        tab.reload();            // reload the options tab
        tab.activate();          // activate the options tab
        tab.window.activate();   // activate the options tab window
        optionsTab = true;
      }
    }
    if (!optionsTab) tabs.open(data.url("options/options.html"));
  }
}

exports.context_menu = {
  create: function (title, type, callback) {
    var menuItem = contextMenu.Item({
      label: title,
      image: data.url('./icon16.png'),
      context: type == 'selection' ? contextMenu.SelectionContext() : contextMenu.PageContext(),
      contentScript: 'self.on("click", function () {self.postMessage();});',
      onMessage: function () {
        callback();
      }
    });
  }
}

exports.version = function () {
  return self.version;
}

exports.notification = (function () { // https://github.com/fwenzel/copy-shorturl/blob/master/lib/simple-notify.js
  return function (title, text) {
    try {
      let alertServ = Cc["@mozilla.org/alerts-service;1"].
                      getService(Ci.nsIAlertsService);
      alertServ.showAlertNotification(data.url("icon32.png"), title, text, null, null, null, "");
    }
    catch(e) {
      let browser = window.active.gBrowser,
          notificationBox = browser.getNotificationBox();

      notification = notificationBox.appendNotification(text, 'jetpack-notification-box',
          data.url("icon32.png"), notificationBox.PRIORITY_INFO_MEDIUM, []
      );
      timer.setTimeout(function() {
          notification.close();
      }, 5000);
    }
  }
})();

exports.play = function (url) {
  var worker = pageWorker.Page({
    contentScript: "var audio = new Audio('" + url + "'); audio.addEventListener('ended', function () {self.postMessage()}); audio.volume = 1; audio.play();",
    contentURL: data.url("firefox/sound.html"),
    onMessage: function(arr) {
      worker.destroy();
    }
  });
}

exports.icon = function (type) {
  var icon = {
    "16" : "./icon16" + type + ".png",
    "32" : "./icon32" + type + ".png",
    "64" : "./icon64" + type + ".png"
  }
  button.icon = icon;
}

exports.window = windowUtils.getMostRecentBrowserWindow();
exports.Promise = Promise;
exports.Deferred = Promise.defer;

sp.on("settings", exports.tab.openOptions);

var httpRequestMethod = "http-on-examine-response";

/* (--- This method introduces lag to Firefox ---)
events.on(httpRequestMethod, function (event) {
  var httpChannel = event.subject.QueryInterface(Ci.nsIHttpChannel);
  var startStop = prefs.startStop;
  var url = httpChannel.URI.spec;
  var isTopLevel = httpChannel.loadFlags & httpChannel.LOAD_INITIAL_DOCUMENT_URI;
  var allowHttpChannel = true;
  try {
    var noteCB = httpChannel.notificationCallbacks ? httpChannel.notificationCallbacks : httpChannel.loadGroup.notificationCallbacks;
    if (noteCB) {
      var domWin = noteCB.getInterface(Ci.nsIDOMWindow);
      var topLevelUrl = domWin.top.document.location.href;
      var allowedURLs = prefs.allowedURLs;
      for (var i = 0; i < allowedURLs.length; i++) {
        if (topLevelUrl.indexOf(allowedURLs[i]) != -1) {
          allowHttpChannel = false;
          break;
        }
      }
    }
  } 
  catch (e) {}
  if (allowHttpChannel && startStop == "Enable" && isTopLevel == 0) {
    for (var i = 0; i < filters.blockedURLs.length; i++) {
      var flag = (new RegExp('\\b' + filters.blockedURLs[i] + '\\b')).test(url);
      if (flag) {
        httpChannel.cancel(Cr.NS_BINDING_ABORTED);
        //console.error("http-on-modify-request: ", filters.blockedURLs[i]);
        break;
      }
    }
  }
  exports.content_script.send("clearAdBlock", "", true);
}, true);
*/

var httpRequestObserver = {
  observe: function(subject, topic, data) {
    if (topic == httpRequestMethod) {
      var httpChannel = subject.QueryInterface(Ci.nsIHttpChannel);
      try {
        var type = httpChannel.contentType;
        if (type == "text/javascript" || type == "image/gif") {
          var startStop = prefs.startStop;
          var url = httpChannel.URI.spec;
          var isTopLevel = httpChannel.loadFlags & httpChannel.LOAD_INITIAL_DOCUMENT_URI;
          var allowHttpChannel = true;
          try {
            var noteCB = httpChannel.notificationCallbacks ? httpChannel.notificationCallbacks : httpChannel.loadGroup.notificationCallbacks;
            if (noteCB) { 
              var domWin = noteCB.getInterface(Ci.nsIDOMWindow);
              var topLevelUrl = domWin.top.document.location.href;
              var allowedURLs = prefs.allowedURLs;
              for (var i = 0; i < allowedURLs.length; i++) {
                if (topLevelUrl.indexOf(allowedURLs[i]) != -1) {
                  allowHttpChannel = false;
                  break;
                }
              }
            }
          } 
          catch (e) {}
          if (allowHttpChannel && startStop == "Enable" && isTopLevel == 0) {
            for (var i = 0; i < filters.blockedURLs.length; i++) {
              var flag = (new RegExp('\\b' + filters.blockedURLs[i] + '\\b')).test(url);
              if (flag) {
                httpChannel.cancel(Cr.NS_BINDING_ABORTED);
                //console.error("http-on-modify-request: ", filters.blockedURLs[i]);
                break;
              }
            }
          }
          exports.content_script.send("clearAdBlock", '', true);
        }
      }
      catch (e) {}
    }
  },
  get observerService() {
    return Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
  },
  register: function() {
    this.observerService.addObserver(this, httpRequestMethod, false);
  },
  unregister: function() {
    this.observerService.removeObserver(this, httpRequestMethod);
  }
};
httpRequestObserver.register();
unload.when(function () {httpRequestObserver.unregister();})
