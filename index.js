/**
 * Allows you to effortlessly interface your node applications with a variety of gamepad controllers.
 * 
 * @example
 *     var controller = ( new Gamepad( 'ps3/dualshock3' ) ).connect();
 *     controller.on( 'x:press', function() {
 *         // do something here.
 *     } );
 * @module Gamepad
 */

// load our dependencies into scope
const HID = require( 'node-hid' );
const EventEmitter = require( 'events' ).EventEmitter;
const util = require( 'util' );
const fs = require( 'fs' );
const colors = require( 'colors' );
const path = require( 'path' );

// export the constructor
module.exports = Gamepad;

// make sure the constructor inherits the properites necessary for EventEmitter to work
util.inherits( Gamepad, EventEmitter );

/**
 * `Gamepad` is the base API object constructor.
 *
 * @class Gamepad
 * @constructor
 * 
 * @param {String} type The type of gamepad to be loaded. This can follow 2 forms: (1) vendor ID or (2) vendor ID/productID. Thus, "ps3" and "ps3/dualshock3" are both valid options.
 * @param {Object} options A hash of options that can be set by the user.
 * @param {Number} [options.vendorID] When this value is specified it will overwrite the existing `vendorID` that's loaded from the detected configuration.
 * @param {Number} [options.productID] When this value is specified it will overwrite the existing `productID` that's loaded from the detected configuration.
 */
function Gamepad( type, options ) {
    EventEmitter.call( this );
    this._usb = null;
    this._type = type;
    this._config = {};
    this._states = {};
    this._options = options || {};

    // on process exit, disconnect from any devices we may be connected to.
    process.on( 'exit', this.disconnect.bind( this ) );
}

// Prototype Methods
// =================

/**
 * This function will load the configuration file for the specified controller type.
 * If the configuration file for the specified controller type does not exist, we
 * bail.
 *
 * @private
 * @method _loadConfiguration
 */
Gamepad.prototype._loadConfiguration = function() {
    var configPath = path.resolve( __dirname, './controllers/' + this._type + '.json' );
    if( ! fs.existsSync( configPath ) ) {
        console.log( ( 'The controller configuration for "' + this._type + '" does not exist.' ).red );
        process.exit( 0 );
    }

    this._config = require( configPath );

    // if the user specified a custom vendorID or productID, use that instead
    if( this._options.vendorID ) {
        this._config.vendorID = parseInt( this._options.vendorID, 10 );
    }
    if( this._options.productID ) {
        this._config.productID = parseInt( this._options.productID, 10 );
    }
};

/**
 * Detects whether or not the specified string has a product ID in the form of 
 * "vendorID/productID" or not.
 *
 * @private
 * @method _hasProductId
 * 
 * @param {String} str The string we're using to check for a product ID.
 * @return {Boolean} Indicates whether or not a product ID was detected.
 */
Gamepad.prototype._hasProductId = function( str ) {
    return str.indexOf( '/' ) > -1;
};

/**
 * Detects the configuration that will be used to load this controller type. If
 * a controller configuration is already defined, we'll use it. Otherwise, we'll
 * try to detect the specific controller configuration to use.
 *
 * @private
 * @method _detectControllerConfiguration
 * 
 * @return {Boolean} Indicates whether or not the controller configuration could be detected.
 */
