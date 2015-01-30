var storage, get, popup, content_script, tab, version, icon, timer;

/**** wrapper (start) ****/
if (typeof require !== 'undefined') { /* Firefox */
  var firefox = require("./firefox/firefox");
  ["storage", "get", "popup", "content_script", "tab", "version", "icon", "timer"].forEach(function (id) {
    this[id] = firefox[id];
  });
  var filters = require('./filter').filters;
}
else if (typeof safari !== 'undefined') { /* Safari */
  ["storage", "get", "popup", "content_script", "tab", "version", "icon", "timer"].forEach(function (id) {
    this[id] = _safari[id];
  });
}
else { /* Chrome */
  ["storage", "get", "popup", "content_script", "tab", "version", "icon", "timer"].forEach(function (id) {
    this[id] = _chrome[id];
  });
}
/**** wrapper (end) ****/

if (!storage.read("version")) {
  timer.setTimeout(function () {
    tab.open("http://mybrowseraddon.com/firewall-lite.html?version=" + version());
  }, 2000);
}

/* Initialization */
if (storage.read("version") != version()) storage.write("version", version());
if (!storage.read("allowedURLs")) storage.write("allowedURLs", JSON.stringify(filters.allowedURLs));
if (!storage.read("fullLite")) storage.write("fullLite", "Lite"); /* changing the default to Lite Mode */
if (!storage.read("startStop")) storage.write("startStop", "Enable");
if (!storage.read("highlight")) storage.write("highlight", "block");

function setIcon() {
  var startStop = storage.read("startStop")
  if (startStop == "Disable") icon("Disable");
  else icon(storage.read("fullLite"));
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
    startStop: storage.read("startStop"),
    highlight: storage.read("highlight"),
    allowedURLs: JSON.parse(storage.read("allowedURLs"))
  });
});

popup.receive("storePopupData", function (data) {
  storage.write("allowedURLs", data.allowedURLs);
  storage.write("fullLite", data.fullLite);
  storage.write("startStop", data.startStop);
  storage.write("highlight", data.highlight);
});

/*
  Adblock lite uses only selective rules from Adblock Plus Easy-list. Combining this
  with the local inject.css rules, we are targeting most ads while keeping the extension lite and fast.
  Adblock Plus filters explained: https://adblockplus.org/en/filter-cheatsheet
*/
var adBlockPlusEasyList = "https://easylist-downloads.adblockplus.org/easylist.txt";

get(adBlockPlusEasyList).then(function (adblockList) {
  var css = [];
  adblockList = adblockList.split("\n");
  /* initiate the conditions */
  var easylistGeneralHide = false, easylistGeneralBlock = false
  for (var i = 0; i < adblockList.length; i++) {
    var e = adblockList[i];
    /* end the condition */
    if (e.indexOf(".txt ***") != -1) {
      easylistGeneralBlock = false;
      easylistGeneralHide = false;
    }
    function cAk(str, params) {
      for (var p = 0; p < params.length; p++) {
        str = str.replace(params[p], '').replace(/([$|,])/g, '').replace(/\^/g, '').replace(/\*/g, '');
      }
      return str.split("*");
    }
    if (e.indexOf("!") == -1 && e.indexOf("@") == -1 && e.indexOf("domain=") == -1) {
      if (easylistGeneralBlock) { /* easy-list general block */
        var keys = cAk(e, ["third-party"]);
        for (var j = 0; j < keys.length; j++) {
          var key = keys[j];
          if (key) {
            css.push('img[src*="' + key + '"]');
            css.push('iframe[src*="' + key + '"]');
          }
        }
      }
      else if (easylistGeneralHide) { /* easy-list general hide */
        var match = e.replace("###", '#').replace("##", '');
        css.push(match);
      }
    }
    /* start the condition */
    if (e.indexOf("easylist_general_block.txt") != -1) easylistGeneralBlock = true;
    if (e.indexOf("easylist_general_hide.txt") != -1) easylistGeneralHide = true;
  }
  /* make css lists containing 20 rules each */
  var ruleList = [];
  for (var i = 0; css.length > 0; i++) {
    var selector = css.splice(0, 19).join(",") + "{display:none !important;}";
    ruleList.push(selector);
  }
  filters.adblockList = ruleList;
  /* empty memory */
  css = [];
  ruleList = [];
  adblockList = [];
});