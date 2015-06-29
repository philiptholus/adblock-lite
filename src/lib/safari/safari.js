var _safari = {
  timer: window,

  storageListener: {
    data: '',
    onChange: (function () {
      return function (b) {
        this.data = b;
      }
    })()
  },

  storage: {
    read: function (id) {
      return localStorage[id] || null;
    },
    write: function (id, data) {
      localStorage[id] = data + '';
      _safari.storageListener.data(id);
    }
  },

  get: function (url, type) {
    var xhr = new XMLHttpRequest();
    var deferred = new task.Deferred();
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        if (xhr.status !== 0 && xhr.status !== 200) {
          var e = new Error(xhr.statusText);
          e.status = xhr.status;
          deferred.reject(e);
        }
        else {
          deferred.resolve(xhr.response);
        }
      }
    };
    xhr.open("GET", url, true);
    if (type) {
      xhr.responseType = type;
    }
    xhr.send();
    return deferred.promise;
  },

  getURL: function (path) {
    return safari.extension.baseURI + path;
  },

  popup: (function () {
    var callbacks = {};
    return {
      send: function (id, obj) {
        safari.extension.popovers[0].contentWindow.background.dispatchMessage(id, obj)
      },
      receive: function (id, callback) {
        callbacks[id] = callback;
      },
      dispatchMessage: function (id, obj) {
        if (callbacks[id]) {
          callbacks[id](obj);
        }
      }
    }
  })(),

  tab: {
    open: function (url) {
      safari.application.activeBrowserWindow.openTab().url = url;
    },
    onCreated: function (callback) {
      safari.application.addEventListener("open", function (e) {
        callback(e.target);
      }, true);
    },
    onUpdated: function (callback) {
      safari.application.addEventListener("beforeNavigate", function (e) {
        callback(e.target, true);
      }, true);
    },
    onActivated: function (callback) {
      safari.application.addEventListener("activate", function (e) {
        callback(e.target.activeTab || e.target);
      }, true);
    }
  },

  button: {
    label: function (val) {
      safari.extension.toolbarItems[0].toolTip = val;
    },
    badge: function (val) {
      safari.extension.toolbarItems[0].badge = (val ? val : '') + '';
    }
  },

  version: function () {
    return safari.extension.displayVersion;
  },

  urlDomain: function (url) {
    /* generate key */
    if (url) {
      var key = url.match(/:\/\/(?:www\.)?(.[^/]+)(.*)/);
      return key && key.length ? key[1] : '';
    }
    return '';
  },

  icon: function (state) {
    if (state === 'Disable') {
      safari.extension.toolbarItems[0].image = safari.extension.baseURI + 'data/icon16Disable-mac.png';
    }
    else if (state === 'Lite') {
      safari.extension.toolbarItems[0].image = safari.extension.baseURI + 'data/icon16Lite-mac.png';
    }
    else {
      safari.extension.toolbarItems[0].image = safari.extension.baseURI + 'data/icon16-mac.png';
    }
  },

  content_script: (function () {
    var callbacks = {};
    safari.application.addEventListener("message", function (e) {
      if (callbacks[e.message.id]) {
        callbacks[e.message.id](e.message.data);
      }
    }, false);
    return {
      send: function (id, data, global) {
        if (global) {
          safari.application.browserWindows.forEach(function (browserWindow) {
            browserWindow.tabs.forEach(function (tab) {
              if (tab.page) tab.page.dispatchMessage(id, data);
            });
          });
        }
        else {
          safari.application.activeBrowserWindow.activeTab.page.dispatchMessage(id, data);
        }
      },
      receive: function (id, callback) {
        callbacks[id] = callback;
      }
    }
  })(),

  webRequest: (function() {
    var blockFunction, webRequestUris = {}, webRequestPermission;
    var getTabId = (function () {
      var tabs = [];
      return function (tab) {
        var tabId = tabs.indexOf(tab);
        if (tabId === -1) {
          return tabs.push(tab) - 1;
        }
        return tabId;
      }
    })();
    var webRequestListener = function(e) {
      if (e.name === "canLoad") {
        if (e.stopPropagation) e.stopPropagation();
        var tabId = getTabId(e.target);
        var top = e.message.top || '';
        var url = e.message.url || '';
        webRequestUris[tabId] = {
          url: top,
          host: top.split('//').slice(0,2).pop().split('/').shift() || ''
        };
        var webRequestObj = {
          url: url,
          host: url.split('//').slice(0,2).pop().split('/').shift() || '',
          type: e.message.type,
          tabId: tabId,
          iFrame: e.message.iFrame
        };
        if (webRequestPermission === "addWebRequestListener") {
          if (blockFunction && webRequestUris[tabId] && blockFunction(webRequestObj, webRequestUris[tabId])) {
            e.message = {method: "block", url: url, index: e.message.index || 0};
          }
          else {
            e.message = {method: "allow", url: url, index: e.message.index || 0};
          }
        }
        else {
          e.message = {method: "allow", url: url, index: e.message.index || 0};
        }
        function init() {
          if (localStorage["startStop"] === "Enable" && localStorage["fullLite"] === "Full") {
            webRequestPermission = "addWebRequestListener";
          }
          else {
            webRequestPermission = "removeWebRequestListener";
          }
        }
        window.setTimeout(init, 300);
        _safari.storageListener.onChange(function (s) {
          if (s === "stortStop" || s === "fullLite") init();
        });
      }
    }
    safari.application.addEventListener("message", webRequestListener, true);
    return function (b) {
      blockFunction = b;
    };
  })()
}
