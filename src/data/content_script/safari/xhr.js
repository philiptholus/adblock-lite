var _this_ADBLOCKLITE = [];

XMLHttpRequest.prototype.overwrittenSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.overwrittenOpen = XMLHttpRequest.prototype.open;

XMLHttpRequest.prototype.open = function (method, url) {
  this._xhr_saved_url = url;
  this.overwrittenOpen.apply(this, arguments);
};

XMLHttpRequest.prototype.send = function (data) {
  var index = _this_ADBLOCKLITE.push({_this: this, _arguments: arguments}) - 1;
  window.postMessage({
    path: "xhr-to-content-script",
    url: this._xhr_saved_url,
    index: index
  }, "*");
};

window.addEventListener("message", function (e) {
  if (e.data && e.data.path === "content-script-to-xhr") {
    if (e.data.method === "allow") {
      var _this = _this_ADBLOCKLITE[e.data.index]._this;
      var _arguments = _this_ADBLOCKLITE[e.data.index]._arguments;
      _this.overwrittenSend.apply(_this, _arguments);
    }
    _this_ADBLOCKLITE[e.data.index] = null;
  }
}, false);
