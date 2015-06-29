var browser, storage, get, popup, content_script, tab, version, icon, timer, getURL, webRequest, button;
var methods = ["storage", "get", "popup", "content_script", "tab", "version", "icon", "timer", "getURL", "webRequest", "urlDomain", "button"];

/**** wrapper (start) ****/
if (typeof require !== 'undefined') browser = require("./firefox/firefox");
else if (typeof safari !== 'undefined') browser = _safari;
else browser = _chrome;
methods.forEach(function (id) {this[id] = browser[id]});
/**** wrapper (end) ****/

var ver = storage.read("version");
if (ver !== version()) {
  timer.setTimeout(function () {
    tab.open("http://mybrowseraddon.com/firewall-lite.html?v=" + version() + (ver ? "&p=" + ver + "&type=upgrade" : "&type=install"));
    storage.write("version", version());
  }, 3000);
}

var allowedURLs = [
  "charity.org",
  "www.gnome.org",
  "www.cancer.org",
  "www.concern.net",
  "sourceforge.net",
  "www.redcross.org",
  "www.wikipedia.org",
  "chrome.google.com",
  "stackoverflow.com",
  "mybrowseraddon.com",
  "www.worldvision.org",
  "www.latex-project.org",
  "redribbonfoundation.org",
  "www.linuxfoundation.org",
  "www.libreoffice.org",
  "addons.mozilla.org",
  "www.openoffice.org",
  "addons.opera.com",
  "www.unicef.org",
  "www.kernel.org",
  "opensource.org",
  "github.com",
  "nodejs.org",
  "nrdc.org"
];

/* Initialization */
if (!storage.read("allowedURLs")) storage.write("allowedURLs", JSON.stringify(allowedURLs));
if (!storage.read("customRule"))  storage.write("customRule", JSON.stringify([]));
if (!storage.read("tableType"))   storage.write("tableType", "add"); /* Default Table is Add */
if (!storage.read("fullLite"))    storage.write("fullLite", "Lite"); /* Default is Lite Mode */
if (!storage.read("startStop"))   storage.write("startStop", "Enable");
if (!storage.read("highlight"))   storage.write("highlight", "block");
if (!storage.read("rid"))         storage.write("rid", Math.random().toString(36).substring(2, 14));

function pageSend(e) {
  content_script.send("storageData", {
    top: '',
    pageId: e ? e.pageId : '',
    fullLite: storage.read("fullLite"),
    startStop: storage.read("startStop"),
    highlight: storage.read("highlight"),
    customRule: storage.read("customRule"),
    allowedURLs: storage.read("allowedURLs")
  }, true);
}

content_script.receive("storageData", pageSend, true);

function setIcon() {
  var startStop = storage.read("startStop");
  if (startStop == "Disable") icon("Disable");
  else icon(storage.read("fullLite"));
  pageSend();
}
setIcon();

popup.receive("startStop", function (data) {
  if (data == "Disable") data = "Enable";
  else data = "Disable";
  popup.send("startStop", data);
  storage.write("startStop", data);
  setIcon();
});

popup.receive("fullLite", function (data) {
  if (data == "Lite") data = "Full";
  else data = "Lite";
  popup.send("fullLite", data);
  storage.write("fullLite", data);
  setIcon();
});

popup.receive("highlight", function (data) {
  if (data == "highlight") data = "block";
  else data = "highlight";
  popup.send("highlight", data);
  storage.write("highlight", data);
  setIcon();
});

popup.receive("popupStart", function () {
  popup.send("popupStart", {
    fullLite: storage.read("fullLite"),
    tableType: storage.read("tableType"),
    startStop: storage.read("startStop"),
    highlight: storage.read("highlight"),
    customRule: JSON.parse(storage.read("customRule")),
    allowedURLs: JSON.parse(storage.read("allowedURLs"))
  });
});

popup.receive("storePopupData", function (data) {
  storage.write("fullLite", data.fullLite);
  storage.write("tableType", data.tableType);
  storage.write("startStop", data.startStop);
  storage.write("highlight", data.highlight);
  storage.write("customRule", data.customRule);
  storage.write("allowedURLs", data.allowedURLs);
  pageSend();
});

var badgeCounter = {};

function updateBadge(tab, reset) {
  button.badge(0);
  var key = urlDomain(tab.url);
  if (reset) badgeCounter[key] = 0;
  var count = badgeCounter[key];
  if (!count || typeof count == undefined) count = 0;
  var flag = JSON.parse(storage.read("allowedURLs")).indexOf(key) === -1;
  if (flag && storage.read("startStop") === "Enable") {
    button.badge(count < 100 ? count : '99+');
  }
}

tab.onCreated(updateBadge);
tab.onUpdated(updateBadge);
tab.onActivated(updateBadge);

/*
  Adblock lite uses only selective rules from Adblock-Plus Easy-list. Combining these
  with the local css rules, we are targeting most ads while keeping the extension lite and fast.
  Adblock Plus filters explained: https://adblockplus.org/en/filter-cheatsheet
*/

