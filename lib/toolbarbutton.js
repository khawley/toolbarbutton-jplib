'use strict';

const { unload } = require("unload+");
const { listen } = require("listen");
const winUtils = require("sdk/deprecated/window-utils");
const newWinUtils = require("sdk/window/utils");
const windows = require("sdk/windows").browserWindows;
//const persist = require("persist");
const TBBLibraryPref = "extensions.toolbarButtonLibrary.";

const browserURL = "chrome://browser/content/browser.xul";
const NS_XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

exports.ToolbarButton = function ToolbarButton(options) {
  var unloaders = [],
//      tbb,
      toolbarID = "",
      insertbefore = "",
      destroyed = false,
      destoryFuncs = [];
//      persist.init(TBBLibraryPref);

  var delegate = {
    onTrack: function (window) {
      if (browserURL != window.location || destroyed)
        return;

      let doc = window.document;
      let $ = function(id) doc.getElementById(id);

      options.tooltiptext = options.tooltiptext || '';

      // create toolbar button
      let tbb = doc.createElementNS(NS_XUL, "toolbarbutton");
      tbb.setAttribute("id", options.id);
      tbb.setAttribute("type", "button");
      if (options.image) tbb.setAttribute("image", options.image);
      tbb.setAttribute("class", "toolbarbutton-1 chromeclass-toolbar-additional");
      tbb.setAttribute("label", options.label);
      tbb.setAttribute('tooltiptext', options.tooltiptext);
      if(options.panel)
        options.panel.on("hide",_onPanelHide);

      tbb.addEventListener("command", function() {
        if (options.onCommand)
          options.onCommand({}); // TODO: provide something?

        if (options.panel) {
          options.panel.show(null, tbb);
        }
      }, true);

      // add toolbarbutton to palette
      ($("navigator-toolbox") || $("mail-toolbox")).palette.appendChild(tbb);

      // find a toolbar to insert the toolbarbutton into
      if (toolbarID) {
        var tb = $(toolbarID);
      }
      if (!tb) {
        var tb = toolbarbuttonExists(doc, options.id);
      }

      // found a toolbar to use?
      if (tb) {
        let b4;

        // find the toolbarbutton to insert before
        if (insertbefore) {
          b4 = $(insertbefore);
        }

        if (!b4) {
          let currentset = tb.getAttribute("currentset").split(",");
          let i = currentset.indexOf(options.id) + 1;

          // was the toolbarbutton id found in the curent set?
          if (i > 0) {
            let len = currentset.length;
            // find a toolbarbutton to the right which actually exists
            for (; i < len; i++) {
              b4 = $(currentset[i]);
              if (b4) break;
            }
          }
        }

        tb.insertItem(options.id, b4, null, false);
        tb.setAttribute("currentset", tb.currentSet);
//        persist.update(tb.id + ".currentSet", tb.currentSet);
      }

      var saveTBNodeInfo = function(e) {
          console.debug("*** TBB - aftercustomization fired");
          var doc = newWinUtils.getMostRecentBrowserWindow().document;
        var newToolbarID = tbb.parentNode.getAttribute("id") || "";
        var newInsertbefore = (tbb.nextSibling || "")
            && tbb.nextSibling.getAttribute("id").replace(/^wrapper-/i, "");
        console.debug("*** TBB.saveTBNodeInfo newToolbarID: "+newToolbarID+" & newInsertbefore: "+newInsertbefore);

        if(newToolbarID != toolbarID){
            // If moved to different toolbar, update old toolbar to NOT include the button
            $(toolbarID).setAttribute("currentset", $(toolbarID).currentSet);
//            persist.update(toolbarID+".currentset", $(toolbarID).currentSet);
            doc.persist(toolbarID, "currentset");
            toolbarID = newToolbarID;
            insertbefore = newInsertbefore;
        }
        if (!tb) {
          var tb = (tbb.parentElement.id !== "BrowserToolbarPalette") ? tbb.parentElement : null;
        }
        if (tb) {
            console.debug("** TBB - aftercustomization saveTBNodeInfo for "+tb.id+" currentset: "+ tb.currentSet);
          tb.setAttribute("currentset", tb.currentSet);
//          persist.update(tb.id + ".currentset", tb.currentSet);
        } else {
        // move to toolbox/pallette because not in toolbar
            ($("navigator-toolbox") || $("mail-toolbox")).palette.appendChild(tbb);
        }
      };

      window.addEventListener("aftercustomization", saveTBNodeInfo, false);

      // add unloader to unload+'s queue
      var unloadFunc = function() {
        getToolbarButtons(function(tbb) {
          tbb.parentNode.removeChild(tbb);
        }, options.id);
        window.removeEventListener("aftercustomization", saveTBNodeInfo, false);
      };
      var index = destoryFuncs.push(unloadFunc) - 1;
      listen(window, window, "unload", function() {
        destoryFuncs[index] = null;
      }, false);
      unloaders.push(unload(unloadFunc, window));
    },
    onUntrack: function (window) {}
  };
  var tracker = winUtils.WindowTracker(delegate);

  function setIcon(aOptions) {
    options.image = aOptions.image || aOptions.url;
    getToolbarButtons(function(tbb) {
      tbb.image = options.image;
    }, options.id);
    return options.image;
  }

  function _onPanelHide() {
//    var tbb = document.getElementById(options.id);
    getToolbarButtons(function(tbb) {
      tbb.checked = false;
      if(tbb.mozMatchesSelector("toolbarbutton:hover"))
        tbb.checkState = 2;
    }, options.id)
  }

  return {
    destroy: function() {
      if (destroyed) return;
      destroyed = true;

      if (options.panel)
        options.panel.destroy();

      // run unload functions
      destoryFuncs.forEach(function(f) f && f());
      destoryFuncs.length = 0;

      // remove unload functions from unload+'s queue
      unloaders.forEach(function(f) f());
      unloaders.length = 0;
    },
    moveTo: function(pos) {
      if (destroyed) return;

      // record the new position for future windows
      if(pos.toolbarID) toolbarID = pos.toolbarID;
      insertbefore = pos.insertbefore;

      // change the current position for open windows
      for each (var window in newWinUtils.windows()){
//      for each (var window in winUtils.windowIterator()) {
//        if (browserURL != window.location) continue;

        let doc = window.document;
        let $ = function (id) doc.getElementById(id);

        // if the move isn't being forced and it is already in the window, abort
        if (!pos.forceMove && $(options.id)) continue;

        var tb = $(toolbarID);
        var b4 = $(insertbefore);

        // TODO: if b4 dne, but insertbefore is in currentset, then find toolbar to right

        if (tb) {
          tb.insertItem(options.id, b4, null, false);
          tb.setAttribute("currentset", tb.currentSet);
            doc.persist(tb.id, "currentset");
//          persist.update(tb.id + ".currentset", tb.currentSet);
        }
      };
    },
    get label() options.label,
    set label(value) {
      options.label = value;
      getToolbarButtons(function(tbb) {
        tbb.label = value;
      }, options.id);
      return value;
    },
    setIcon: setIcon,
    get image() options.image,
    set image(value) setIcon({image: value}),
    get tooltiptext() options.tooltiptext,
    set tooltiptext(value) {
      options.tooltiptext = value;
      getToolbarButtons(function(tbb) {
        tbb.setAttribute('tooltiptext', value);
      }, options.id);
    },
    get panel() options.panel,
    set panel(value) {
        if(options.panel) {
            options.panel.removeListener("hide",_onPanelHide);

            if(options.panel.isShowing)
                options.panel.hide();
        }
            
        options.panel = value;
        if(options.panel) {
            options.panel.on("hide",_onPanelHide);
        }
    }
  };
};

function getToolbarButtons(callback, id) {
  let buttons = [];
  for each (var window in newWinUtils.windows()){
//  for each (var window in winUtils.windowIterator()) {
//    if (browserURL != window.location) continue;
    let tbb = window.document.getElementById(id);
    if (tbb) buttons.push(tbb);
  }
  if (callback) buttons.forEach(callback);
  return buttons;
}

function toolbarbuttonExists(doc, id) {
  var toolbars = doc.getElementsByTagNameNS(NS_XUL, "toolbar");
    var tb_str = "";
  for (var i = toolbars.length - 1; ~i; i--) {
    tb_str+=toolbars[i].id+", ";
    if ((new RegExp("(?:^|,)" + id + "(?:,|$)")).test(toolbars[i].getAttribute("currentset")))
      return toolbars[i];
  }
    console.debug("** tbb - toolbarbuttonExists: toolbars - "+tb_str);

  return false;
}
