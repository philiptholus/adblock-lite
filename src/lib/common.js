var storage, get, popup, window, Deferred, content_script, tab, context_menu, notification, version, play, icon, timer;

/**** wrapper (start) ****/
if (typeof require !== 'undefined') { //Firefox
  var firefox = require("./firefox/firefox");
  ["storage", "notification", "get", "popup", "window", "content_script", "tab", "context_menu", "version", "play", "icon", "Deferred", "timer"].forEach(function (id) {
    this[id] = firefox[id];
  });
  var filters = require('./filter').filters;
}
else if (typeof safari !== 'undefined') { // Safari
  ["storage", "notification", "get", "popup", "content_script", "tab", "context_menu", "version", "play", "icon", "timer"].forEach(function (id) {
    this[id] = _safari[id];
  });
  Deferred = task.Deferred;
}
else { //Chrome
  ["storage", "notification", "get", "popup", "content_script", "tab", "context_menu", "version", "play", "icon", "timer"].forEach(function (id) {
    this[id] = _chrome[id];
  });
  Deferred = task.Deferred;
}
/**** wrapper (end) ****/

if (storage.read("version") != version()) {
  storage.write("version", version());
  tab.open("http://add0n.com/firewall-lite.html?version=" + version());
}

// Initialization
if (!storage.read("fullLite")) storage.write("fullLite", "Full");
if (!storage.read("startStop")) storage.write("startStop", "Enable");
if (!storage.read("allowedURLs")) storage.write("allowedURLs", JSON.stringify(filters.allowedURLs));

function setIcon() {
  var startStop = storage.read("startStop")
  if (startStop == "Disable") icon("Disable");
  else icon(storage.read("fullLite"));
}
setIcon();

content_script.receive("deleteById", function (data) {
  content_script.send("deleteById", data, true);
});

content_script.receive("clearAdBlock", function () {
  content_script.send("clearAdBlock", "", true);
});

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

popup.receive("popupStart", function () {
  popup.send("popupStart", {
    fullLite: storage.read("fullLite"),
    startStop: storage.read("startStop"),
    allowedURLs: JSON.parse(storage.read("allowedURLs"))
  });
});

popup.receive("storePopupData", function (data) {
  storage.write("allowedURLs", data.allowedURLs);
  storage.write("fullLite", data.fullLite);
  storage.write("startStop", data.startStop);
});

/* 
  Adblock lite uses only selective rules from Adblock Plus Easy-list. Combining this 
  with the local inject.css rules, we are targeting most ads while keeping the extension lite and fast.
  Adblock Plus filters explained: https://adblockplus.org/en/filter-cheatsheet
*/
var adBlockPlusEasyList = "https://easylist-downloads.adblockplus.org/easylist.txt";

get(adBlockPlusEasyList).then(function (adblockList) {
  var ruleList = [], css = [], script = [], url = [];
  
  adblockList = adblockList.split("\n");
  
  /* init the conditions */
  var easylistGeneralHide = false, easylistGeneralBlock = false, easylistAdServers = false;
  /* ***************** */
  
  for (var i = 0; i < adblockList.length; i++) {
    var e = adblockList[i];
    var src = '', href = '', object = '', js = '';
    
    /* end the condition */
    if (e.indexOf("easylist_general_block_dimensions.txt") != -1) easylistGeneralBlock = false;
    if (e.indexOf("easylist_whitelist_general_hide.txt") != -1) easylistGeneralHide = false;
    if (e.indexOf("easylist_specific_block.txt") != -1) easylistAdServers = false;
    /* ***************** */

    function cAk(str, params) {
      for (var p = 0; p < params.length; p++) {
        str = str.replace(params[p], '').replace(/([$|,])/g, '').replace(/\^/g, '');
      }
      return str.split("*");
    }
    
    if (e.indexOf("!") == -1 && e.indexOf("domain=") == -1) {
      if (easylistGeneralBlock) { /* easy-list general block */
        var keys = cAk(e, ["third-party"]);
        for (var j = 0; j < keys.length; j++) {
          var key = keys[j];
          if (key) {
            src += '[src*="' + key + '"]';
            href += '[href*="' + key + '"]';
          }
        }
        css.push(src);
        css.push(href);
      }
      else if (easylistGeneralHide) { /* easy-list general hide */
        var match = e.replace("###", '#').replace("##", '');
        css.push(match);
      }
      else if (easylistAdServers) { /* easy-list adservers */
        var flag1 = e.indexOf("||") == 0;
        var flag2 = (e.indexOf("popup") + 5 == e.length) || (e.indexOf("/banners/") + 9 == e.length) || 
                    (e.indexOf("third-party") + 11 == e.length) || 
                    (e.indexOf("popup") == -1 && e.indexOf("third-party") == -1);
        
        if (flag1 && flag2) {
          var keys = cAk(e, ["third-party", "popup"]);
          for (var j = 0; j < keys.length; j++) {
            var key = keys[j];
            if (key) {
              src += '[src*="' + key + '"]';
              object += '[data*="' + key + '"]';
              js += '[src*="' + key + '"]';
            }
          }
          css.push(src);
          css.push('object' + object);
          script.push('script' + js);
          if (keys.length == 1) url.push(keys[0]);
        }
      }
    }
    
    /* start the condition */
    if (e.indexOf("easylist_general_block.txt") != -1) easylistGeneralBlock = true;
    if (e.indexOf("easylist_general_hide.txt") != -1) easylistGeneralHide = true;
    if (e.indexOf("easylist_adservers_popup.txt") != -1) easylistAdServers = true;
    if (e.indexOf("easylist_thirdparty_popup.txt") != -1) easylistAdServers = true;
    if (e.indexOf("easylist_adult/adult_thirdparty.txt") != -1) easylistAdServers = true;
    if (e.indexOf("easylist_adservers.txt") != -1) easylistAdServers = true;
    if (e.indexOf("easylist_thirdparty.txt") != -1) easylistAdServers = true;
    /* ******************* */
    
  }
  /* make css lists containing 20 rules each */
  for (var i = 0; css.length > 0; i++) {
    var selector = css.splice(0, 19).join(",") + "{display:none !important;}";
    ruleList.push(selector);
  }
  filters.adServer = url;            /* for webrequest */
  filters.scriptList = script;       /* for scripts */
  filters.adblockList = ruleList;    /* for css */
});