var background = {}, manifest = {};

/**** wrapper (start) ****/
if (typeof self !== 'undefined' && self.port) { /* Firefox */
  background.send = function (id, data) {
    self.port.emit(id, data);
  }
  background.receive = function (id, callback) {
    self.port.on(id, callback);
  }
  manifest.url = self.options.base;
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
  /* handle all request types except ajax */
  var onTabUpdated = false;
  window.addEventListener("beforeload", function (e) {
    if (!onTabUpdated) safari.self.tab.dispatchMessage("onTabUpdated", {});
    onTabUpdated = true;
    try {
      var nodeTypes = {
        "frame": "sub_frame",
        "iframe": "sub_frame",
        "script": "script",
        "img": "image",
        "input": "image",
        "object": "object",
        "embed": "object",
        "link": "stylesheet"
      };
      var webResponse = safari.self.tab.canLoad(event, {
        url: e.url,
        top: e.target.baseURI,
        type: nodeTypes[e.target.nodeName.toLowerCase()] || "other",
        iFrame: e.target.nodeName.toLowerCase() === "sub_frame"
      });
      if (webResponse.method === "block") event.preventDefault();
    }
    catch (e) {}
  }, true);
  /* handle ajax request types */
  document.addEventListener("DOMContentLoaded", function () {
    var xhr = document.getElementById("safari_handle_xhr_request");
    if (!xhr) {
      var script = document.createElement("script");
      script.src = manifest.url + "data/content_script/safari/xhr.js";
      script.setAttribute("id", "safari_handle_xhr_request");
      if (document.body) {
        document.body.appendChild(script);
      }
    }
  }, false);
  window.addEventListener("message", function (e) {
    if (e.data && e.data.path === "xhr-to-content-script") {
      var xhrResponse = safari.self.tab.canLoad(event, {
        url: e.data.url,
        top: e.origin,
        index: e.data.index,
        type: "xmlhttprequest",
        iFrame: false
      });
      window.postMessage({
        path: "content-script-to-xhr",
        method: xhrResponse.method,
        url: xhrResponse.url,
        index: xhrResponse.index
      }, "*");
    }
  }, false);
}
else if (typeof chrome !== 'undefined') { /* Chrome */
  background.send = function (id, data) {
    chrome.runtime.sendMessage({path: 'page-to-background', method: id, data: data});
  }
  background.receive = function (id, callback) {
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
      if (request.path == 'background-to-page') {
        if (request.method == id) {
          callback(request.data);
        }
      }
    });
  }
  manifest.url = chrome.extension.getURL('');
}
/**** wrapper (end) ****/

function init(data) {
  var topLevelUrl = '';
  function isAllowedPage(top, whitelist) {
    if (top) {
      try {
        top = new URL(top).hostname;
        if (whitelist.indexOf(top) !== -1) return false;
      }
      catch (e) {}
    }
    return true;
  }
  if (data.top) topLevelUrl = data.top;
  var head = document.querySelector("head") || document.head || document.documentElement;
  if (head) {
    var link_l = document.getElementById("lite-css-list");
    var style_c = document.getElementById("custom-css-list");
    if (link_l) head.removeChild(link_l);
    if (style_c) head.removeChild(style_c);
  }
  if (data.startStop === "Enable") {
    var whitelist = JSON.parse(data.allowedURLs).join('|');
    if (isAllowedPage(topLevelUrl, whitelist)) {
      if (head) {
        /* adding Lite css */
        var link = document.createElement("link");
        link.setAttribute("id", "lite-css-list");
        link.rel = "stylesheet";
        link.type = "text/css";
        if (data.highlight === 'block') link.href = manifest.url + "data/content_script/lite_css_b.css";
        if (data.highlight === 'highlight') link.href = manifest.url + "data/content_script/lite_css_h.css";
        head.appendChild(link);
        /* adding Custom css */
        var customRule = JSON.parse(data.customRule);
        if (customRule && customRule.length) {
          var style = document.createElement("style");
          style.setAttribute("type", "text/css");
          style.setAttribute("id", "custom-css-list");
          head.appendChild(style);
          var ruleList = [], method = " {display: none !important; visibility: hidden !important;}";
          if (data.highlight === 'highlight') method = " {color: red !important; border: solid 2px red !important; background-color: #FFE987 !important;}";
          for (var i = 0; i < customRule.length; i++) {
            var selector = customRule.splice(0, 19).join(",") + method;
            ruleList.push(selector);
          }
          for (var i = 0; i < ruleList.length; i++) {
            try {style.sheet.insertRule(ruleList[i], i)}
            catch(e) {}
          }
        }
      }
    }
  }
}
background.receive("storageData", init);
