var _chrome = {
  storage: {
    read: function (id) {
      return localStorage[id] || null;
    },
    write: function (id, data) {
      localStorage[id] = data + "";
    }
  },
  
  timer: window,
  
  get: function (url, headers, data) {
    var xhr = new XMLHttpRequest();
    var deferred = new task.Deferred();
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        if (xhr.status >= 400 || xhr.status < 200) {
          var e = new Error(xhr.statusText);
          e.status = xhr.status;
          deferred.reject(e);
        }
        else {
          deferred.resolve(xhr.responseText);
        }
      }
    };
    xhr.open(data ? "POST" : "GET", url, true);
    for (var id in headers) {
      xhr.setRequestHeader(id, headers[id]);
    }
    if (data) {
      var arr = [];
      for(e in data) {
        arr.push(e + "=" + data[e]);
      }
      data = arr.join("&");
    }
    xhr.send(data ? data : "");
    return deferred.promise;
  },

  popup: {
    send: function (id, data) {
      chrome.extension.sendRequest({method: id, data: data});
    },
    receive: function (id, callback) {
      chrome.extension.onRequest.addListener(function(request, sender, callback2) {
        if (request.method == id && !sender.tab) {
          callback(request.data);
        }
      });
    }
  },

  content_script: {
    send: function (id, data, global) {
      var options = global ? {} : {active: true, currentWindow: true}
      chrome.tabs.query(options, function(tabs) {
        tabs.forEach(function (tab) {
          chrome.tabs.sendMessage(tab.id, {method: id, data: data}, function() {});
        });
      });
    },
    receive: function (id, callback) {
      chrome.extension.onRequest.addListener(function(request, sender, callback2) {
        if (request.method == id && sender.tab) {
          callback(request.data);
        }
      });
    }
  },

  tab: {
    open: function (url) {
      chrome.tabs.create({url: url});
    },
    insertCSS: function (tabId, details, callback) {
      chrome.tabs.insertCSS(tabId, details, function () {
        callback();
      });
    },
    executeScript: function (tabId, details, callback) {
      chrome.tabs.executeScript(tabId, details, function () {
        callback();
      });
    },
    onCreated: function (callback) {
      chrome.tabs.onCreated.addListener(function (tab) {
        callback(tab);
      });
    },
    onUpdated: function (callback) {
      chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
        callback(tabId, changeInfo, tab);
      });
    },
    openOptions: function () {
      var optionsTab = false;
      chrome.tabs.query({}, function (tabs) {
        for (var i = 0; i < tabs.length; i++) {
          var tab = tabs[i];
          if (tab.url.indexOf("data/options/options.html") != -1) {
            chrome.tabs.reload(tab.id, function () {});
            chrome.tabs.update(tab.id, {active: true}, function () {});
            optionsTab = true;
            break;
          }
        }
        if (!optionsTab) chrome.tabs.create({url: "./data/options/options.html"});
      });
    }
  },

  webRequest: {
    onBeforeRequest: function (callback, filter, opt_extraInfoSpec) {
      chrome.webRequest.onBeforeRequest.addListener(function (details) {
        callback(details);
      }, filter, opt_extraInfoSpec);
    }
  },

  context_menu: {
    create: function (title, type, callback) {  //type: selection, page
      chrome.contextMenus.create({
        "title": title,
        "contexts": [type],
        "onclick": function () {
          callback();
        }
      });
    }
  },

  icon: (function (state) {
    if (state == 'Disable') chrome.browserAction.setIcon({path:"../../data/icon16Disable.png"});
    else if (state == 'Lite') chrome.browserAction.setIcon({path:"../../data/icon16Lite.png"});
    else chrome.browserAction.setIcon({path:"../../data/icon16.png"});
  }),

  notification: function (title, text) {
    var notification = webkitNotifications.createNotification(
      chrome.extension.getURL("./") + 'data/icon48.png',  title,  text
    );
    notification.show();
    window.setTimeout(function () {
      notification.cancel();
    }, 5000);
  },

  play: (function () {
    var audio = new Audio();
    var canPlay = audio.canPlayType("audio/mpeg");
    if (!canPlay) {
      audio = document.createElement("iframe");
      document.body.appendChild(audio);
    }
    return function (url) {
      if (canPlay) {
        audio.setAttribute("src", url);
        audio.play();
      }
      else {
        audio.removeAttribute('src');
        audio.setAttribute('src', url);
      }
    }
  })(),

  version: function () {
    return chrome[chrome.runtime && chrome.runtime.getManifest ? "runtime" : "extension"].getManifest().version;
  }
}