Gamepad.prototype._detectControllerConfiguration = function() {
    // check to see if a product ID was already specified in the product type.
    if( this._hasProductId( this._type ) ) {
        return true;
    }

    // check to see if the vendor exists
    var platformPath = path.resolve( __dirname, './controllers/' + this._type + '/' );
    if( ! fs.existsSync( platformPath ) ) {
        console.log( ( 'The vendor "' + this._type + '" does not exist.' ).red );
        process.exit( 0 );
    }

    // we know the vendor exists, so loop through HID devices and the
    // configurations for this particular vendor while checking to see if any of
    // them match each other (indicating that we have a configuration something
    // that is currently plugged in).
    // 
    // TODO: make this faster by looping through loaded controllers once instead
    // of once per HID device.
    var devices = HID.devices();
    var files = fs.readdirSync( platformPath ), tmpConfig, tmpDevice;
    for( var i = 0, len = files.length; i < len; i++ ) {
        tmpConfig = platformPath + '/' + files[ i ];
        tmpConfig = require( tmpConfig );

        // check to see if this vendorID and productID exist
        for( var j = 0, leng = devices.length; j < leng; j++ ) {
            tmpDevice = devices[ j ];
            if( tmpConfig.vendorID === tmpDevice.vendorId && tmpConfig.productID === tmpDevice.productId ) {
                this._type = this._type + '/' + files[ i ].replace( '.json', '' );
                return true;
            }
        }
    }

    return false;
};

Gamepad.prototype.connect = function() {
    if( ! this._detectControllerConfiguration() ) {
        console.log( ( 'A product for the vendor "' + this._type + '" could not be detected.' ).red );
        process.exit( 0 );
    }

    this.emit( 'connecting' );
    this._loadConfiguration();
    this._usb = new HID.HID( this._config.vendorID, this._config.productID );
    this._usb.on( 'data', this._onControllerFrame.bind( this ) );
    this.emit( 'connected' );

    return this;
};

Gamepad.prototype._onControllerFrame = function( data ) {
    this._processJoysticks( data );
    this._processButtons( data );
    this._processStatus( data );
};

Gamepad.prototype._processJoysticks = function( data ) {
    if( ! this._config.joysticks ) {
        return;
    }

    var joysticks = this._config.joysticks, joystick, currentState;
    for( var i = 0, len = joysticks.length; i < len; i++ ) {
        joystick = joysticks[ i ];
        if( ! this._states[ joystick.name ] ) {
            this._states[ joystick.name ] = {
                x : data[ joystick.x.pin ],
                y : data[ joystick.y.pin ]
            };
            continue;
        }

        currentState = this._states[ joystick.name ];
        if( currentState.x !== data[ joystick.x.pin ] || currentState.y !== data[ joystick.y.pin ] ) {
            currentState = {
                x : data[ joystick.x.pin ],
                y : data[ joystick.y.pin ]
            };
            this._states[ joystick.name ] = currentState;
            this.emit( joystick.name + ':move', currentState );
        }
    }
};

Gamepad.prototype._processButtons = function( data ) {
    if( ! this._config.buttons ) {
        return;
    }

    var buttons = this._config.buttons, button, isPressed, currentState;
    for( var i = 0, len = buttons.length; i < len; i ++ ) {
        button = buttons[ i ];
        isPressed = ( data[ button.pin ] & 0xff ) === button.value;
        if( this._states[ button.name ] === undefined ) {
            this._states[ button.name ] = isPressed;

            if( isPressed ) {
                this.emit( button.name + ':press' );
            }

            continue;
        }
        currentState = this._states[ button.name ];

        if( isPressed && currentState !== isPressed ) {
            this.emit( button.name + ':press' );
        } else if( ! isPressed && currentState !== isPressed ) {
            this.emit( button.name + ':release' );
        }

        this._states[ button.name ] = isPressed;
    }
};

Gamepad.prototype._processStatus = function( data ) {
    if( ! this._config.status ) {
        return;
    }

    var statuses = this._config.status, status, state, states;
    var currentState;
    for( var i = 0, len = statuses.length; i < len; i++ ) {
        status = statuses[ i ];
        state = data[ status.pin ] & 0xff;
        states = status.states;

        for( var j = 0, length = states.length; j < length; j++ ) {
            if( states[ j ].value === state ) {
                state = states[ j ].state;
                break;
            }
        }

        currentState = this._states[ status.name ];
        if( currentState !== state ) {
            this.emit( status.name + ':change', state );
        }

        this._states[ status.name ] = state;
    }
};

Gamepad.prototype.disconnect = function() {
    if( this._usb ) {
        this._usb.disconnect();
    }
};