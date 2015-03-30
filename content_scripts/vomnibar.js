"use strict";
// Generated by CoffeeScript 1.8.0
var Vomnibar = {
  vomnibarUI: null,
  defaultRefreshInterval: 500,
  background: null,
  activateWithCompleter: function(completerName, selectFirstResult, forceNewTab, initialQueryValue) {
    var bg = this.background, completer = bg.Completer, vomnibarUI = this.vomnibarUI;
    if (completer.init) {
      completer.init(bg);
    }
    completer.setName(completerName);
    bg.showRelevancy = (settings.values.showOmniRelevancy === true);
    if (vomnibarUI.init) {
      vomnibarUI.init(bg, completer);
    }
    vomnibarUI.initialSelectionValue = selectFirstResult ? 0 : -1;
    vomnibarUI.refreshInterval = this.defaultRefreshInterval || 250;
    vomnibarUI.forceNewTab = forceNewTab ? true : false;
    if (initialQueryValue !== true) {
      vomnibarUI.reset(initialQueryValue);
      return;
    }
    mainPort.postMessage({
      handler: "parseSearchUrl",
      url: window.location.href
    }, function(url) {
      url = url || Utils.decodeURL(window.location.href);
      Vomnibar.vomnibarUI.reset(url);
    });
  },
  activate: function() {
    this.activateWithCompleter("omni");
  },
  activateInNewTab: function() {
    this.activateWithCompleter("omni", false, true);
  },
  activateTabSelection: function() {
    this.activateWithCompleter("tabs", true);
  },
  activateBookmarks: function() {
    this.activateWithCompleter("bookmarks", true);
  },
  activateBookmarksInNewTab: function() {
    this.activateWithCompleter("bookmarks", true, true);
  },
  activateHistory: function() {
    this.activateWithCompleter("history", true);
  },
  activateHistoryInNewTab: function() {
    this.activateWithCompleter("history", true, true);
  },
  activateEditUrl: function() {
    this.activateWithCompleter("omni", false, false, true);
  },
  activateEditUrlInNewTab: function() {
    this.activateWithCompleter("omni", false, true, true);
  },
  getUI: function() {
    return this.vomnibarUI;
  },
  destroy: function() {
    if (this._uiInited) {
      this.vomnibarUI.hide();
      DomUtils.removeNode(this.vomnibarUI.box);
    }
    Vomnibar = null;
  }
};

