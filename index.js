var HID = require( 'node-hid' );
var EventEmitter = require( 'events' ).EventEmitter;
var util = require( 'util' );
var fs = require( 'fs' );
var colors = require( 'colors' );

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
    var path = './controllers/' + this._type + '.json';
    if( ! fs.existsSync( path ) ) {
        console.log( ( 'The controller configuration for "' + this._type + '" does not exist.' ).red );
        process.exit( 0 );
    }

    this._config = require( path );

    // if the user specified a custom vendorID or productID, use that instead
    if( this._options.vendorID ) {
        this._config.vendorID = parseInt( this._options.vendorID, 10 );
    }
    if( this._options.productID ) {
        this._config.productID = parseInt( this._options.productID, 10 );
    }
};

Gamepad.prototype.connect = function() {
    this.emit( 'connecting' );
    this._loadConfiguration();
    this._usb = new HID.HID( this._config.vendorID, this._config.productID );
    this._usb.on( 'data', this._onControllerFrame.bind( this ) );
    this.emit( 'connected' );
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