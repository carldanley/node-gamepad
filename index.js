var HID = require( 'node-hid' );
var EventEmitter = require( 'events' ).EventEmitter;
var util = require( 'util' );
var fs = require( 'fs' );
var colors = require( 'colors' );

module.exports = Gamepad;
util.inherits( Gamepad, EventEmitter );

function Gamepad( type ) {
    EventEmitter.call( this );
    this._usb = null;
    this._type = type;
    this._config = {};

    process.on( 'exit', this.disconnect.bind( this ) );
}

Gamepad.prototype._loadConfiguration = function() {
    var path = './controllers/' + this._type + '.json';
    if( ! fs.existsSync( path ) ) {
        console.log( ( 'The controller configuration for "' + this._type + '" does not exist.' ).red );
        process.exit( 0 );
    }

    this._config = require( path );
};

Gamepad.prototype.connect = function() {
    this.emit( 'connecting' );
    this._loadConfiguration();
    this._usb = new HID.HID( this._config.vendorID, this._config.productID );
    this._usb.on( 'data', this._processFrame.bind( this ) );
    this.emit( 'connected' );
};

Gamepad.prototype._processFrame = function( data ) {
    console.log( data );
};

Gamepad.prototype.disconnect = function() {
    if( this._usb ) {
        this._usb.disconnect();
    }
};