Vomnibar.vomnibarUI = {
  box: null,
  cleanCompletions: null,
  completer: null,
  completionInput: {
    url: "",
    text: "",
    type: "input",
    action: "navigateToUrl"
  },
  list: null,
  completions: null,
  forceNewTab: false,
  handlerId: 0,
  initialSelectionValue: -1,
  input: null,
  focused: true,
  isSelectionChanged: false,
  onUpdate: null,
  openInNewTab: false,
  performAction: null,
  refreshInterval: 0,
  renderItems: null,
  selection: -1,
  timer: 0,
  _waitInit: 1,
  show: function() {
    this.box.style.display = "";
    this.input.value = this.completionInput.text;
    this.input.focus();
    this.focused = true;
    this.input.addEventListener("input", this.onInput);
    this.box.addEventListener("click", this.onClick);
    this.box.addEventListener("mousewheel", DomUtils.suppressPropagation);
    this.box.addEventListener("keyup", this.onKeyEvent);
    this.handlerId = handlerStack.push({
      keydown: this.onKeydown,
      _this: this
    });
  },
  hide: function() {
    if (this.timer > 0) {
      window.clearTimeout(this.timer);
      this.timer = 0;
    }
    this.box.style.display = "none";
    this.input.blur();
    this.list.innerHTML = "";
    handlerStack.remove(this.handlerId);
    this.handlerId = 0;
    this.input.removeEventListener("input", this.onInput);
    this.list.removeEventListener("click", this.onClick);
    this.box.removeEventListener("mousewheel", DomUtils.suppressPropagation);
    this.box.removeEventListener("keyup", this.onKeyEvent);
    this.onUpdate = null;
    this.completions = [];
  },
  reset: function(input) {
    input = input ? input.trimLeft() : "";
    this.completionInput.text = input;
    this.completionInput.url = input.trimRight();
    this.update(0, this.show);
  },
  update: function(updateDelay, callback) {
    this.onUpdate = callback;
    if (typeof updateDelay === "number") {
      if (this.timer > 0) {
        window.clearTimeout(this.timer);
        this.timer = 0;
      }
      if (updateDelay <= 0) {
        this.onTimer();
        return;
      }
    } else if (this.timer) {
      return;
    } else {
      updateDelay = this.refreshInterval;
    }
    this.timer = setTimeout(this.onTimer, updateDelay);
  },
  populateUI: function() {
    this.list.innerHTML = this.renderItems(this.completions);
    this.cleanCompletions(this.completions);
    if (this.completions.length > 0) {
      this.list.style.display = "";
      this.inputBar.classList.add("vimOWithList");
      this.selection = (this.completions[0].type === "search") ? 0 : this.initialSelectionValue;
    } else {
      this.list.style.display = "none";
      this.inputBar.classList.remove("vimOWithList");
      this.selection = -1;
    }
    this.isSelectionChanged = false;
    this.updateSelection();
  },
  updateInput: function() {
    if (this.selection === -1) {
      this.input.focus();
      this.input.value = this.completionInput.text;
    } else {
      if (!this.focused) this.input.blur();
      var ref = this.completions[this.selection];
      if (!ref.text) {
        ref.text = ref.url.startsWith("javascript:") ? ref.url : Utils.decodeURL(ref.url);
      }
      this.input.value = ref.text;
    }
  },
  updateSelection: function() {
    for (var _i = 0, _ref = this.list.children, selected = this.selection; _i < _ref.length; ++_i) {
      (_i != selected) && _ref[_i].classList.remove("vimS");
    }
    if (selected >= 0 && selected < _ref.length) {
      _ref = _ref[selected];
      _ref.classList.add("vimS");
      _ref.scrollIntoViewIfNeeded();
    }
  },
  onKeydown: function(event) {
    var action, n = event.keyCode;
    if (n === keyCodes.enter) {
      this.openInNewTab = this.forceNewTab || event.shiftKey || event.ctrlKey || event.metaKey;
      action = "enter";
    } else if ((action = KeyboardUtils.getKeyChar(event)) === "up" //
        || (event.shiftKey && n === keyCodes.tab) //
        || (event[keyCodes.modifier] && (action === "k" || action === "p"))) {
      action = "up";
    } else if (action === "down" || (n === keyCodes.tab && !event.shiftKey) //
        || (event[keyCodes.modifier] && (action === "j" || action === "n"))) {
      action = "down";
    } else if (n == keyCodes.left || n == keyCodes.right) {
      return true;
    } else if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
      return true;
    } else if (n === keyCodes.esc) {
      action = "dismiss";
    } else if (n === keyCodes.f1) {
      action = (document.activeElement !== this.input) ? "focus" : "backspace";
    } else if (n === keyCodes.f1 + 1) {
      action = (document.activeElement !== this.input) ? "focus" : "blur";
    } else {
      action = "";
      n = this.selection >= 0 && this.isSelectionChanged ? 1 : 0;
      if (event.keyCode === 32) {
        if ((n === 1 || this.completions.length <= 1) && document.activeElement === this.input //
            && this.input.value.endsWith("  ")) {
          this.openInNewTab = this.forceNewTab;
          action = "enter";
        } else if (document.activeElement !== this.input) {
          action = "focus";
        }
      }
      else if (n === 1 || document.activeElement !== this.input) {
        n = event.keyCode - 48;
        if (n === 0) { n = 10; }
        if (n > 0 && n <= this.completions.length) {
          this.selection = n - 1;
          this.isSelectionChanged = true;
          this.openInNewTab = this.forceNewTab;
          action = "enter";
        }
      }
      if (!action) {
        return true;
      }
    }
    this.onAction(action);
    return false;
  },
  onAction: function(action) {
    switch(action) {
    case "dismiss": this.hide(); break;
    case "focus": this.focused = true; this.input.focus(); break;
    case "blur": this.focused = false; this.input.blur(); break;
    case "backspace": DomUtils.simulateBackspace(this.input); break;
    case "up":
      this.isSelectionChanged = true;
      if (this.selection < 0) this.selection = this.completions.length;
      this.selection -= 1;
      this.updateInput();
      this.updateSelection();
      break;
    case "down":
      this.isSelectionChanged = true;
      this.selection += 1;
      if (this.selection >= this.completions.length) this.selection = -1;
      this.updateInput(); 
      this.updateSelection();
      break;
    case "enter":
      if (this.timer) {
        if (this.timer && (this.selection === -1 || !this.isSelectionChanged)) {
          this.update(0, this.onEnter);
        }
      } else if (this.selection >= 0 || this.input.value.trim().length > 0) {
        this.onEnter();
      }
      break;
    default: break;
    }
  },
  onEnter: function() {
    var i = this.selection, ref = this.list.children;
    if (i >= 0 && i < ref.length) {
      i = + ref[this.selection].getAttribute("data-vim-index");
      if (!(i >= 0 && i < this.completions.length)) {
        return;
      }
    } else {
      i = -1;
    }
    this.performAction(i >= 0 ? this.completions[i] : this.completionInput, this.openInNewTab);
    this.hide();
  },
  onClick: function(event) {
    var el = event.target, _i;
    if (el === this.inputBar) {
      this.onAction("focus");
    } else if (el === this.input) {
      this.focused = true;
    } else if (el === this.list || this.timer) {
    } else if (document.getSelection().type !== "Range") {
      var ind = [].indexOf;
      _i = ind.call(event.path, this.list);
      _i = _i > 0 ? ind.call(this.list.children, event.path[_i - 1]) : -1;
      if (_i >= 0) {
        this.selection = _i;
        this.isSelectionChanged = true;
        this.openInNewTab = this.forceNewTab || (event.shiftKey || event.ctrlKey || event.metaKey);
        this.onAction("enter");
      }
    }
    DomUtils.suppressEvent(event);
  },
  onInput: function() {
    var str = this.input.value.trimLeft();
    this.completionInput.text = str;
    str = str.trimRight();
    if ((this.selection === -1 ? this.completionInput.url : this.completions[this.selection].text) !== str) {
      this.update();
      this.completionInput.url = str;
    }
    return false;
  },
  onTimer: function() {
    this.timer = -1;
    this.completer.filter(this.completionInput.url, this.onCompletions);
  },
  onCompletions: function(completions) {
    if (this._waitInit) {
      this.completions = completions;
      return;
    }
    var func = function(completions) {
      this.completions = completions;
      this.populateUI();
      this.timer = 0;
      if (this.onUpdate) {
        var onUpdate = this.onUpdate;
        this.onUpdate = null;
        onUpdate.call(this);
      }
    };
    this.onCompletions = func = func.bind(this);
    func(completions);
  },
  onKeyEvent: function(event) {
    var key = event.keyCode;
    if (event.altKey || (key >= keyCodes.f1 + 2 && key <= keyCodes.f12)) {
      return;
    }
    else if (key == keyCodes.left || key == keyCodes.right) {
    }
    else if (event.ctrlKey || event.metaKey || (event.shiftKey && !event.keyIdentifier.startsWith("U+"))) {
      return;
    }
    DomUtils.suppressEvent(event);
  },
  init: function(background, completer) {
    this.box = document.createElement("div");
    this.box.className = "vimB vimR";
    this.box.id = "vimOmnibar";
    this.box.style.display = "none";
    document.documentElement.appendChild(this.box);
    mainPort.postMessage({
      handler: "initVomnibar"
    }, this.init_dom.bind(this));
    this.completer = completer;
    this.performAction = background.performAction.bind(background);
    this.cleanCompletions = background.cleanCompletions.bind(background);
    this.onInput = this.onInput.bind(this);
    this.onClick = this.onClick.bind(this);
    this.onTimer = this.onTimer.bind(this);
    this.onCompletions = this.onCompletions.bind(this);
    this.onKeyEvent = this.onKeyEvent.bind(this);
    this.init = null;
  },
  init_dom: function(html) {
    this.box.innerHTML = html;
    this.inputBar = this.box.querySelector("#vimOInputBar");
    this.input = this.box.querySelector("#vimOInput");
    this.list = this.box.querySelector("#vimOList");
    var str = this.box.querySelector("#vimOITemplate").innerHTML;
    str = str.substring(str.indexOf('>') + 1, str.lastIndexOf('<'));
    this.renderItems = Utils.makeListRenderBySplit(str);
    this._waitInit = 0;
    this.init_dom = null;
    if (this.completions) {
      this.onCompletions(this.completions);
    }
  },
  computeHint: function(li) {
    var i = +li.getAttribute("data-vim-index"), a, item, rect;
    if (!(i >= 0 && i < this.completions.length)) { return null; }
    a = li.querySelector(".vimOIUrl");
    if (!a.getAttribute("data-vim-url")) {
      item = this.completions[i];
      a.setAttribute("data-vim-text", item.title);
      a.setAttribute("data-vim-url", item.url);
    }
    rect = VRect.copy(li.querySelector(".vimOIWrap").getBoundingClientRect());
    rect[2] -= 2, rect[3] -= 2;
    return rect;
  }
};

