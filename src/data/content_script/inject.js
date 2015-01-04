var background = {}, manifest = {}, fullLite = '', highlight = '';

/**** wrapper (start) ****/
if (typeof self !== 'undefined' && self.port) { /* Firefox */
  background.send = function (id, data) {
    self.port.emit(id, data);
  }
  background.receive = function (id, callback) {
    self.port.on(id, callback);
  }
  self.port.on("topLevelUrl", function (url) {
    fullLite = self.options.fullLite;
    highlight = self.options.highlight;
    var allowedURLs = self.options.allowedURLs;
    for (var i = 0; i < allowedURLs.length; i++) {
      if (url.indexOf(allowedURLs[i]) != -1) {
        return;
      }
    }
    injectCSS();
  });
  manifest.url = "resource://" + self.options.manifest.id.replace("@", "-at-") + "/" + self.options.manifest.name + "/";
}
else if (typeof safari !== 'undefined') { /* Safari */
  background.send = function (id, obj) {
    safari.self.tab.dispatchMessage("message", {
      id: id,
      data: obj
    });
  }
  background.receive = (function () {
    var callbacks = {};
    safari.self.addEventListener("message", function (e) {
      if (callbacks[e.name]) {
        callbacks[e.name](e.message);
      }
    }, false);

    return function (id, callback) {
      callbacks[id] = callback;
    }
  })();
  manifest.url = safari.extension.baseURI;

  document.addEventListener('contextmenu', function () {
    var selectedText = window.getSelection().toString();
    try {
      safari.self.tab.setContextMenuEventUserInfo(event, {selectedText: selectedText});
    } catch (e) {}
  }, false);

  /* dispatch event for Safari: httpChannel*/
  function doBlock() {
    try {
      var answer = safari.self.tab.canLoad(event, event.url);
      if ((answer.name == "injectCss")) {
        /* 'answer' is an object received from safari background-page */
        highlight = answer.text;
        fullLite = answer.fullLite;
        injectCSS();
        window.removeEventListener("beforeload", doBlock, true);
      }
    }
    catch (e) {}
  }
  window.addEventListener("beforeload", doBlock, true);
  // **************************
}
else if (typeof chrome !== 'undefined') { /* Chrome */
  background.send = function (id, data) {
    chrome.extension.sendRequest({method: id, data: data});
  }
  background.receive = function (id, callback) {
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
      if (request.method == id) {
        callback(request.data);
      }
    });
  }
  manifest.url = chrome.extension.getURL("./");
  injectCSS();
}
/**** wrapper (end) ****/

/* for Chrome, Opera and Safari */
background.receive("fullLite", function (e) {fullLite = e;});
background.receive("highlight", function (e) {highlight = e;});

function injectCSS() {
  var isChrome = (typeof chrome !== 'undefined');
  /* inject lite css */
  if (!isChrome) { /* for Firefox and Safari */
    var id = "adblock-lite-list";
    var css = document.getElementById(id);
    if (!css) {
      var link = document.createElement("link");
      link.setAttribute("id", id);
      link.rel = "stylesheet";
      link.type = "text/css";
      if (highlight == 'block') link.href = manifest.url + "data/content_script/inject_b.css";
      if (highlight == 'highlight') link.href = manifest.url + "data/content_script/inject_h.css";
      var head = document.querySelector("head") || document.head || document.documentElement;
      if (head) head.appendChild(link);
    }
  }
  /* inject full css */
  background.receive("adblock-list", function (data) {
    if (fullLite == "Lite") return; /* do not inject full-css in lite mode */
    var id = "adblock-full-list";
    var css = document.getElementById(id);
    if (!css) {
      var style = document.createElement("style");
      style.setAttribute("type", "text/css");
      style.setAttribute("id", id);
      var head = document.querySelector("head") || document.head || document.documentElement;
      if (head) head.appendChild(style);
      for (var i = 0; i < data.length; i++) {
        style.sheet.insertRule(data[i], i);
      }
    }
  });
}