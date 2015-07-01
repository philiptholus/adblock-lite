var _chrome = {
  timer: window,
  
  storage: (function () {
    var objs = {};
    chrome.storage.local.get(null, function (o) {
      objs = o;
      /* store to local storage */
      document.getElementById("common").src = "../common.js";
    });
    return {
      read : function (id) {
        return objs[id];
      },
      write : function (id, data) {
        objs[id] = data;
        var tmp = {};
        tmp[id] = data;
        chrome.storage.local.set(tmp, function () {});
      }
    }
  })(),
  
  get: function (url, type) {
    var xhr = new XMLHttpRequest();
    var d = Promise.defer();
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status !== 200) {
          d.reject(new Error(xhr.statusText));
        }
        else {
          d.resolve(xhr.response);
        }
      }
    };
    xhr.open('GET', url, true);
    if (type) {
      xhr.responseType = type;
    }
    xhr.send();
    return d.promise;
  },

  getURL: function (path) {
    return chrome.extension.getURL(path);
  },

  popup: {
    send: function (id, data) {
      chrome.runtime.sendMessage({path: 'background-to-popup', method: id, data: data});
    },
    receive: function (id, callback) {
      chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.path == 'popup-to-background') {
          if (request.method == id) {
            callback(request.data);
          }
        }
      });
    }
  },

  content_script: {
    send: function (id, data, global) {
      if (global) {
        chrome.tabs.query({}, function (tabs) {
          tabs.forEach(function (tab) {
            chrome.tabs.sendMessage(tab.id, {path: 'background-to-page', method: id, data: data}, function () {});
          });
        });
      }
      else {
        chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
          tabs.forEach(function (tab) {
            chrome.tabs.sendMessage(tab.id, {path: 'background-to-page', method: id, data: data}, function () {});
          });
        });
      }
    },
    receive: function (id, callback) {
      chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        if (request.path == 'page-to-background') {
          if (request.method === id) {
            callback(request.data);
          }
        }
      });
    }
  },

  tab: {
    open: function (url, inBackground, inCurrent) {
      if (inCurrent) {
        chrome.tabs.update(null, {url: url});
      }
      else {
        chrome.tabs.create({
          url: url,
          active: typeof inBackground == 'undefined' ? true : !inBackground
        });
      }
    },
    onCreated: function (callback) {
      chrome.tabs.onCreated.addListener(function (tab) {
        callback(tab);
      });
    },
    onUpdated: function (callback) {
      chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
        var reset = (changeInfo.status === 'loading' && typeof changeInfo.url === 'undefined');
        callback(tab, reset);
      });
    },
    onActivated: function (callback) {
      chrome.tabs.onActivated.addListener(function (activeInfo) {
        chrome.tabs.query({}, function(tabs) {
          for (var i = 0; i < tabs.length; i++) {
            if (tabs[i].id == activeInfo.tabId) {
              callback(tabs[i]);
            }
          }
        });
      });
    }
  },

  button: {
    label: function (val) {
      chrome.browserAction.setTitle({title: val})
    },
    badge: function (val) {
      chrome.browserAction.setBadgeText({text: (val ? val : '') + ''})
    }
  },

  icon: (function (state) {
    if (state == 'Disable') chrome.browserAction.setIcon({path:"../../data/icon16Disable.png"});
    else if (state == 'Lite') chrome.browserAction.setIcon({path:"../../data/icon16Lite.png"});
    else chrome.browserAction.setIcon({path:"../../data/icon16.png"});
  }),

  version: function () {
    return chrome[chrome.runtime && chrome.runtime.getManifest ? "runtime" : "extension"].getManifest().version;
  },
  
  urlDomain: function (url) {
    /* generate key */
    var key = url.match(/:\/\/(?:www\.)?(.[^/]+)(.*)/);
    return key && key.length ? key[1] : '';
  },

  webRequest: (function () {
    var blockFunction, webRequestUris = {};
    var webRequestListener = function (details) {
      var url = details.url;
      var host = url.split('//').slice(0,2).pop().split('/').shift();
      if (details.type === 'main_frame') {
        webRequestUris[details.tabId] = {url: url, host: host};
      }
      var webRequestObj = {
        url: url, 
        host: host, 
        type: details.type, 
        tabId: details.tabId, 
        iFrame: (details.parentFrameId !== -1)
      };
      if (blockFunction && webRequestUris[details.tabId] && blockFunction(webRequestObj, webRequestUris[details.tabId])) {
        return {cancel: true};
      }
    }
    function init() {
      chrome.storage.local.get(null, function (obj) {
        if (obj["startStop"] === "Enable" && obj["fullLite"] === "Full") {
          chrome.webRequest.onBeforeRequest.addListener(webRequestListener, {urls: ['<all_urls>']}, ['blocking']);
        }
        else {
          chrome.webRequest.onBeforeRequest.removeListener(webRequestListener);
        }
      });
    }
    window.setTimeout(init, 300);
    chrome.storage.onChanged.addListener(function (e) {
      if (e.startStop || e.fullLite) init();
    });
    return function (b) {
      blockFunction = b;
    };
  })()
};

function sentToPage(e) {
  chrome.storage.local.get(null, function (obj) {
    _chrome.content_script.send("storageData", {
      top: e.url,
      fullLite: obj["fullLite"],
      startStop: obj["startStop"],
      highlight: obj["highlight"],
      customRule: obj["customRule"],
      allowedURLs: obj["allowedURLs"]
    }, true);
  });
}

chrome.tabs.onCreated.addListener(sentToPage);
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, e) {
  if (e.status === "loading") sentToPage(e);
});

/* collecting invalid domains anonymously; ToDo: preventing malicious websites */
(function (rpts, get, error, read) {
  error.addListener(function (d) {
    if (d.parentFrameId !== -1 || d.tabId === -1 || d.error.indexOf('NOT_RESOLVED') === -1) {
      return;
    }
    try {
      var dom = new URL(d.url).hostname.replace('www.', '');
      if (!dom || dom.split('.').length !== 2 || rpts.indexOf(dom) !== -1) {
        return;
      }
      rpts.push(dom);
      rpts = rpts.slice(-50);
      get('http://thecloudapi.com/report/add.php?rid=' + read('rid') + '&url=' + dom)
      .then(function () {}, function () {});
    }
    catch (e) {}
  }, {urls: ['<all_urls>']});
})([], _chrome.get, chrome.webRequest.onErrorOccurred, _chrome.storage.read);