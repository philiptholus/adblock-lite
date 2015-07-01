var background = {};

/**** wrapper (start) ****/
if (typeof chrome !== 'undefined') {  /* Chrome */
  background.send = function (id, data) {
    chrome.runtime.sendMessage({path: 'popup-to-background', method: id, data: data});
  }
  background.receive = function (id, callback) {
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
      if (request.path == 'background-to-popup') {
        if (request.method == id) {
          callback(request.data);
        }
      }
    });
  }
  window.setTimeout(function () {popupStart()}, 100);
}
else if (typeof safari !== 'undefined') { /* Safari */
  background = (function () {
    var callbacks = {};
    return {
      send: function (id, data) {
        safari.extension.globalPage.contentWindow.popup.dispatchMessage(id, data);
      },
      receive: function (id, callback) {
        callbacks[id] = callback;
      },
      dispatchMessage: function (id, data) {
        if (callbacks[id]) {
          callbacks[id](data);
        }
      }
    }
  })();
  var doResize = function () {
    safari.self.width = document.body.getBoundingClientRect().width;
    safari.self.height = document.body.getBoundingClientRect().height + 3;
  }
  window.addEventListener("resize", doResize, false);
  safari.application.addEventListener("popover", function (){
    window.setTimeout(function () {popupStart()}, 100);
  }, false);
}
else {  /* Firefox */
  background.send = function (id, data) {
    self.port.emit(id, data);
  }
  background.receive = function (id, callback) {
    self.port.on(id, callback);
  }
  self.port.on("show", popupStart);
  var doResize = function () {
    self.port.emit("resize", {
      w: document.body.getBoundingClientRect().width,
      h: document.body.getBoundingClientRect().height
    });
  }
  window.addEventListener("resize", doResize, false);
}
/**** wrapper (end) ****/

var allowedURLs = [], customRule = [], startStop = '', fullLite = '', highlight = '', tableType = '';

function $ (id) {
  return document.getElementById(id);
}

function popupStart() {
  background.receive('popupStart', function (data) {
    fullLite = data.fullLite;
    tableType = data.tableType;
    startStop = data.startStop;
    highlight = data.highlight;
    customRule = data.customRule;
    allowedURLs = data.allowedURLs;
    init();
  });
  background.send('popupStart');
}

function init() {
  var count = 1;
  var table = $('website-list-table');
  table.setAttribute("type", tableType);
  while (table.hasChildNodes()) table.removeChild(table.lastChild);
  function fillTable(arr, placeholder) {
    $("input-field").setAttribute("placeholder", placeholder);
    for (var i = arr.length - 1; i >= 0; i--) {
      var tr = document.createElement('tr');
      var td1 = document.createElement('td');
      var td2 = document.createElement('td');
      var td3 = document.createElement('td');

      td1.textContent = count;
      td1.setAttribute('type', 'number');
      td2.textContent = arr[i];
      td2.setAttribute('type', 'item');
      td3.setAttribute('type', 'close');

      tr.appendChild(td1);
      tr.appendChild(td2);
      tr.appendChild(td3);
      table.appendChild(tr);
      count++;
    }
  }
  if (table.getAttribute("type") == "add")    fillTable(allowedURLs, "Enter a website address to exclude");
  if (table.getAttribute("type") == "toggle") fillTable(customRule, "Enter a custom rule (in CSS Selector format)");

  var fullLiteTextContent = '';
  var highlightTextContent = '';
  var startStopTextContent = '';
  /* ***** */
  if (startStop == "Enable")    startStopTextContent = "Enabled";
  if (startStop == "Disable")   startStopTextContent = "Disabled";
  if (fullLite == "Full")       fullLiteTextContent  = "Full";
  if (fullLite == "Lite")       fullLiteTextContent  = "Lite";
  if (highlight == "block")     highlightTextContent = "Block";
  if (highlight == "highlight") highlightTextContent = "Highlight";
  /* ***** */
  $('highlight-ads-button').textContent = highlightTextContent;
  $('start-stop-button').textContent = startStopTextContent === "Enabled" ? "ON" : "OFF";
  $('full-lite-button').textContent = fullLiteTextContent;
   /* ***** */
  $('highlight-ads-button-td-info').textContent = "Adblock Will " + highlightTextContent + " Ads";
  $('start-stop-button-td-info').textContent = "Adblock is " + startStopTextContent;
  $('full-lite-button-td-info').textContent = fullLiteTextContent + " Mode is Activated";
  /* ***** */
  $('highlight-ads-button').setAttribute("state", highlight);
  $('start-stop-button').setAttribute("state", startStop);
  $('full-lite-button').setAttribute("state", fullLite);
}

function storePopupData() {
  background.send("storePopupData", {
    customRule: JSON.stringify(customRule),
    allowedURLs: JSON.stringify(allowedURLs),
    fullLite: $('full-lite-button').getAttribute("state"),
    tableType: $('website-list-table').getAttribute("type"),
    startStop: $('start-stop-button').getAttribute("state"),
    highlight: $('highlight-ads-button').getAttribute("state")
  });
}

$('start-stop-button').addEventListener("click", function (e) {
  var target = e.target || e.originalTarget;
  background.send('startStop', target.getAttribute("state"));
});