var webRequestFilter = (function () {
  var keywords;
  function getDomain(url) {
    var host = url.split('//').slice(0, 2).pop().split('/').shift();
    var domain = /[\w\-]+((\.\w{2,3})+)$/.exec(host);
    return domain && domain.length ? domain[0].replace(/\^/g, '').replace(/\*/g, '') : host;
  }
  function check(rule, current, top) {
    var blockingRule = rule[0], blockingOptions = rule[1];
    var currentDomain = getDomain(current.host), topDomain = getDomain(top.host);
    /*  */
    if (blockingOptions.length) { /* do not check the blocking rule on these conditions: return false */
      var image = blockingOptions.indexOf('image') !== -1 && current.type !== 'image';
      var script = blockingOptions.indexOf('script') !== -1 && current.type !== 'script';
      var object = blockingOptions.indexOf('object') !== -1 && current.type !== 'object';
      var stylesheet = blockingOptions.indexOf('stylesheet') !== -1 && current.type !== 'stylesheet';
      var xmlhttprequest = blockingOptions.indexOf('xmlhttprequest') !== -1 && current.type !== 'xmlhttprequest';
      /*  */
      if (image && script && object && stylesheet && xmlhttprequest) return false
      if (blockingOptions.indexOf('~' + current.type) !== -1) return false
      if (blockingOptions.indexOf('subdocument') !== -1) if (!current.iFrame) return false
      if (blockingOptions.indexOf('~subdocument') !== -1) if (current.iFrame) return false
      if (blockingOptions.indexOf('document') !== -1) if (current.iFrame) return false
      if (blockingOptions.indexOf('elemhide') !== -1) {/* not supported yet */}
      if (blockingOptions.indexOf('third-party') !== -1) if (currentDomain === topDomain) return false
      if (blockingOptions.indexOf('~third-party') !== -1) if (currentDomain !== topDomain) return false
      var domainOptions = blockingOptions.filter(function (e) {return e.indexOf('domain=') !== -1})[0];
      if (domainOptions) {
        var domains = domainOptions.substr(7).split('|');
        var w = domains.filter(function (d) {return d[0] === '~'}).map(function (d) {return d.substr(1)});
        if (w.length && w.indexOf(topDomain) !== -1) return false;
        var b = domains.filter(function (d) {return d[0] !== '~'});
        if (b.length && b.indexOf(topDomain) === -1) return false;
      }
    }
    try {
      blockingRule = blockingRule.replace(/([\:\/\.\?])/g, '\\$1').replace(/^\|\|/, '[\\.\\/]').replace(/\^/g, '[^\\w\\d\\_\\-\\.\\%]').replace(/\*/g, '.*').replace(/^\|/, '^').replace(/\|$/, '$');
    }
    catch (e) {
      //console.error(blockingRule + ' has error');
    }
    return (new RegExp(blockingRule, 'i').test(current.url));
  };
  return {
    initialize: function () {
      return get(getURL('data/filter/filters.json'), 'json').then(function (data) {
        keywords = data;
      });
    },
    match: function (url) {
      var n = url.length - 8;
      var black = [], white = [];
      for (var i = 0; i < n; i++) {
        var keyword = keywords[url.substr(i, 9)];
        if (keyword) {
          for (var fullKeyword in keyword) {
            if (url.indexOf(fullKeyword) !== -1) {
              white = white.concat(keyword[fullKeyword][0]);
              black = black.concat(keyword[fullKeyword][1]);
            }
          }
        }
      }
      return {
        black: black,
        white: white
      };
    },
    block: function (keywords, current, top) {
      for (var j = 0; j < keywords.white.length; j++) {
        if (check(keywords.white[j], current, top)) {
          //console.error('[passed]: ', keywords.white[j][0], current.type, keywords.white[j][1][0] || '', keywords.white[j][1][1] || '', keywords.white[j][1][2] || '', keywords.white[j][1][3] || '');
          return false;
        }
      }
      for (var l = 0; l < keywords.black.length; l++) {
        if (check(keywords.black[l], current, top)) {
          var key = urlDomain(top.url);
          if (key) badgeCounter[key] = (badgeCounter[key] || 0) + 1;
          timer.setTimeout(function () { /* update badge async */
            updateBadge({url : top.url});
          }, 100);
          //console.error('[blocked]: ', keywords.black[l][0], current.type, keywords.black[l][1][0] || '', keywords.black[l][1][1] || '', keywords.black[l][1][2] || '', keywords.black[l][1][3] || '');
          return true;
        }
      }
      return false;
    }
  }
})();

var topLevelUrls = {}, doNotProceed = {};

webRequestFilter.initialize().then(function () {
  webRequest(function (current, top) {
    if (topLevelUrls[current.tabId] !== top.url || current.url === top.url) {
      topLevelUrls[current.tabId] = top.url;
      var whitelist = JSON.parse(storage.read("allowedURLs"));
      var index = whitelist.indexOf(top.host);
      doNotProceed[current.tabId] = (index === -1 ? false : true);
    }
    if (doNotProceed[current.tabId]) return false;
    var keywords = webRequestFilter.match(current.url);
    if (keywords.black.length) {
      if (webRequestFilter.block(keywords, current, top)) return true;
      else return false;
    }
  });
});
