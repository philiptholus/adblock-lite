var self             = require("sdk/self"),
    { Cc, Ci, Cu, Cr } = require('chrome'),
    tabs             = require("sdk/tabs"),
    tbExtra          = require("./tbExtra"),
    config           = require("../config"),
    timers           = require("sdk/timers"),
    pageMod          = require("sdk/page-mod"),
    array            = require('sdk/util/array'),
    utils            = require('sdk/tabs/utils'),
    loader           = require('@loader/options'),
    prefsListener    = require("sdk/simple-prefs"),
    unload           = require("sdk/system/unload"),
    buttons          = require('sdk/ui/button/action'),
    data             = self.data;

Cu.import("resource://gre/modules/Promise.jsm");

exports.timer = timers;
var prefs = prefsListener.prefs;
function pageModOnAttach () {};

var workers = [], content_script_arr = [];
pageMod.PageMod({
  include: ["http://*", "https://*"],
  contentScriptFile: [data.url("content_script/inject.js")],
  attachTo: ["existing", "top", "frame"],
  contentScriptWhen: "start",
  contentScriptOptions: {
    base: loader.prefixURI + loader.name + "/"
  },
  onAttach: function(worker) {
    worker.port.emit("storageData", {
      top: worker.tab.url,
      fullLite: prefs["fullLite"],
      startStop: prefs["startStop"],
      highlight: prefs["highlight"],
      customRule: prefs["customRule"],
      allowedURLs: prefs["allowedURLs"]
    });
    if (worker.tab.url == worker.url) {
      if (worker.tab.readyState === "loading") {
        pageModOnAttach({url: worker.url}, true);
      }
    }
    array.add(workers, worker);
    worker.on('pageshow', function() { array.add(workers, this); });
    worker.on('pagehide', function() { array.remove(workers, this); });
    worker.on('detach', function() { array.remove(workers, this); });
    content_script_arr.forEach(function (arr) {
      worker.port.on(arr[0], arr[1]);
    });
  }
});

var popup = require("sdk/panel").Panel({
  width: 452,
  height: 414,
  contentURL: data.url("./popup/popup.html"),
  contentScriptFile: [data.url("./popup/popup.js")]
});
popup.on('show', function() {
  popup.port.emit('show', true);
});
popup.port.on("resize", function(obj) {
  popup.resize(obj.w, obj.h);
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
tbExtra.setButton(button);

exports.button = {
  onCommand: function (c) {
    onClick = c;
  },
  label:  function (val) {
    button.label = val;
  },
  badge: function (val) {
    if (config.ui.badge) {
      tbExtra.setBadge(val ? val : '');
    }
  }
}

exports.storage = {
  read: function (id) {
    return (prefs[id] || prefs[id] + '' === 'false' || !isNaN(prefs[id])) ? (prefs[id] + '') : null;
  },
  write: function (id, data) {
    data = data + '';
    if (data === 'true' || data === 'false') {
      prefs[id] = data === 'true' ? true : false;
    }
    else if (parseInt(data) + '' === data) {
      prefs[id] = parseInt(data);
    }
    else {
      prefs[id] = data + '';
    }
  }
}

exports.get = function (url, type) {
  var d = new Promise.defer();
  var xhr = Cc['@mozilla.org/xmlextras/xmlhttprequest;1'].createInstance(Ci.nsIXMLHttpRequest);
  if (type) {
    xhr.responseType = type;
  }
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      if (xhr.status !== 200) {
        d.reject("xmlHttpRequest error");
      }
      else {
        d.resolve(type ? xhr.response : xhr.responseText);
      }
    }
  };
  xhr.open('GET', url, true);
  xhr.send();
  return d.promise;
}

exports.getURL = function (path) {
  return loader.prefixURI + loader.name + '/' + path;
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
  onCreated: function (callback) {
    tabs.on("open", function onOpen(tab) {
     callback(tab);
    });
  },
  onUpdated: function (callback) {
    pageModOnAttach = callback;
  },
  onActivated: function (callback) {
    tabs.on("activate", function (tab) {
      if (tab) {
        callback(tab);
      }
    });
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

exports.urlDomain = function (url) {
  /* generate key */
  var key = url.match(/:\/\/(?:www\.)?(.[^/]+)(.*)/);
  return key && key.length ? key[1] : '';
}

exports.webRequest = (function () {
  var blockFunction, registered = false;
  var observerService = Cc['@mozilla.org/observer-service;1'].getService(Ci.nsIObserverService);
  var httpRequestObserver = {
    observe: function (subject, topic, data) {
      var httpChannel = subject.QueryInterface(Ci.nsIHttpChannel);
      if (!httpChannel.notificationCallbacks) return;
      var interfaceRequestor = httpChannel.notificationCallbacks.QueryInterface(Ci.nsIInterfaceRequestor);
      var loadContext;
      try {
        loadContext = interfaceRequestor.getInterface(Ci.nsILoadContext);
      }
      catch (e) {
        try {
          loadContext = subject.loadGroup.notificationCallbacks.getInterface(Ci.nsILoadContext);
        }
        catch (e) {
          loadContext = null;
        }
      }
      if (loadContext) {
        try {
          var contentWindow = loadContext.associatedWindow;
          if (contentWindow) {
            var tab = utils.getTabForContentWindow(contentWindow.top);
            if (tab) {
              var tabId = utils.getTabId(tab);
              if (tabId) {
                var typeMap = {
                  1: 'other',
                  2: 'script',
                  3: 'image',
                  4: 'stylesheet',
                  5: 'object',
                  6: 'main_frame',
                  7: 'sub_frame',
                  10: 'ping',
                  11: 'xmlhttprequest',
                  12: 'object',
                  14: 'font',
                  15: 'media',
                  16: 'websocket',
                  19: 'beacon',
                  21: 'image'
                };
                var rawtype = httpChannel.loadInfo && httpChannel.loadInfo.contentPolicyType || 1;
                var webRequestObj = {
                  url: httpChannel.URI.spec, 
                  host: httpChannel.URI.host, 
                  type: typeMap[rawtype],
                  tabId: tabId, 
                  iFrame: (typeMap[rawtype] === "sub_frame")
                };
                var top = contentWindow.top.document.location;
                if (blockFunction && blockFunction(webRequestObj, {url: top.href, host: top.host})) {
                  subject.cancel(Cr.NS_BINDING_ABORTED);
                }
              }
            }
          }
        }
        catch (e) {}
      }
    }
  }
  function init(flag) {
    if (prefs["startStop"] === "Enable" && prefs["fullLite"] === "Full" && !flag) {
      registered = true;
      observerService.addObserver(httpRequestObserver, 'http-on-modify-request', false);
    }
    else {
      if (registered) {
        observerService.removeObserver(httpRequestObserver, 'http-on-modify-request');
      }
      registered = false;
    }
  }
  timers.setTimeout(init, 300);
  unload.when(function () {
    init(true);
  });
  prefsListener.on("startStop", function () {init()});
  prefsListener.on("fullLite", function () {init()});
  return function (b) {
    blockFunction = b;
  };
})();