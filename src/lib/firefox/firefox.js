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
      manifest: self,
      fullLite: prefs.fullLite, 
      highlight: prefs.highlight,
      allowedURLs: JSON.parse(prefs.allowedURLs),
    },
    onAttach: function(worker) {
      worker.port.emit("topLevelUrl", worker.tab.url);
      worker.port.emit("adblock-list", filters.adblockList);
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
sp.on("highlight", reRunPageMode);
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

exports.version = function () {
  return self.version;
}

exports.icon = function (type) {
  var icon = {
    "16" : "./icon16" + type + ".png",
    "32" : "./icon32" + type + ".png",
    "64" : "./icon64" + type + ".png"
  }
  button.icon = icon;
}

exports.Promise = Promise;
exports.Deferred = Promise.defer;
exports.window = windowUtils.getMostRecentBrowserWindow();
sp.on("settings", exports.tab.openOptions);