/* * Code for injecting content_script * */
function allowContentScript(url) {
  /* Do not inject code in the following pages */
  var forbiddenPages = 
  [
    "about:blank",
    "addons.opera",
    "chrome-devtools://",
    "data:text/html,chromewebdata",
    "opera://extensions",
    "opera://plugins",
    "opera://downloads",
    "opera://startpage",
    "opera://settings",
    "opera://settings/fonts",
    "opera://about",
    "opera://flags",
    "opera://history",
    "opera://themes",
    "opera://histograms",
    "opera://media-internals",
    "opera://remote-debug",
    "opera://remote-debug",
    "opera://gpu",
    "chrome://extensions",
    "chrome://plugins",
    "chrome://downloads",
    "chrome://startpage",
    "chrome://settings",
    "chrome://settings/fonts",
    "chrome://about",
    "chrome://flags",
    "chrome://history",
    "chrome://themes",
    "chrome://histograms",
    "chrome://media-internals",
    "chrome://remote-debug",
    "chrome://remote-debug",
    "chrome://gpu"
  ];

  for (var i = 0; i < forbiddenPages.length; i++) {
    if (!url || url.indexOf(forbiddenPages[i]) != -1) {
      return false;
    }
  }
  var allowedURLs = JSON.parse(_chrome.storage.read("allowedURLs"));
  for (var i = 0; i < allowedURLs.length; i++) {
    if (url && url.indexOf(allowedURLs[i]) != -1) {
      return false;
    }
  }
  return _chrome.storage.read("startStop") == "Enable"
}

function insertContentScript(e) {
  var chromeVersion = parseInt(window.navigator.appVersion.match(/Chrome\/(\d+)\./)[1], 10);
  if (allowContentScript(e.url) && e.status == "loading") {
    try {
      var jsObj;
      if (chromeVersion >= 39) {
        jsObj = { // insert js
          file: "data/content_script/inject.js",
          allFrames: true,
          matchAboutBlank: true,
          runAt: "document_start"
        };
      }
      else {
        jsObj = { // insert js
          file: "data/content_script/inject.js",
          allFrames: true,
          runAt: "document_start"
        };
      }
      chrome.tabs.executeScript(e.id, jsObj, function (e) {
        _chrome.content_script.send("fullLite", _chrome.storage.read("fullLite"), true);
        _chrome.content_script.send("adblock-list", filters.adblockList, true);
        _chrome.content_script.send("script-list", filters.scriptList, true);
      });
    }
    catch (e) {}
  }
  if (allowContentScript(e.url)) {
    try {
      var cssObj;
      if (chromeVersion >= 39) {
        cssObj = { // insert css
          file: "data/content_script/inject.css",
          allFrames: true,
          matchAboutBlank: true,
          runAt: "document_start"
        };
      }
      else {
        cssObj = { // insert css
          file: "data/content_script/inject.css",
          allFrames: true,
          runAt: "document_start"
        };
      }
      chrome.tabs.insertCSS(e.id, cssObj, function () {});
    }
    catch (e) {}
  }
}

try {
  _chrome.webRequest.onBeforeRequest(function (details) {
    var burls = filters.blockedURLs;
    var burlsLength = burls.length;
    
    chrome.tabs.query({}, function (tabs) {
      for (var i = 0; i < tabs.length; i++) {
        if (details.tabId == tabs[i].id) {
          var topLevelURL = tabs[i].url
          if (details.url == topLevelURL) {
            // Allow tab (top level) url to load
          }
          else if (allowContentScript(topLevelURL)) {
            var type = details.type.toLowerCase();
            if (type == "script") {
              _chrome.content_script.send("clearAdBlock", "", true);
            }
            if (type == "script" || type == "image" || type == "sub_frame") {
              /* -- Do not concat the adServers for now --
                if (burls.length == burlsLength) burls = burls.concat(filters.adServer);
              */
              for (var j = 0; j < burls.length; j++) {
                var flag = (new RegExp('\\b' + burls[j] + '\\b')).test(details.url);
                if (flag) {
                  //console.error("onBeforeRequest: ", burls[j]);
                  return {cancel: true};
                }
              }
            }
          }
          break;
        }
      }
    });
  }, {urls: ["<all_urls>"]}, ["blocking"]);
}
catch (e) {}

chrome.tabs.onCreated.addListener(insertContentScript);
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, e) {
  insertContentScript(e);
});
/* ************************************* */
