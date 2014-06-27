var HID = require( 'node-hid' );
var EventEmitter = require( 'events' ).EventEmitter;
var util = require( 'util' );
var fs = require( 'fs' );
var colors = require( 'colors' );
var path = require('path');

module.exports = Gamepad;
util.inherits( Gamepad, EventEmitter );

function Gamepad( type, options ) {
    EventEmitter.call( this );
    this._usb = null;
    this._type = type;
    this._config = {};
    this._states = {};
    this._options = options || {};

    process.on( 'exit', this.disconnect.bind( this ) );
}

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

Gamepad.prototype._hasProductId = function( str ) {
    return str.indexOf( '/' ) > -1;
};

Gamepad.prototype._detectProductId = function() {
    // check to see if the vendor exists
    var platformPath = path.resolve( __dirname, './controllers/' + this._type + '/' );
    if( ! fs.existsSync( platformPath ) ) {
        console.log( ( 'The vendor "' + this._type + '" does not exist.' ).red );
        process.exit( 0 );
    }

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
    if( ! this._hasProductId( this._type ) && ! this._detectProductId() ) {
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