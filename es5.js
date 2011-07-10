// ECMAScript 5 compatibility functions
//
// Copyright (c) 2011, Jean Vincent
// 
// Licensed under the MIT license
//

Object.create || ( Object.create = function ( o ) {
    if ( arguments.length > 1 ) {
      throw new Error( 'Object.create implementation only accepts the first parameter.' );
    }
    function O() {}
    O.prototype = o;
    return new O();
} );

Function.prototype.bind || ( Function.prototype.bind = function( o ) {
  if ( typeof this !== "function" ) {
    throw new TypeError( "Function.prototype.bind - what is trying to be bound is not callable" )
  }
  var that = this
    , slice = Array.prototype.slice
    , a = slice.call( arguments, 1 )
    , bound = function() {
        return that.apply( o || {}, a.concat( slice.call( arguments ) ) );
      }
  ;
  bound.prototype = this.prototype;
  return bound;
} );

Array.prototype.indexOf || ( Array.prototype.indexOf = function( v, i ) {
  var l = this.length; if ( l === 0 ) return -1;
  if ( i === undefined ) {
    i = 0
  } else if( i < 0 && ( i += l ) < 0 ) i = 0;
  i -= 1; while( ++i < l ) if ( this[ i ] === v ) return i;
  return -1;
} );

Array.prototype.lastIndexOf || ( Array.prototype.lastIndexOf = function( v, i ) {
  var l = this.length; if ( l === 0 ) return -1;
  if ( i === undefined ) {
    i = l - 1
  } else if( i < 0 && ( i += l ) < 0 ) {
    return -1
  } else if ( i >= l ) i = l - 1;
  i += 1; while( --i >= 0 && this[ i ] !== v );
  return i;
} );

Array.prototype.forEach || ( Array.prototype.forEach = function( c, t ) {
  t || ( t = window );
  var i = -1; while( ++i < this.length ) c.call( t, this[i], i, this );
} );

Array.prototype.every || ( Array.prototype.every = function( c, t ) {
  t || ( t = window );
  var i = -1; while( ++i < this.length ) if ( c.call( t, this[i], i, this ) === false ) return false;
  return true;
} );

Array.prototype.some || ( Array.prototype.some = function( c, t ) {
  t || ( t = window );
  var i = -1; while( ++i < this.length ) if ( c.call( t, this[i], i, this ) === true ) return true;
  return false;
} );

Array.prototype.map || ( Array.prototype.map = function( c, t ) {
  t || ( t = window );
  var a = [], i = -1; while( ++i < this.length ) a [i] = c.call( t, this[i], i, this );
  return a;
} );

Array.prototype.filter || ( Array.prototype.filter = function( c, t ) {
  t || ( t = window );
  var a = [], i = -1; while( ++i < this.length ) c.call( t, this[i], i, this ) && a.push( this[i] );
  return a;
} );

delete Array.prototype.reduce;
Array.prototype.reduce || ( Array.prototype.reduce = function( c, v ) {
  var i = -1; if ( v === undefined ) v = this[++i];
  while( ++i < this.length ) v = c( v, this[i], i, this );
  return v;
} );

Array.prototype.reduceRight || ( Array.prototype.reduceRight = function( c, v ) {
  var i = this.length; if ( v === undefined ) v = this[--i];
  while( --i >= 0 ) v = c( v, this[i], i, this );
  return v;
} );

