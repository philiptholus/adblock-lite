var background = {};
/**** wrapper (start) ****/
if (typeof chrome !== 'undefined') {  // Chrome
  background.send = function (id, data) {
    chrome.extension.sendRequest({method: id, data: data});
  }
  background.receive = function (id, callback) {
    chrome.extension.onRequest.addListener(function(request, sender, callback2) {
      if (request.method == id) {
        callback(request.data);
      }
    });
  }
  window.setTimeout(function () {popupStart();}, 100);
}
else if (typeof safari !== 'undefined') { // Safari
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
    window.setTimeout(function () {popupStart();}, 100);
  }, false);
}
else {  // Firefox
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

var allowedURLs = [], startStop = '', fullLite = '', highlight = '';

function $ (id) {
  return document.getElementById(id);
}

function popupStart() {
  background.receive('popupStart', function (data) {
    fullLite = data.fullLite;
    startStop = data.startStop;
    highlight = data.highlight;
    allowedURLs = data.allowedURLs;
    init();
  });
  background.send('popupStart');
}

function init() {
  var table = $('website-list-table');
  while (table.hasChildNodes()) {
    table.removeChild(table.lastChild);
  }
  var count = 1;
  for (var i = allowedURLs.length - 1; i >= 0; i--) {
    var tr = document.createElement('tr');
    var td1 = document.createElement('td');
    var td2 = document.createElement('td');
    var td3 = document.createElement('td');

    td1.textContent = count;
    td1.setAttribute('type', 'number');
    td2.textContent = allowedURLs[i];
    td2.setAttribute('type', 'url');
    td3.setAttribute('type', 'close');

    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
    table.appendChild(tr);
    count++;
  }
  var fullLiteTextContent = '';
  var highlightTextContent = '';
  var startStopTextContent = ''; 
  /* ***** */
  if (startStop == "Enable") startStopTextContent = "Enabled";
  if (startStop == "Disable") startStopTextContent = "Disabled";
  if (fullLite == "Full") fullLiteTextContent = "Full Mode";
  if (fullLite == "Lite") fullLiteTextContent = "Lite Mode";
  if (highlight == "block") highlightTextContent = "Block Ads";
  if (highlight == "highlight") highlightTextContent = "Highlight Ads";
  /* ***** */
  $('highlight-ads-button').textContent = highlightTextContent;
  $('start-stop-button').textContent = startStopTextContent;
  $('full-lite-button').textContent = fullLiteTextContent;
   /* ***** */
  $('highlight-ads-button-td-info').textContent = "Adblock Will " + highlightTextContent;
  $('start-stop-button-td-info').textContent = "Adblock is " + startStopTextContent;
  $('full-lite-button-td-info').textContent = fullLiteTextContent + " is Activated";
  /* ***** */
  $('highlight-ads-button').setAttribute("state", highlight);
  $('start-stop-button').setAttribute("state", startStop);
  $('full-lite-button').setAttribute("state", fullLite);
}

function storePopupData() {
  background.send("storePopupData", {
    allowedURLs: JSON.stringify(allowedURLs),
    fullLite: $('full-lite-button').getAttribute("state"),
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
      var url = target.parentNode.childNodes[1].textContent;
      allowedURLs = allowedURLs.filter(function (e) {
        return e != url;
      });
      storePopupData();
      init();
    }
  }
});

function addUrlItem() {
  var value = $('input-field').value;
  if (value) {
    allowedURLs = allowedURLs.filter(function (e) {
      return e != value;
    });
    allowedURLs.push(value);
    storePopupData();
    init();
  }
  else {
    var text = $('input-field').getAttribute('title');
    /* alert(text); */
  }
}

$('input-field-add').addEventListener("click", addUrlItem);
$('input-field').addEventListener('keypress', function (e) {
    var key = e.which || e.keyCode;
    if (key == 13) addUrlItem();
});

background.receive('startStop', function (e) {
  var startStopTextContent = "";
  if (e == "Enable") startStopTextContent = "Enabled";
  if (e == "Disable") startStopTextContent = "Disabled";
  $('start-stop-button').textContent = startStopTextContent;
  $('start-stop-button-td-info').textContent = "Adblock is " + startStopTextContent;
  $('start-stop-button').setAttribute("state", e);
});

background.receive('fullLite', function (e) {
  var fullLiteTextContent = "";
  if (e == "Full") {
    alert("Full Mode is Activated! \nPlease note, Full-Mode will target more Ads but may significantly slow-down your browser's speed and responsiveness depending on the available Memory and CPU power.");
  }
  if (e == "Full") fullLiteTextContent = "Full Mode";
  if (e == "Lite") fullLiteTextContent = "Lite Mode";
  $('full-lite-button').textContent = fullLiteTextContent;
  $('full-lite-button-td-info').textContent = fullLiteTextContent + " is Activated";
  $('full-lite-button').setAttribute("state", e);
});

background.receive('highlight', function (e) {
  var highlightTextContent = "";
  if (e == "block") highlightTextContent = "Block Ads";
  if (e == "highlight") highlightTextContent = "Highlight Ads";
  $('highlight-ads-button').textContent = highlightTextContent;
  $('highlight-ads-button-td-info').textContent = "Adblock Will " + highlightTextContent;
  $('highlight-ads-button').setAttribute("state", e);
});

var information = "In AdBlock-Lite you can allow some websites to show advertisement. By doing this you support websites that rely on advertising but choose to do it in a non-intrusive way. Some websites are added by default, but the above list can be modified at any time.";
$('information-span').textContent = information;

document.addEventListener("mouseover", function (e) {
  var target = e.target || e.originalTarget;
  var title = target.getAttribute("title");
  if (title) $('information-span').textContent = title;
  else $('information-span').textContent = information;
});