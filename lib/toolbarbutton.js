'use strict';

const { unload } = require("unload+");
const { listen } = require("listen");
const winUtils = require("sdk/deprecated/window-utils");
const newWinUtils = require("sdk/window/utils");
const windows = require("sdk/windows").browserWindows;
const prefs = require("sdk/preferences/service");
const TBBLibraryPref = "extensions.toolbarButtonLibrary.";

const browserURL = "chrome://browser/content/browser.xul";
const NS_XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

exports.ToolbarButton = function ToolbarButton(options) {
  var unloaders = [],
//      tbb,
      toolbarID = "",
      insertBeforeID = "",
      destroyed = false,
      destoryFuncs = [];

    function createButtonDOM(doc){
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
        return tbb;
    }
    function saveButtonToAllWindows(){
        if (destroyed)
            return;
        // insert into all current windows
        for each (var window in newWinUtils.windows()){
            saveButtonToWindow(window);
        }
        // insert into newly opened windows
        windows.on("open", function(window){
            console.debug("*** TBB.saveButtonToAllWindows window.open fired");
            saveButtonToWindow(newWinUtils.getMostRecentBrowserWindow());
        });
    }
    function saveButtonToWindow(window){
        let doc = window.document;
        let $ = function(id) doc.getElementById(id);

        // see if toolbar already has button assigned to it then if not, try the toolbarID
        var toolbarElem = toolbarbuttonExists(doc, options.id);
        if(!toolbarElem) toolbarElem = $(toolbarID);
        if (toolbarElem) {
            var buttonElem = $(options.id) || createButtonDOM(doc);
            // must add to pallete in order to have access to it
            console.debug("*** TBB.saveButtonToWindow - button added to palette");
            ($("navigator-toolbox") || $("mail-toolbox")).palette.appendChild(buttonElem);

            let insertBeforeElem;
            if (insertBeforeID)
                insertBeforeElem = $(insertBeforeID);
            if (!insertBeforeElem ) {
                insertBeforeID = getInsertBeforeID(doc, toolbarID, options.id);
                insertBeforeElem = $(insertBeforeID);
            }
            toolbarID =toolbarElem.id;
            toolbarElem.insertItem(options.id, insertBeforeElem, null, false);
            toolbarElem.setAttribute("currentset", toolbarElem.currentSet);
            doc.persist(toolbarElem.id, "currentset");
        }

        window.addEventListener("aftercustomization", afterCustomization, false);

        // add unloader to unload+'s queue
        var unloadFunc = function() {
            getToolbarButtons(function(tbb) {
                tbb.parentNode.removeChild(tbb);
            }, options.id);
            window.removeEventListener("aftercustomization", afterCustomization, false);
        };
        var index = destoryFuncs.push(unloadFunc) - 1;
        listen(window, window, "unload", function() {
            destoryFuncs[index] = null;
        }, false);
        unloaders.push(unload(unloadFunc, window));
    }
    function clearPersistOnOldToolbar(){
        var thisWindow = newWinUtils.getMostRecentBrowserWindow();
        var currentset = thisWindow.document.getElementById(toolbarID).currentSet;
        for each (var window in newWinUtils.windows()){
            var toolbarElem = window.document.getElementById(toolbarID);
            toolbarElem.currentSet = currentset;
            toolbarElem.setAttribute("currentset", currentset);
            window.document.persist(toolbarID, "currentset");
        }
    }
    function initialPlacementInPalette(){
        for each (var window in newWinUtils.windows()){
            let doc = window.document;
            let $ = function(id) doc.getElementById(id);

            // see if toolbar already has button assigned to it then if not, try the toolbarID
            var toolbarElem = toolbarbuttonExists(doc, options.id);
            if(!toolbarElem) toolbarElem = $(toolbarID);

            // if button is not in a toolbar and we are not moving it to toolbar
            if(!toolbarElem && !toolbarID){
                var buttonElem = $(options.id) || createButtonDOM(doc);
                if(!buttonElem.parentNode)
                    $("navigator-toolbox").palette.appendChild(buttonElem);
                console.debug("*** TBB.saveButtonToWindow - button added to palette");
            }
            else return;
        }
    }
    function afterCustomization(){
        var doc = newWinUtils.getMostRecentBrowserWindow().document;
        var toolbarElem = toolbarbuttonExists(doc, options.id);
        if(toolbarID) clearPersistOnOldToolbar();
        if(toolbarElem)
            toolbarID = toolbarElem.id;
        else toolbarID = "";
        insertBeforeID = getInsertBeforeID(doc, toolbarID, options.id) || "";
        console.debug("*** TBB.afterCustomization fired with toolbarID='"+toolbarID+"' insertBeforeID='"+insertBeforeID+"'");
        saveButtonToAllWindows();
    }

  //on first load if toolbarid supplied
  if(!prefs.isSet(TBBLibraryPref+"."+options.id) ||
      prefs.get(TBBLibraryPref+"."+options.id) == false){
      console.debug("*** TBB pref not set, first load install");

      if(options.toolbar){
          toolbarID = options.toolbar;
      }
      saveButtonToAllWindows();
      prefs.set(TBBLibraryPref+"."+options.id, true);
  }else {
      console.debug("*** TBB pref already set, skip auto-install");
      // places button in palette on start in case it is not in a toolbar
      initialPlacementInPalette();
      afterCustomization();
  }

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

function getInsertBeforeID(doc, toolbarID, buttonID){
    if(!toolbarID) return;
    var toolbarElem = doc.getElementById(toolbarID);

    let currentset = toolbarElem.getAttribute("currentset").split(",");
    let i = currentset.indexOf(buttonID) + 1;
    // if button not in toolbarset, no b4 id to return
    if (i < 1) return;

    var insertBeforeElem;
    for (; i < currentset.length; i++) {
        insertBeforeElem = doc.getElementById(currentset[i]);
        if (insertBeforeElem) return currentset[i];
    }
}