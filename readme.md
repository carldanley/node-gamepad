# node-gamepad

> node-gamepad is a package for node that allows you to effortlessly interface your node applications with a variety of gamepad controllers.

## Installation

```js
npm install node-gamepad
```

### Supported Controllers

1. snes/tomee
1. snes/retrolink
1. ps3/dualshock3
1. ps4/dualshock4
1. n64/retrolink
1. logitech/rumblepad2
1. logitech/dualaction
1. logitech/gamepadf710
1. microsoft/sidewinder-precision-2

## How to Use

Plug in a supported controller and run a variation of the code below (with an actual supported controller):

### Code Example

```js
var GamePad = require( 'node-gamepad' );
var controller = new GamePad( 'supported/controller/here' );
controller.connect();

controller.on( 'up:press', function() {
    console.log( 'up' );
} );
controller.on( 'down:press', function() {
    console.log( 'down' );
} );
```

If you want to use the same configuration for another controller but the vendorID and/or productID is different that the one included in the existing controller dictionary, you can simply pass in an optional second parameter when instantiating the new `GamePad` object:

```js
var GamePad = require( 'node-gamepad' );
var controller = new GamePad( 'supported/controller', {
	vendorID: 1337,
	productID: 1338
} );
controller.connect();
```

Both `vendorID` and `productID` are individually optional key/value pairs you can specify. If they are defined, they will override the ones in the controller's dictionary file, thus allowing you to use the same mapping but with a different product and/or vendor ID.

If you want to be implicit, you can drop the product ID from the controller type specification and node-gamepad will try to automatically detect the proper controller:

```js
var GamePad = require( 'node-gamepad' );
var controller = new GamePad( 'snes' );
```

Please note: it's better to be explicit and specify the exact product ID so you don't run into any confusion with the configuration that's loaded.

## Supported Events

This package supports up to 3 different types of components: joysticks, buttons and statuses (like battery level, charging, etc). It's possible that a controller could make use of all 3 different components or even introduce additional components. The idea here is the dictionary file will dictate how the controller will be used and how to read data from it.

### Joysticks

1. `{name}:move` - When fired, this joystick event will provide an object literal with an `x` and `y` value.

### Buttons

1. `{name}:press` - No data is attached to this callback but it serves the purpose of notifying the developer that a button has been pressed.
1. `{name}:release` - No data is attached to this callback but it serves the purpose of notifying the developer that a button (that was previously pressed) has been released.

### Statuses

A status value is read from a pin on the hardware and then can be mapped to a "state" (based on the dictionary file). See [this example](https://github.com/carldanley/node-gamepad/blob/master/controllers/ps3/dualshock3.json#L136) for more information.

1. `{name}:change`

## Contributing Controllers

You can add controller configuration files to the controllers directory. They are namespaced by `platform/vendor.json`. Each configuration file contains the pins/values mapped to the name of each button, joystick or status. You can use the [hid-mapper](https://www.npmjs.org/package/hid-mapper) tool which will help you create all the necessary mappings to save to your configuration file.

## License

The MIT License (MIT)

Copyright (c) 2014 Carl Danley and contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
