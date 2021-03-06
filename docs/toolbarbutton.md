The `toolbarbutton` API provides a simple way to create
[toolbar buttons](https://developer.mozilla.org/en/XUL/toolbarbutton), which
can perform an action when clicked.

## Example ##

  exports.main = function(options) {
    // create toolbarbutton
    var tbb = require("toolbarbutton").ToolbarButton({
      id: "TBB-TEST",
      label: "TBB TEST",
      onCommand: function () {
        tbb.destroy(); // kills the toolbar button
      }
    });
  };

<api name="ToolbarButton">
@class

Module exports `ToolbarButton` constructor allowing users to create a
toolbar button.

<api name="ToolbarButton">
@constructor
Creates a toolbarbutton.

@param options {Object}
  Options for the toolbarbutton, with the following parameters:

@prop id {String}
A id for the toolbar button, this should be namespaced.

@prop toolbar {String}
The id of the toolbar which you want to add the toolbar button to.

Example toolbar IDs:

- **toolbar-menubar**: The menu bar.
- **nav-bar**: The navigation bar.
- **TabsToolbar**: The tabs bar.
- **addon-bar**: The addon bar.

@prop label {String}
A label for the toolbar button.

@prop disabled {Boolean}
Whether to set the button as disabled or not clickable.

@prop privateWindow {Boolean}
Whether to include button on private windows.ga

@prop image {String}
A image url for the toolbar button.

@prop [onCommand] {Function}
 A option function that is invoked when the toolbar button is pressed.

@prop [panel] {Panel}
  A optional panel.
</api>

<api name="destroy">
@method
Removes the toolbar button from all open windows and no longer adds the
toolbar button to new windows.
</api>
</api>