Vomnibar.background = {
  Completer: {
    name: "",
    _refreshed: [],
    init: function(background) {
      this._refreshed = [];
      this.onFilter = this.onFilter.bind(this);
      this.mapResult = background.resolve.bind(background);
      this.background = background;
      this.init = null;
    },
    setName: function(name) {
      this.name = name;
      if (this._refreshed.indexOf(name) < 0) {
        this._refreshed.push(name);
        this.refresh();
      }
    },
    refresh: function() {
      mainPort.postMessage({
        handler: "refreshCompleter",
        omni: this.name
      });
    },
    filter: function(query, callback) {
      this._callback = callback;
      this._id = mainPort.postMessage({
        handlerOmni: this.name,
        query: query && query.trim().replace(this.whiteSpaceRegex, ' ')
      }, this.onFilter);
    },
    whiteSpaceRegex: /\s+/g,
    _id: 0,
    _callback: null,
    background: null,
    mapResult: null,
    onFilter: function(results, msgId) {
      if (!msgId || this._id != msgId) { return; }
      var callback = this._callback;
      this._callback = null;
      if (callback) {
        this.background.maxCharNum = Math.floor((window.innerWidth * 0.8 - 70) / 7.72);
        callback(msgId > 0 ? results.map(this.mapResult) : []);
      }
    }
  },

  showRelevancy: false,
  maxCharNum: 160,
  showFavIcon: window.location.protocol.startsWith("chrome"),
  resolve: function(result) {
    this.prepareToRender(result);
    result.action = (result.type === "tab") ? "switchToTab"
      : ("sessionId" in result) ? "restoreSession"
      : "navigateToUrl";
    return result;
  },
  highlightTerms: function(string, ranges) {
    var _i, out, start, end;
    if (ranges.length === 0) {
      return Utils.escapeHtml(string);
    }
    out = [];
    for(_i = 0, end = 0; _i < ranges.length; _i += 2) {
      start = ranges[_i];
      out.push(Utils.escapeHtml(string.substring(end, start)));
      end = ranges[_i + 1];
      out.push("<span class=\"vimB vimI vimOmniS\">");
      out.push(Utils.escapeHtml(string.substring(start, end)));
      out.push("</span>");
    }
    out.push(Utils.escapeHtml(string.substring(end)));
    return out.join("");
  },
  cutUrl: function(string, ranges, strCoded) {
    if (ranges.length === 0 || string.startsWith("javascript:")) {
      if (string.length <= this.maxCharNum) {
        return Utils.escapeHtml(string);
      } else {
        return Utils.escapeHtml(string.substring(0, this.maxCharNum - 3)) + "...";
      }
    }
    var out = [], cutStart = -1, temp, lenCut, i, end, start;
    if (! (string.length <= this.maxCharNum)) {
      cutStart = strCoded.indexOf("://");
      if (cutStart >= 0) {
        cutStart = strCoded.indexOf("/", cutStart + 4);
        if (cutStart >= 0) {
          temp = string.indexOf("://");
          cutStart = string.indexOf("/", (temp < 0 || temp > cutStart) ? 0 : (temp + 4));
        }
      }
    }
    cutStart = (cutStart < 0) ? string.length : (cutStart + 1);
    for(i = 0, lenCut = 0, end = 0; i < ranges.length; i += 2) {
      start = ranges[i];
      temp = (end >= cutStart) ? end : cutStart;
      if (temp + 20 > start) {
        out.push(Utils.escapeHtml(string.substring(end, start)));
      } else {
        out.push(Utils.escapeHtml(string.substring(end, temp + 10)));
        out.push("...");
        out.push(Utils.escapeHtml(string.substring(start - 6, start)));
        lenCut += start - temp - 19;
      }
      end = ranges[i + 1];
      out.push("<span class=\"vimB vimI vimOmniS\">");
      out.push(Utils.escapeHtml(string.substring(start, end)));
      out.push("</span>");
    }
    temp = this.maxCharNum + lenCut;
    if (! (string.length > temp)) {
      out.push(Utils.escapeHtml(string.substring(end)));
    } else {
      out.push(Utils.escapeHtml(string.substring(end,
        (temp - 3 > end) ? (temp - 3) : (end + 10))));
      out.push("...");
    }
    return out.join("");
  },
  prepareToRender: function(item) {
    item.textSplit = this.cutUrl(item.text, item.textSplit, item.url);
    item.titleSplit = this.highlightTerms(item.title, item.titleSplit);
     if (this.showFavIcon && item.url.indexOf("://") >= 0) {
      item.favIconUrl = " vimOIIcon\" style=\"background-image: url(" + (item.favIconUrl ||
        ("chrome://favicon/size/16/" + item.url)) + ")";
    } else {
      item.favIconUrl = "";
    }
    if (this.showRelevancy) {
      item.relevancy = "\n\t\t\t<span class=\"vimB vimI vimOIRelevancy\">" + item.relevancy + "</span>";
    } else {
      item.relevancy = "";
    }
  },
  cleanCompletions: function(list) {
    for (var _i = list.length, item; 0 <= --_i; ) {
      item = list[_i];
      delete item.textSplit;
      delete item.titleSplit;
      delete item.favIconUrl;
      delete item.relevancy;
      item.text = "";
    }
  },
  performAction: function(item, arg) {
    var action = this.completionActions[item.action] || item.action;
    if (typeof action !== "function") return;
    return action.call(item, arg);
  },
  completionActions: {
    navigateToUrl: function(openInNewTab) {
      if (this.url.startsWith("javascript:")) {
        var script = document.createElement('script');
        script.textContent = this.url.substring(11);
        (document.documentElement || document.body || document.head).appendChild(script);
      } else {
        mainPort.postMessage({
          handler: openInNewTab ? "openUrlInNewTab" : "openUrlInCurrentTab",
          url: this.url
        });
      }
    },
    switchToTab: function() {
      mainPort.postMessage({
        handler: "selectSpecificTab",
        sessionId: this.sessionId
      });
    },
    restoreSession: function() {
      mainPort.postMessage({
        handler: "restoreSession",
        sessionId: this.sessionId,
      });
    }
  }
};
