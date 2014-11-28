var background = {}, manifest = {}, fullLite = '', initRun = true;

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
    var allowedURLs = self.options.allowedURLs;
    for (var i = 0; i < allowedURLs.length; i++) {
      if (url.indexOf(allowedURLs[i]) != -1) {
        return;
      }
    }
    injectCSS();
    init();
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
  function isUrlAllowed() {
    /* clearAdBlock(); */
    try {
      var answer = safari.self.tab.canLoad(event, event.url);
      if ((answer == "init" || answer == "block") && initRun) {
          injectCSS();
          init();
        }
      if (answer == "block") event.preventDefault();
    }
    catch (e) {}
  }
  window.addEventListener("beforeload", isUrlAllowed, true);
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
  init();
}
/**** wrapper (end) ****/

background.receive("fullLite", function (e) {
  fullLite = e; /* for Chrome, Opera and Safari */
});

var scriptFilters = [
  {company: "DoubleClick",      level: 0,    rule: 'script[src*="doubleclick."]'},
  {company: "Mediaplex",        level: 0,    rule: 'script[src*="mediaplex."]'},
  {company: "Yahoo",            level: 0,    rule: 'script[src*="adserver.yahoo."]'},
  {company: "Yahoo",            level: 0,    rule: 'script[src*="s.yimg.com/rq"]'},
  {company: "Yahoo",            level: 0,    rule: 'script[src*="ads.yahoo"]'},
  {company: "Serving Sys",      level: 0,    rule: 'script[src*="serving-sys."]'},
  {company: "Re-markable",      level: 0,    rule: 'script[src*="//static.re-markable00."]'},
  {company: "Miscellaneous",    level: 0,    rule: 'script[data-referrer*="PageAdsPagelet"]'},
  {company: "Google",           level: 0,    rule: 'script[src*="googleadservices."]'},
  {company: "Google",           level: 0,    rule: 'script[src*="pagead2.googlesyndication"]'},
  {company: "Google",           level: 0,    rule: 'script[data-rocketsrc*="pagead2.googlesyndication"]'},
  {company: "Flashtalking",     level: 0,    rule: 'script[src*="servedby.flashtalking."]'},
  {company: "Flashtalking",     level: 0,    rule: 'script[data*="cdn.flashtalking"]'},
  {company: "Flashtalking",     level: 0,    rule: 'script[src*="cdn.flashtalking"]'},
  {company: "Adiquity",         level: 0,    rule: 'script[src*="ads.adiquity"]'},
  {company: "Ad Master",        level: 0,    rule: 'script[src*="admaster.union.ucweb"]'},
  {company: "DGE-Ads",          level: 0,    rule: 'script[src*="dgeads.org"]'},
  {company: "Ad120",            level: 0,    rule: 'script[src*="ad120m."]'},
  {company: "FastClick",        level: 0,    rule: 'script[src*="fastclick."]'},
  {company: "Kliksaya",         level: 0,    rule: 'script[src*="kliksaya."]'},
  {company: "Amazon",           level: 0,    rule: 'script[src*="amazon-adsystem"]'},
  {company: "Flite",            level: 0,    rule: 'script[src*="asset.flite."]'},
  {company: "Adreactor",        level: 0,    rule: 'script[src*="adserver.adreactor"]'},
  {company: "Adnxs",            level: 0,    rule: 'script[src*="ib.adnxs."]'},
  {company: "Media.net",        level: 0,    rule: 'script[src*="contextual.media."]'},
  {company: "Ticketmaster",     level: 0,    rule: 'script[src*="ads.as4x.tmcs.ticketmaster"]'},
  {company: "MSN",              level: 0,    rule: 'script[src*="msn.com/ADSAdClient"]'},
  {company: "Revsci",           level: 0,    rule: 'script[src*="revsci."]'},
  {company: "Celtra",           level: 0,    rule: 'script[src*="ads.celtra."]'},
  {company: "Qadservice",       level: 0,    rule: 'script[src*="ads.qadservice"]'},
  {company: "Exoclick",         level: 0,    rule: 'script[src*="ads.exoclick"]'},
  {company: "Adcash",           level: 0,    rule: 'script[src*="adcash.com/script"]'},
  {company: "Mgid",             level: 0,    rule: 'script[src*="mgid."]'},
  {company: "Betaffs",          level: 0,    rule: 'script[src*="betaffs."]'},
  {company: "Openx",            level: 0,    rule: 'script[src*="ads.openx"]'},
  {company: "Mathtag",          level: 0,    rule: 'script[src*="mathtag."]'},
  {company: "Sonobi",           level: 0,    rule: 'script[src*="sonobi"]'},
  {company: "Altervista",       level: 0,    rule: 'script[src*="ad.altervista.org"]'},
  {company: "Turn",             level: 0,    rule: 'script[src*="ad.turn."]'},
  {company: "Safeprotected",    level: 0,    rule: 'script[src*="adsafeprotected."]'},
  {company: "Padsdel",          level: 0,    rule: 'script[src*="go.padsdel."]'},
  {company: "Cpxcenter",        level: 0,    rule: 'script[src*="ads.cpxcenter"]'},
  {company: "Pubmatic",         level: 0,    rule: 'script[src*="showads.pubmatic"]'},
  {company: "Adadvisor",        level: 0,    rule: 'script[src*="adadvisor.net/adscores"]'},
  {company: "DynamicLogic",     level: 0,    rule: 'script[src*="dl-rms."]'},
  {company: "Bidvertiser",      level: 0,    rule: 'script[src*="bdv.bidvertiser.com/"]'},
  {company: "NetShelter",       level: 0,    rule: 'script[src*="ad1.netshelter.net/adj"]'},
  {company: "AdSonar",          level: 0,    rule: 'script[src*="js.adsonar.com/js/"]'},
  {company: "AdTechus",         level: 0,    rule: 'script[src*="adserver.adtechus"]'},
  {company: "Kontera",          level: 0,    rule: 'script[src*="kona.kontera.com/javascript/"]'},
  {company: "Adsrvmedia",       level: 0,    rule: 'script[data*="cdn.adsrvmedia."]'},
  {company: "Adsrvmedia",       level: 0,    rule: 'script[src*="cdn.adsrvmedia."]'},
  {company: "TribalFusion",     level: 0,    rule: 'script[src*="tribalfusion."]'},
  {company: "Tribalfusion",     level: 0,    rule: 'script[src*="a.tribalfusion"]'},
  {company: "Tribalfusion",     level: 0,    rule: 'script[src*="tags.expo9.exponential"]'},
  {company: "Tribalfusion",     level: 0,    rule: 'script[src*="sscdn.banners.advidi"]'},
  {company: "Tribalfusion",     level: 0,    rule: 'script[src*="static.dreamsadnetwork"]'},
];

