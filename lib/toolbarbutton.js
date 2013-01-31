'use strict';

const { unload } = require("unload+");
const { listen } = require("listen");
const winUtils = require("sdk/deprecated/window-utils");

const browserURL = "chrome://browser/content/browser.xul";
const NS_XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

exports.ToolbarButton = function ToolbarButton(options) {
  var unloaders = [],
      toolbarID = "",
      insertbefore = "",
      destroyed = false,
      destoryFuncs = [],
      buttonClose = false,
      panelOpening = false;

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
      if (options.image) tbb.setAttribute("image", options.image);
      tbb.setAttribute("class", "toolbarbutton-1 chromeclass-toolbar-additional");
      tbb.setAttribute("label", options.label);
      tbb.setAttribute('tooltiptext', options.tooltiptext);
      if(options.panel) {
        tbb.setAttribute("type","checkbox");
        options.panel.on("hide",function() {
            // uncheck the button if the panel was closed without the button being clicked
            if(!buttonClose)
                tbb.checked = false;
        });
        /*
            The command and mousedown event listeners wont work for this, because
            the hide event for the panel is sent when the button is pressed (mousedown).
            This is because the panel closes, as soon as it loses focus.
            This solution works most of the time, there are issues when the button is clicked too fast.
        */
        options.panel.on("show",function() {
            // Stop registering the mouseleave event; panel is now open
            // issue: leaving while panel is open
            panelOpening = false;
        });
        tbb.addEventListener("mouseover", function() {
            buttonClose = true;
        }, true);
        tbb.addEventListener("mouseleave", function() {
            if(!panelOpening)
                buttonClose = false;
        }, true);
      }
      tbb.addEventListener("command", function() {
        if (options.onCommand)
          options.onCommand({}); // TODO: provide something?

        if (options.panel) {
          if(tbb.hasAttribute("checked")) {
            options.panel.show(tbb);
            panelOpening = true;
          }
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
      }

      var saveTBNodeInfo = function(e) {
        toolbarID = tbb.parentNode.getAttribute("id") || "";
        insertbefore = (tbb.nextSibling || "")
            && tbb.nextSibling.getAttribute("id").replace(/^wrapper-/i, "");
      };

      window.addEventListener("aftercustomization", saveTBNodeInfo, false);

      // add unloader to unload+'s queue
      var unloadFunc = function() {
        tbb.parentNode.removeChild(tbb);
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
      toolbarID = pos.toolbarID;
      insertbefore = pos.insertbefore;

      // change the current position for open windows
      for each (var window in winUtils.windowIterator()) {
        if (browserURL != window.location) continue;

        let doc = window.document;
        let $ = function (id) doc.getElementById(id);

        // if the move isn't being forced and it is already in the window, abort
        if (!pos.forceMove && $(options.id)) continue;

        var tb = $(toolbarID);
        var b4 = $(insertbefore);

        // TODO: if b4 dne, but insertbefore is in currentset, then find toolbar to right

        if (tb) tb.insertItem(options.id, b4, null, false);
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
  };
};

function getToolbarButtons(callback, id) {
  let buttons = [];
  for each (var window in winUtils.windowIterator()) {
    if (browserURL != window.location) continue;
    let tbb = window.document.getElementById(id);
    if (tbb) buttons.push(tbb);
  }
  if (callback) buttons.forEach(callback);
  return buttons;
}

function toolbarbuttonExists(doc, id) {
  var toolbars = doc.getElementsByTagNameNS(NS_XUL, "toolbar");
  for (var i = toolbars.length - 1; ~i; i--) {
    if ((new RegExp("(?:^|,)" + id + "(?:,|$)")).test(toolbars[i].getAttribute("currentset")))
      return toolbars[i];
  }
  return false;
}