$('full-lite-button').addEventListener("click", function (e) {
  if ($('start-stop-button').getAttribute("state") == "Disable") return;
  var target = e.target || e.originalTarget;
  background.send('fullLite', target.getAttribute("state"));
});

$('highlight-ads-button').addEventListener("click", function (e) {
  if ($('start-stop-button').getAttribute("state") == "Disable") return;
  var target = e.target || e.originalTarget;
  background.send('highlight', target.getAttribute("state"));
});

$('website-list-table').addEventListener("click", function (e) {
  var target = e.target || e.originalTarget;
  if (target.tagName.toLowerCase() == 'td' || target.nodeName.toLowerCase() == 'td') {
    if (target.getAttribute('type') == 'close') {
      if ($('website-list-table').getAttribute("type") == "add") {
        var url = target.parentNode.childNodes[1].textContent;
        allowedURLs = allowedURLs.filter(function (e) {return e != url;});
        storePopupData();
        init();
      }
      if ($('website-list-table').getAttribute("type") == "toggle") {
        var rule = target.parentNode.childNodes[1].textContent;
        customRule = customRule.filter(function (e) {return e != rule;});
        storePopupData();
        init();
      }
    }
  }
});

function addInputFieldItem(e) {
  var value = $('input-field').value;
  var target = e.target || e.originalTarget;
  var id = target.getAttribute("id");
  if (id == "input-field-toggle") {
    var type = $('website-list-table').getAttribute("type");
    if (type == "add") $('website-list-table').setAttribute("type", "toggle");
    else $('website-list-table').setAttribute("type", "add");
    storePopupData();
    popupStart();
    return;
  }

  var type = $('website-list-table').getAttribute("type");
  if (value) {
    if (type == "add") {
      try {
        value = new URL(value).hostname;
        allowedURLs = allowedURLs.filter(function (e) {return e != value;});
        allowedURLs.push(value);
        storePopupData();
        init();
      }
      catch (e) {}
    }
    if (type == "toggle") {
      customRule = customRule.filter(function (e) {return e != value;});
      /* check css rule before storing */
      var style = document.createElement("style");
      var head = document.querySelector("head") || document.head || document.documentElement;
      if (head) head.appendChild(style);
      style.setAttribute("type", "text/css");
      try {
        style.sheet.insertRule(value + "{}", 0);
        head.removeChild(style);
      }
      catch (e) {if (e) return;}
      /* return here on error */
      customRule.push(value);
      storePopupData();
      init();
    }
    $('input-field').value = '';
  }
  else {
    var text = $('input-field').getAttribute('title');
    /* ToDo: alert(text); */
  }
}

$('input-field-toggle').addEventListener("click", addInputFieldItem);
$('input-field-add').addEventListener("click", addInputFieldItem);
$('input-field').addEventListener('keypress', function (e) {
    var key = e.which || e.keyCode;
    if (key == 13) addInputFieldItem(e);
});

background.receive('startStop', function (e) {
  var startStopTextContent = "";
  if (e == "Enable") startStopTextContent = "Enabled";
  if (e == "Disable") startStopTextContent = "Disabled";
  $('start-stop-button').textContent = startStopTextContent === "Enabled" ? "ON" : "OFF";
  $('start-stop-button-td-info').textContent = "Adblock is " + startStopTextContent;
  $('start-stop-button').setAttribute("state", e);
});

background.receive('fullLite', function (e) {
  var fullLiteTextContent = "";
  if (e == "Full") { /* not active for now */
    //alert("Full Mode is Activated! \nPlease note, Full-Mode will target more Ads but may significantly slow-down your browser's speed and responsiveness depending on the available Memory and CPU power.");
  }
  if (e == "Full") fullLiteTextContent = "Full";
  if (e == "Lite") fullLiteTextContent = "Lite";
  $('full-lite-button').textContent = fullLiteTextContent;
  $('full-lite-button-td-info').textContent = fullLiteTextContent + " Mode is Activated";
  $('full-lite-button').setAttribute("state", e);
});

background.receive('highlight', function (e) {
  var highlightTextContent = "";
  if (e == "block") highlightTextContent = "Block";
  if (e == "highlight") highlightTextContent = "Highlight";
  $('highlight-ads-button').textContent = highlightTextContent;
  $('highlight-ads-button-td-info').textContent = "Adblock Will " + highlightTextContent + " Ads";
  $('highlight-ads-button').setAttribute("state", e);
});

var information = "In AdBlock Lite you can allow some websites to show advertisement. By doing this you support websites that rely on advertising but choose to do it in a non-intrusive way. Some websites are added by default, but the above list can be modified at any time.";

$('information-span').textContent = information;

function updateInformation(e) {
  var target = e.target || e.originalTarget;
  var title = target.getAttribute("title");
  if (title) $('information-span').textContent = title;
  else $('information-span').textContent = information;
}

function resetInformation(e) {
  $('information-span').textContent = information;
}

var popupElements =
[
  'input-field',
  'input-field-add',
  'full-lite-button',
  'start-stop-button',
  'input-field-toggle',
  'highlight-ads-button'
];

for (var i = 0; i < popupElements.length; i++) {
  $(popupElements[i]).addEventListener("mouseenter", updateInformation);
  $(popupElements[i]).addEventListener("mouseleave", resetInformation);
}