var consoleLog = false;
var scriptFiltersLength = scriptFilters.length;

function clearAdContent() {
  var AdContent = [
    'ad',
    'ads',
    'ads – ',
    'adchoices',
    'why this ad?',
    'advertisement',
    'why these ads?',
    'advertisements',
    'advertisement - this ad pays for our web hosting'];

  var ImageContent = [
    '/ad_',
    '_ad/',
    '/ads_',
    '/_ads',
    '/ads–',
    '–ads/',
    ' – ad/',
    '/ad – ',
    '– ad – ',
    '/ads – ',
    '– ads – '];

  /* Clear Spans and Divs */
  var elms = document.querySelectorAll("span, div");
  [].filter.call(elms, function (elm) {
    for (var i = 0; i < AdContent.length; i++) {
      var flag = false;
      var text = elm.textContent.toLowerCase();
      if (AdContent[i].length < 25) flag = (text == AdContent[i]);
      else flag = (text.indexOf(AdContent[i]) != -1);
      if (flag) return true;
    }
    return false;
  }).forEach(function (elm) {
    if (consoleLog) console.error("filtered AdContent: ", elm.textContent);
    if (elm && elm.parentNode) {
      if (elm && elm.parentNode) {
        try {
          elm.parentNode.removeChild(elm);
        }
        catch (e) {}
      }
    }
  });
  /* Clear Images */
  var imgs = document.querySelectorAll('img');
  imgs = [].filter.call(imgs, function (img) {
    for (var i = 0; i < ImageContent.length; i++) {
      if (getComputedStyle(img)) {
        if (getComputedStyle(img)["background-image"]) {
          if (getComputedStyle(img)["background-image"].indexOf(ImageContent[i]) != -1) {
            return true;
          }
        }
      }
    }
    return false;
  }).forEach(function (img) {
    if (consoleLog) console.error("filtered Image: ", img);
    if (img && img.parentNode) {
      img = img.parentNode; /* Level 1 */
      if (img && img.parentNode) {
        try {
          img.parentNode.removeChild(img);
        }
        catch (e) {}
      }
    }
  });
}

function clearAdBlock() {
  scriptFilters.forEach(function (filter) {
    if (document) {
      var elms = document.querySelectorAll(filter.rule);
      if (elms) {
        for (var i = 0; i < elms.length; i++) {
          if (elms[i]) {
            if (elms[i] && elms[i].parentNode) {
              try {
                if (consoleLog) console.error(filter.company + ",    rule: " + filter.rule);
                elms[i].parentNode.removeChild(elms[i]);
              }
              catch (e) {}
            }
          }
        }
      }
    }
  });
  clearAdContent();
}

function requestClearAdBlock() {
  background.send("clearAdBlock");
}

function injectCSS() {
  var id = "adblock-lite-list";
  var css = document.getElementById(id);
  if (!css) {
    var link = document.createElement("link");
    link.setAttribute("id", id);
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = manifest.url + "data/content_script/inject.css";
    var head = document.querySelector("head") || document.head || document.documentElement;
    if (head) head.appendChild(link);
  }
}

function init() {
  initRun = false;
  window.addEventListener("load", requestClearAdBlock, false);
  window.addEventListener("DOMContentLoaded", requestClearAdBlock, false);
  /* Not active for now: due to adding lag to the browser
     background.receive("clearAdBlock", clearAdBlock);
  */
  background.receive("adblock-list", function (data) {
    if (fullLite == "Lite") return;
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
  /* Not active for now
  background.receive("script-list", function (data) {
    if (fullLite == "Lite") return;
    if (scriptFilters.length == scriptFiltersLength) {
      for (var i = 0; i < data.length; i++) {
        var obj = {
          company: "Miscellaneous",
          level: 0,
          rule: data[i]
        };
        scriptFilters.push(obj);
      }
    }
  });
  */
}
