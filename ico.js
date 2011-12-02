/* Ico Graph Prototype/Raphael library
 *
 * Copyright (c) 2009, 2010, 2011 Jean Vincent, ReverseRisk
 * Copyright (c) 2009, Alex R. Young
 * Licensed under the MIT license: http://github.com/uiteoi/ico/blob/master/MIT-LICENSE
 */

"use strict";

var Ico = {
  Version: "0.98.1",
  
  extend : function( d, s ) {
    for( var p in s ) d[p] = s[p];
    
    return d
  },
  
  isArray : function( v ) { return typeof v === 'object' && v instanceof Array }
};

(function() {
  var de = true, ug;
  
  if ( console.log ) {
    ug = function( m ) {
      console.log( "Ico." + m );
    }
  } else {
    de = false;
  }
  
  Ico.extend( Ico, {
    Class : {
      add_methods : Ico.extend, // could be changed to implement additional features such as $super
      
      create : function( p ) {
        var C = function() { this.initialize.apply( this, arguments ) };
        C.subclasses = [];
        
        var i = -1;
        if ( typeof p === "function" ) {
          i += 1;
          ( C.superclass = p ).subclasses.push( C );
          C.prototype = Object.create( p.prototype );
        } else {
          C.superclass = null;
        }
        C.prototype.constructor = C;
        
        // Add instance properties and methods
        while ( ++i < arguments.length ) Ico.Class.add_methods( C.prototype, arguments[ i ] );
        
        C.prototype.initialize || ( C.prototype.initialize = function() {} );
        
        return C;
      }
    },
    
    get_style : function( e, p ) {
      var v = "";
      if ( document.defaultView && document.defaultView.getComputedStyle ) {
        v = document.defaultView.getComputedStyle( e, "" ).getPropertyValue( p );
      } else if( e.currentStyle ) {
        p = p.replace(/\-(\w)/g, function( s, p ){
          return p.toUpperCase();
        } );
        v = e.currentStyle[p];
      }
      return v;
    },
    
    // Element.viewportOffset from Prototype library (last dependency)
    // If not available, i.e. when prototype is not installed the only feature that will be disabled
    // is the mouse pointer component.
    viewport_offset : Element.viewportOffset,
    
    // These helper methods are good candidates for unit testing
    significant_digits_round: function( v, significant_digits, f, string ) {
      if ( v == 0 || v == Number.NEGATIVE_INFINITY || v == Number.POSITIVE_INFINITY ) return v;
      var sign = 1;
      if ( v < 0 ) v = -v, sign = -1;
      var p10 = Math.floor( Math.log( v ) / Math.LN10 );
      if ( p10 < -14  ) return 0; // assume floating point rounding error => was meant to be zero
      p10 -= significant_digits - 1;
      v = ( f || Math.round )( sign * v / Math.pow( 10, p10 ) );

      if ( string && p10 < 0 ) {
        v *= sign; // remove sign again
        while ( v % 10 == 0 ) {
          // remove non-significant zeros 12300 => 123
          p10 += 1;
          v /= 10;
        }
        v = '' + v;
        var len = v.length + p10;
        if ( len <= 0 ) {
          // value < 1
          return ( sign < 0 ? '-' : '' ) + '0.00000000000000'.substring(0, 2 - len ) + v;
        } else if ( p10 < 0 ) {
          // value has significant digits on both sides of the point
          return ( sign < 0 ? '-' : '' ) + v.substring( 0, len ) + '.' + v.substring( len );
        }
        // value has no decimals
        v *= sign;
      }
      return v * Math.pow( 10, p10 );
    },

      
    root: function( v, p ) {
      return Math.floor( Math.log( Math.abs( v ) ) / Math.log( p ) );
    },

    svg_path: function( a ) {
      var path = '', previous_isNumber = false;
      a.forEach( function( v ) {
        if ( typeof v === "number" ) {
          if ( previous_isNumber ) path += ' ';
          path += Math.round( v );
          previous_isNumber = true;
        } else {
          path += v;
          previous_isNumber = false;
        }
      } );
      return path;
    },
    
    adjust_min_max: function( min, max ) {
      // Adjust start value to show zero if reasonable (e.g. range > min)
      var range = max - min;
      if ( range === 0 ) {
        min = 0;
        if ( max === 0 ) max = 1;
      } else if ( range < min ) {
        min -= range / 2;
      } else if ( min > 0 ) {
        min = 0;
      } else if ( range < -max ) {
        max += range / 2;
      } else if ( max < 0 ) {
        max = 0;
      }
      return [min, max];
    },
    
    series_min_max: function( series, dont_adjust ) {
      de&&ug( "series_min_max: values length: " + series.length );
      var values = Array.prototype.concat.apply( [], series );
      de&&ug( "series_min_max: values length: " + values.length );
      if ( values.length == 0 ) throw "Series must have at least one value";
      var min_max = [
          Ico.significant_digits_round( Math.min.apply( Math, values ), 2, Math.floor ),
          Ico.significant_digits_round( Math.max.apply( Math, values ), 2, Math.ceil )
        ]
      ;
      dont_adjust || ( min_max = Ico.adjust_min_max.apply( Ico, min_max ) );
      min_max.push( values );
      return min_max;
    },
    
    moving_average: function( serie, samples, options ) {
      var ma = [], i = -1, j = -1, p;
      if ( options && Ico.isArray( p = options.previous_values ) ) {
        serie = p.concat( serie );
        i += p.length
      }
      for ( var len = serie.length; ++i < len;  ) {
        var a = 0;
        for ( var k = -1; ++k < samples && i >= k; ) {
          a += serie[i - k]
        }
        ma[++j] = Ico.significant_digits_round( a / k, 3, Math.round, true )
      }
      return ma;
    }
  } );

  Ico.Base = Ico.Class.create( {
    initialize: function( element, series, o ) {
      if ( typeof element == "string" ) element = document.getElementById( element );
      this.element = element;
      this.series = series || [[0]];
      this.set_defaults();
      this.set_series();
      this.process_options( o );
      this.set_raphael( o = this.options );
      this.calculate( o );
      this.draw( o );
      return this;
    },
    
    set_series: function() {
      if ( Ico.isArray( this.series ) ) {
        de&&ug( "set_series Array, element 0 is Array:" + Ico.isArray( this.series[0] ) );
        if ( ! Ico.isArray( this.series[0] ) ) this.series = [this.series];
      } else if ( typeof this.series === "number" ) {
        this.series = [[this.series]];
      } else {
        throw 'Wrong type for series';
      }
      this.data_samples = Math.max.apply( Math, this.series.map( function(v) { de&&ug( "serie length: " + v.length ); return v.length } ) );
      de&&ug( "set_series, data samples: " + this.data_samples );
      var min_max = Ico.series_min_max( this.series, true );
      this.max = min_max[1];
      this.min = min_max[0];
      this.all_values = min_max[2];
      this.series_shapes = [];
    },
    
    set_defaults: function() {
      var o = this.options = {
        // Canvas dimensions
        width:                parseInt( this.element.offsetWidth ) -1,
        height:               parseInt( this.element.offsetHeight ) -1,
        // Padding
        x_padding_left:       0,
        x_padding_right:      0,
        y_padding_top:        0,
        y_padding_bottom:     0,
        // Attributes
        color:                Ico.get_style( this.element, "color" ),
        //color:                this.element.getStyle( 'color' ),
        mouseover_attributes: { stroke: 'red' },
        // Units
        units:                '',
        units_position:       1   // 0 => before value e.g. $34, 1 => after value e.g. 45%.
      };
      de&&ug( "options: width: " + o.width + ', height: ' + o.height + ', color: ' + o.color );
    },
    
    process_options: function( o ) {
      var t = this;
      
      o && ( o = Ico.extend( t.options, o ) );
      
      // Set min and max if overriden
      if ( typeof( o.min ) != 'undefined' ) t.min = Math.min( t.min, o.min ); 
      if ( typeof( o.max ) != 'undefined' ) t.max = Math.max( t.max, o.max );
      t.range = t.max - t.min;

      // Set x and y attributes
      t.x = { direction: [1,  0], start_offset: 0, width: o.width  };
      t.y = { direction: [0, -1], start_offset: 0, width: o.height };
      t.x.other = t.y; t.y.other = t.x;
      t.x.padding = [o.x_padding_left, o.x_padding_right];
      t.y.padding = [o.y_padding_top, o.y_padding_bottom];
      
      t.orientation = ( o.orientation || t.orientation || 0 );
      t.y_direction = t.orientation? -1 : 1;
      // t.graph.x => labels axis; t.graph.y => value labels axis
      t.graph = t.orientation? { x: t.y, y: t.x } : { x: t.x, y: t.y };
        
      // Scan components and process their options
      t.components = [];
      for ( var k in Ico.Component.components ) {
        if ( ! Ico.Component.components.hasOwnProperty( k ) ) continue;
        var a = t.options[k + '_attributes'], o = t.options[k], v = Ico.Component.components[k];
        if ( o === true && a ) o = t.options[k] = a;
        if ( o ) {
          var layer = v[1];
          if ( ! t.components[layer] ) t.components[layer] = [];
          try {
            t.components[layer].push( t[k] = new (v[0])( t, o ) )
          } catch( e ) {
            t.error = e;
            de&&ug( "process_options(), exception: " + e );
          }
        }
      };
    },
    
    get_font: function() {
      var o = this.options;
      if( this.font ) return this.font;
      this.font = {
        'font-family': Ico.get_style( this.element, 'font-family' ),
        'font-size'  : o.font_size || Ico.get_style( this.element, 'font-size' ) || 10,
        fill         : Ico.get_style( this.element, 'color' ) || '#666',
        stroke       : 'none'
      };
      Ico.extend( this.font, o || {} );
      // this.graph.x.labels_font = this.graph.y.labels_font = this.font;
      return this.font
    },
    
    set_raphael: function( o ) {
      if ( this.paper ) return;
      this.paper = Raphael( this.element, o.width, o.height );
      this.svg = ! ( this.vml = Raphael.vml );
    },
    
    clear: function() {
      if ( this.paper ) {
        this.components_call( 'clear', this.options );
        this.paper.remove();
        this.paper = null;
      }
      return this
    },
    
    calculate: function( o ) {
      this.paper || this.set_raphael( o );
      
      // component calculations may modify padding to make room for themselves
      this.components_call( 'calculate', o );
      
      // calculate graph area dimensions
      this.calculate_graph_len( this.graph.x );
      this.calculate_graph_len( this.graph.y );
      
      // calculate graph plotting attributes
      this.scale = this.y_direction * this.graph.y.len / this.range;
      this.graph.x.step = this.graph.x.len / this.label_slots_count();
      
      // calculate start and stop graph canvas coordinates
      this.x.start = this.x.padding[0];
      this.x.stop  = this.x.start + this.x.len;
      
      this.y.stop  = this.y.padding[0];
      this.y.start = this.y.stop + this.y.len;
    },
    
    calculate_graph_len: function( d ) {
      d.len  = d.width - d.padding[0] - d.padding[1];
    },
    
    calculate_bars: function( o ) {
      this.bar_width = this.graph.x.step - o.bar_padding;
      if ( this.bar_width < 5 ) this.bar_width = 5;
      this.graph.x.start_offset = this.y_direction * this.graph.x.step / 2;
      this.bar_base = this.graph.y.start - this.scale * (
        ( this.max <= 0? this.max : 0 ) -
        ( this.min <  0? this.min : 0 )
      )
    },
    
    format_value: function( v, p1000 ) {
      if ( v != 0 && typeof p1000 !== "number" ) { // !! v can be the string "0"
        p1000 = Ico.root( v, 1000 );
        p1000 && ( v /= Math.pow( 1000, p1000 ) );
        v = Ico.significant_digits_round( v, 3, Math.round, true ).toString()
      }
      v = '' + v;
      p1000 && ( v += ['','k','M','G','T','P','E','Z','Y'][p1000] || 'e' + 3 * p1000 );
      var o = this.options;
      if ( o.units ) return o.units_position? v + o.units : o.units + v;
      return v
    },

    draw: function( o ) {
      this.paper || this.set_raphael( o );
      this.components_call( 'draw', o );
      this.draw_series( o );
      return this
    },
    
    draw_series: function( o ) {
      for ( var i = -1; ++i < this.series.length; ) {
        this.series_shapes[i] = {
          shape: this.draw_serie( this.series[i], i, o ),
          visible: true
        }
      };
      this.highlight && this.draw_highlight(); // make highlight a component
    },
    
    get_serie: function( s ) {
      s = this.series_shapes[s];
      if ( s ) return s;
      throw 'Undefined serie';
    },
    
    toggle_serie: function( s ) {
      ( ( s = this.get_serie( s ) ).visible ^= 1 ) && s.shape.show() || s.shape.hide();
    },
    
    show_serie: function( s ) {
      ( s = this.get_serie( s ) ).shape.show();
      s.visible = true;
    },
    
    hide_serie: function( s ) {
      ( s = this.get_serie( s ) ).shape.hide();
      s.visible = false;
    },
    
    components_call: function( f, o ) {
      for( var i = -1; ++i < this.components.length; ) {
        var layer = this.components[i];
        if ( ! layer ) continue;
        for( var j = -1; ++j < layer.length; ) {
          var c = layer[j];
          try {
            c[f] && c[f]( c.options, this )
          } catch( e ) {
            de&&ug( "Ico::Base::components_call(), exception " + JSON.stringify( e ) );
            this.set_raphael( o )
            this.errors = ( this.errors || 0 ) + 1;
            this.paper.text( 0, 12 * this.errors, "Error in " + f + "(): " + ( this.error = e ) )
              .attr( {
                'text-anchor': 'start',
                'font-size': 10, fill: 'black', stroke:'none', 'font-family': 'Arial'
              }
            )
          }
        }
      };
    },
    
    plot: function( v ) {
      return ( v - this.min ) * this.scale;
    },

    show_label_onmouseover : function( o, value, attr, serie, i, name ) {
        var t = this, v = '';
        if ( this.status_bar ) {
          if ( ! name ) {
            var labels = this.labels, label,
                names = this.options.series_names
            ;
            if ( labels && ( labels = labels.options.long_values || labels.options.values ) && ( label = labels[i] ) ) {
              v += label + ', '
            }
            names && ( name = names[serie] );
          }
          name && ( v += name + ': ' );
          v += this.format_value( value );
        }
        
        o.node.onmouseout = function() {
          t.status_bar && t.status_bar.shape.hide();
          o.attr( attr );
        };
        
        o.node.onmouseover = function() {
          t.status_bar && t.status_bar.shape.attr( { 'text': v } ).show();
          o.attr( t.options.mouseover_attributes );
        };
    }
  } );

  Ico.SparkLine = Ico.Class.create( Ico.Base, {
    process_options: function( o ) {
      Ico.Base.prototype.process_options.call( this, o );
      
      this.graph.y.padding[1] += 1;
      var highlight = this.options.highlight;
      if ( highlight ) {
        this.highlight = { index: this.data_samples - 1, color: 'red', radius: 2 };
        Ico.extend( this.highlight, highlight == true? {} : highlight );
        if ( this.highlight.index == this.data_samples - 1  ) this.graph.x.padding[1] += this.highlight.radius + 1;
      }
    },
      
    label_slots_count: function() { return this.data_samples - 1 },
    
    draw_serie: function( serie, i, o ) {
      var t = this, x = this.x.start + this.x.start_offset, p;
      serie.forEach( function( v ) {
        p = Ico.svg_path(
          [( p ? p + 'L' : 'M' ), x, t.y.start + t.y.start_offset - t.plot( v )]
        );
        x += t.x.step;
      } );
      return this.paper.path( p ).attr( { stroke: o.color } );
    },
    
    draw_highlight: function() {
      var i = this.highlight.index, x = this.x, y = this.y;
      this.paper.circle(
        Math.round( x.start + x.start_offset + i * x.step ),
        Math.round( y.start + y.start_offset - this.plot( this.series[0][i] ) ),
        this.highlight.radius
      ).attr( { stroke: 'none', fill: this.highlight.color } );
    }
  } );

  Ico.SparkBar = Ico.Class.create( Ico.SparkLine, {
    label_slots_count: function() { return this.data_samples },

    calculate: function( o ) {
      Ico.SparkLine.prototype.calculate.call( this, o );
      
      this.calculate_bars( o )
    },

    draw_serie: function( serie, i, o ) {
      var t = this, x = this.x.start + this.x.start_offset, p = '';
      serie.forEach( function( v ) {
        p += Ico.svg_path( ['M', x, t.bar_base, 'v', - t.scale * v ] );
        x += t.x.step;
      } )
      return this.paper.path( p ).attr( { 'stroke-width': this.graph.x.step, stroke: o.color } );
    },
    
    draw_highlight: function() {
      var i = this.highlight.index, x = this.x;
      this.paper.path( Ico.svg_path( [
        'M', x.start + x.start_offset + i * x.step, this.bar_base,
        'v', - this.scale * this.series[0][i]
      ] ) ).attr( { 'stroke-width': this.graph.x.step, stroke: this.highlight.color } );
    }
  } );

  Ico.BulletGraph = Ico.Class.create( Ico.Base, {
    set_defaults: function() {
      Ico.Base.prototype.set_defaults.call( this );
      
      this.orientation = 1;
      
      Ico.extend( this.options, {
        min              : 0,
        max              : 100,
        color            : '#33e',
        graph_background : true
      })
    },
    
    process_options: function( o ) {
      Ico.Base.prototype.process_options.call( this, o );
      
      var t = this.target = { color: '#666', length: 0.8, 'stroke-width' : 2 };
      if ( typeof o.target === "number" ) {
        t.value = o.target
      } else {
        Ico.extend( t, o.target || {} );
      }
    },
    
    label_slots_count: function() { return 1 },
    
    calculate: function( o ) {
      Ico.Base.prototype.calculate.call( this, o );
      
      o.bar_padding || ( o.bar_padding = 2 * this.graph.x.len / 3 );
      this.calculate_bars( o )
    },
    
    draw_series: function( o ) {
      var x = this.x.start + this.x.start_offset,
          y = this.y.start + this.y.start_offset,
          value = this.series[0][0]
      ;
      
      // this is a bar value => new Ico.Serie.Line(serie).draw()
      var a, p = this.series_shapes[0] = this.paper.path( Ico.svg_path(
        ['M', x - this.plot( value ), y - this.bar_width / 2,
         'H', this.bar_base, 'v', this.bar_width,
         'H', x - this.plot( value ), 'z']
      ) ).attr( a = { fill: o.color, 'stroke-width' : 1, stroke: 'none' } );

      this.show_label_onmouseover( p, value, a, 0, 0 );
      
      // target should be a component, or might be a graph background option
      if ( typeof( this.target.value ) != 'undefined' ) {
        var t = this.target, padding = 1 - t.length, y = this.y;
        this.paper.path( Ico.svg_path(
          ['M', x - this.plot( t.value ), y.len * padding / 2, 'v', y.len * ( 1 - padding )]
        ) ).attr( { stroke: t.color, 'stroke-width' : t['stroke-width'] } )
      }
    }
  } );
   
  Ico.BaseGraph = Ico.Class.create( Ico.Base, {
    set_defaults: function() {
      Ico.Base.prototype.set_defaults.call( this );
      
      Ico.extend( this.options, {
        // Padding options
        y_padding_top:            15,
        y_padding_bottom:         10,
        x_padding_left:           10,
        x_padding_right:          10,
        // Series options
        colors:                   [], // List of colors for line graphs
        series_attributes:        [], // List of attributes for lines or bars
        // Other options
        value_labels:             {}, // allow values, labels, false => disable
        focus_hint:               true,
        axis:                     true,
        grid_attributes:          { stroke: '#eee', 'stroke-width': 1 }
      } );
    },
    
    process_options: function( options ) {
      var t = this, min_max = Ico.adjust_min_max( this.min, this.max );
      this.min = min_max[0];
      this.max = min_max[1];
      
      // !! process superclass options after min and max adjustments
      Ico.Base.prototype.process_options.call( this, options );
      
      // Set default colors[] for individual series
      this.series.forEach( function( serie, i ) {
        t.options.colors[i] || (
          t.options.colors[i] = t.options.color || Raphael.hsb2rgb( Math.random(), 1, .75 ).hex
        )
      } );
    },
    
    draw_serie: function( serie, index, o ) {
      var x = this.graph.x.start + this.graph.x.start_offset,
          y = this.graph.y.start + this.graph.y.start_offset + this.scale * this.min,
          p = this.paper.path(),
          path = '',
          set = this.paper.set()
      ;
      for( var i = -1; ++i < serie.length; ) {
        var v = serie[i];
        if ( v == null ) {
          this.last = null;
        } else {
          path += this.draw_value( i, x, y - this.scale * v, v, index, set, o );
        }
        x += this.y_direction * this.graph.x.step;
      };
      if ( path != '' ) { // only for line graphs
        p.attr( { path: path } ).attr( o.series_attributes[index] ||
          { stroke: o.colors[index], 'stroke-width': o.stroke_width || 3 }
        );
        set.push( p )
      }
      return set;
    }  
  } );

  Ico.LineGraph = Ico.Class.create( Ico.BaseGraph, {
    set_defaults: function() {
      Ico.BaseGraph.prototype.set_defaults.call( this );
      
      Ico.extend( this.options, {
        curve_amount:     5,  // 0 => disable
        dot_radius:       3,  // 0 => no dot
        dot_attributes:   [], // List of attributes for dots
        focus_radius:     6,  // 0 => disable mouseover action
        focus_attributes: { stroke: 'none', 'fill': 'white',  'fill-opacity' : 0 }
      }
    ) },
    
    process_options: function( options ) {
      Ico.BaseGraph.prototype.process_options.call( this, options );
      
      var t = this;
      
      this.series.forEach( function( serie, i ) {
        var color = t.options.colors[i];
        
        if ( ! t.options.series_attributes[i] ) {
          t.options.series_attributes[i] = {
            stroke: color, 'stroke-width': 2
          };
        }
        // line dots attribute apply only to line series
        if ( ! t.options.dot_attributes[i] ) {
          t.options.dot_attributes[i] = {
            'stroke-width': 1,
            stroke: t.background ? t.background.options.color : color,
            fill: color
          };
        }
      } );
    },
    
    label_slots_count: function() { return this.data_samples - 1 },

    draw_value: function( i, x, y, value, serie, set, o ) {
      var radius = o.dot_radius,
          focus  = o.focus_radius,
          t
      ;
          
      this.orientation && ( t = x, x = y, y = t );
      
      if ( typeof radius == 'object' ) radius = radius[ serie ]; 
      if ( radius ) {
        set.push( this.paper.circle( x, y, radius ).attr( o.dot_attributes[ serie ] ) );
      }
      
      if ( typeof focus == 'object' ) focus = focus[ serie ];
      if ( focus ) {
        var a = o.focus_attributes,
            c = this.paper.circle( x, y, focus ).attr( a )
        ;
        set.push( c );
        this.show_label_onmouseover( c, value, a, serie, i );
      }
      
      var p, w = o.curve_amount, last = this.last;
      if ( i == 0 || ( w && !last ) ) {
        p = ['M', x, y];
      } else if ( w ) {
        serie = this.series[serie];
        // Calculate cubic Bezier control points relative coordinates based on the two previous, current
        // and next points
        var scale = this.scale * w / 2 / this.graph.x.step,
          ym1 = serie[i - 1], ym2 = serie[i - 2], y0 = serie[i], y1 = serie[i + 1],
          d0 = [w, ( ym2 !== undefined ? ( ym2 - y0 ) : ( ym1 - y0 ) * 2 ) * scale],
          d1 = [w, ( y1  !== undefined ? ( ym1 - y1 ) : ( ym1 - y0 ) * 2 ) * scale]
        ;

        this.orientation && ( d0 = [d0[1], -w], d1 = [d1[0], -w] );

        var x0 = last[0] + d0[0], y0 = last[1] + d0[1]
          , x1 = x - d1[0], y1 = y - d1[1]
        ;

        // Display control points and lines
        if ( o.debug && serie === this.series[0] ) {
          var a0 = { 'stroke':'black' }, a1 = { 'stroke':'red' };

          this.paper.circle( x0, y0, 1 ).attr( a0 );
          this.paper.path( Ico.svg_path( ['M', last[0], last[1], 'L', x0, y0 ] ) ).attr( a0 );
          this.paper.circle( x1, y1, 1 ).attr( a1 );
          this.paper.path( Ico.svg_path( ['M', x, y, 'L', x1, y1 ] ) ).attr( a1 );
        }
        p = ["C", x0, y0, x1, y1, x, y];
      } else {
        p = ['L', x, y];
      }
      
      w && ( this.last = [x, y] );
      return Ico.svg_path( p );
    }
  } );

  Ico.BarGraph = Ico.Class.create( Ico.BaseGraph, {
    set_defaults: function() {
      Ico.BaseGraph.prototype.set_defaults.call( this );
      var o = this.options;
      
      o.bar_padding = 5;
      o.bars_overlap = 1 / 2;
    },
    
    process_options: function( o ) {
      Ico.BaseGraph.prototype.process_options.call( this, o );
      var t = this; o = t.options;
      
      this.series.forEach( function( serie, i ) {
        var a = o.series_attributes;
        
        a[i] || ( a[i] = {
          stroke: 'none', 'stroke-width': 2,
          gradient: '' + ( t.orientation ? 270 : 0 ) + '-' + o.colors[i] + ':20-#555555'
        } );
      } );
      
      o.bars_overlap > 1 && ( o.bars_overlap = 1 );
    },
    
    calculate: function( o ) {
      Ico.BaseGraph.prototype.calculate.call( this, o );
      
      this.calculate_bars( o );
      o = this.bars_overlap = o.bars_overlap;
      
      var n = this.series.length
        , w = this.bars_width = this.bar_width / ( n - ( n - 1 ) * o )
      ;
      
      this.bars_step = w * ( 1 - o );
    },
    
    label_slots_count: function() { return this.data_samples },
    
    draw_value: function( i, x, y, v, serie, set, o ) {
      var a = o.series_attributes[serie],
        w = this.bars_width,
        b = this.bar_base,
        bar
      ;
      x += this.bars_step * serie - this.bar_width / 2;
      this.show_label_onmouseover( bar = this.paper.path( Ico.svg_path( this.orientation?
          ['M', y, x, 'H', b, 'v', w, 'H', y, 'z'] :
          ['M', x, y, 'V', b, 'h', w, 'V', y, 'z']
        ) ).attr( a ), v, a, serie, i
      );
      set.push( bar );
      return '';
    }
  } );

  Ico.HorizontalBarGraph = Ico.Class.create( Ico.BarGraph, {
    set_defaults: function() {
      Ico.BarGraph.prototype.set_defaults.call( this );
      
      this.orientation = 1;
    }
  });

  // ----------------
  // Chart components
  // ----------------

  Ico.Component = Ico.Class.create( {
    initialize: function( p, o ) {
      Ico.extend( this, {
        p           : p,
        graph       : p.graph,
        x           : p.x,
        y           : p.y,
        orientation : p.orientation
      } );
      if( Ico.isArray( o ) ) o = { values: o };
      else if( typeof o === "number" || typeof o === "string" ) o = { value: o };
      this.process_options( this.options = Ico.extend( this.defaults( p ), o ), p );
    },
    defaults: function() { return {} }, // return default options, if any
    process_options: function() {}      // process options once set
  } );

  Ico.Component.components = {};

  /*
  Ico.Component.Template = Ico.Class.create( Ico.Component, {
    defaults: function() { return {} },
    process_options: function() {},
    calculate: function() {},
    draw: function() {},
    clear: function() {}
  } );

  Ico.Component.components.template = [Ico.Component.Template, 0];
  */

  Ico.Component.Background = Ico.Class.create( Ico.Component, {
    defaults: function() { return { corners: true } },
    
    process_options: function( o ) {
      if ( o.color && ! o.attributes ) {
        o.attributes = { stroke: 'none', fill: o.color };
      }
      if ( o.attributes ) o.color = o.attributes.fill;
      if ( o.corners === true ) o.corners = Math.round( this.p.options.height / 20 );
    },
    
    draw: function( o, p ) {
      var O = p.options;
      
      this.shape = p.paper.rect( 0, 0, O.width, O.height, o.corners )
      .attr( o.attributes );
    }
  } );

  Ico.Component.components.background = [Ico.Component.Background, 0];

  Ico.Component.StatusBar = Ico.Class.create( Ico.Component, {
    defaults: function() { return { attributes: { 'text-anchor': 'end' } } },
    
    draw: function( o, p ) {
      var O = p.options, y = this.y;
      
      this.shape = p.paper
        .text( o.x || O.width - 10, o.y || ( y ? y.padding[0] : O.height ) / 2, '' )
        .hide().attr( o.attributes )
      ;
    }
  } );

  Ico.Component.components.status_bar = [Ico.Component.StatusBar, 2];

  Ico.Component.MousePointer = Ico.Class.create( Ico.Component, {
    defaults: function() { return { attributes: { stroke: '#666', 'stroke-dasharray': '--' } } },

    draw: function( o, p ) {
      if ( ! Ico.viewport_offset ) return;
      
      var s = this.shape = p.paper.path().attr( o.attributes ).hide()
        , X = this.x, Y = this.y, c = p.element
      ;
      
      c.onmousemove = function( e ) {
        e = e || window.event;
        
        var o = Ico.viewport_offset( c ), x = e.clientX - o[0], y = e.clientY - o[1];
        // Google chrome: if the view does not start at 0, 0, there is an offset
        // IE: Slow moves
        // FF provides the best result with smooth moves
        if ( x >= X.start && x <= X.stop && y >= Y.stop  && y <= Y.start ) {
          s.attr( { path: Ico.svg_path(
            [ 'M', X.start, y, 'h', X.len, 'M', x, Y.stop , 'v', Y.len ]
          ) } ).show();
        } else {
          s.hide();
        }
      };
      
      c.onmouseout = function() { s.hide() };
    }
  } );

  Ico.Component.components.mouse_pointer = [Ico.Component.MousePointer, 2];

  Ico.Component.GraphBackground = Ico.Class.create( Ico.Component, {
    defaults: function() {
      return {
        key_colors        : ['#aaa','#ccc','#eee'], // e.g. bad, satisfactory, and good colors
        key_values        : [50, 75],               // e.g. satisfactory, and good values thresholds
        colors_transition : 0                       // <= 50 gradient size in percent of each section
      };
    },

    draw: function( o, p ) {
      var x = this.x, y = this.y
        , r = p.range, t = o.colors_transition / r, u = 100 / r - t
        , C = o.key_colors, l = C.length, V = o.key_values, L = V.length
        , g = this.orientation ? '0' : '90'
      ;
      l > L + 1 && ( l = L + 1 ); // too many key colors vs key values
      
      for ( var v, a = 0, i = -1; ++i < l; a = v ) {
        var s = i < L
          , b = s ? v = V[ i ] - p.min : r
          , c = '-' + C[ i ] + ':'
        ;
        
        i && ( g += c + Math.round( a * u + b * t ) );
        s && ( g += c + Math.round( a * t + b * u ) );
      }
      this.shape = p.paper
        .rect( x.start, y.stop, x.len, y.len )
        .attr( { gradient: g, stroke: 'none' } )
      ;
    }
  } );

  Ico.Component.components.graph_background = [Ico.Component.GraphBackground, 1];

  Ico.Component.Labels = Ico.Class.create( Ico.Component, {
    defaults: function( p ) {
      return {
          marker_size: 5 // 0 to disable
        , angle:       0 // degrees, clockwise
        , add_padding: true
        , position:    0  // labels position, 0 => ( left / bottom ), 1 => ( right / top )
                          // this is under development, so don't use it yet
        , grid:        p.options.grid
      }
    },
    
    process_options: function( o, p ) {
      var g = o.grid, title = o.title;
      
      g && (
        o.grid = Ico.extend( p.options.grid_attributes || {}, g === true ? {} : g )
      );
      
      Ico.extend( this.font = p.get_font(), o.font || {} );
      this.markers_attributes = { stroke: this.font.fill, 'stroke-width': 1 };
      Ico.extend( this.markers_attributes, o.markers_attributes );
      if ( title ) {
        this.title = title.value;
        Ico.extend( this.title_font = this.font, o.title_font );
      }
      this.x.angle = 0;
      this.y.angle = -90; // default vertical labels angle vs vertical axis
    },
    
    calculate: function( o ) { // value labels should overload without calling super
      this.calculate_labels_padding( this.graph.x, 1, o );
    },
    
    calculate_labels_padding: function( d, position, o ) {
      var dx = d.direction[0], dy = d.direction[1]
        , marker = o.marker_size, padding = []
      ;
      if ( ( d.labels = o.values ) === undefined ) {
        o.values = d.labels = [];
        for ( i = 0; ++i <= this.data_samples; ) d.labels[ i ] = i;
      }
      var angle = d.angle += o.angle;
      if ( d.labels ) {
        var bbox = this.get_labels_bounding_boxes( d ), font_size = d.font_size = bbox[1];
        if ( angle % 180 ) {
          angle = angle * Math.PI / 180;
          var sin = Math.abs( Math.sin( angle ) ), cos = Math.abs( Math.cos( angle ) );
          d.f = [font_size * cos / 2, font_size * sin / 2 + marker];
          padding[1] = Math.round( bbox[0] * sin + d.f[1] + d.f[0] );
          // padding[0] = Math.round( bbox[0] * cos + d.f[1] );
          if ( dx ) {
            angle < 0 ^ o.position && ( d.f[0] = -d.f[0] )
          } else {
            d.f = [-d.f[1], 0];
          }
          if ( this.p.vml ) { // Fix VML vs SVG text positionning
            var offset = 2.2; //+ font_size / 30;
            if ( dy ) angle += Math.PI / 2;
            d.f[0] -= offset * Math.sin( angle );
            d.f[1] += offset * Math.cos( angle )
          }
          d.anchor = dy? ( o.position? 'start' : 'end' )
           : ( angle > 0 ^ o.position? 'start' : 'end' )
        } else {
          // Labels parallel to axis
          var o = 0.6 * font_size + marker;
          d.f = [ dy * o, dx * o];
          padding[1] = bbox[1] * 1.1 + marker;
          // padding[0] = bbox[0] / 2;
          d.anchor = 'middle'
        }
      }
      var i = position ^ this.orientation ^ o.position;
      if ( o.add_padding ) {
        d.other.padding[i] += padding[1]
      } else if ( d.other.padding[i] < padding[1] ) {
        d.other.padding[i] = padding[1]
      }
    },
    
    get_labels_bounding_boxes: function( d ) {
      if ( this.labels ) return this.bbox;
      this.labels = []; this.bboxes = []; this.bbox = [0, 0];
      var t = this, longuest = 0; d.labels.forEach(
        function ( l ) {
          if ( typeof( l ) == 'undefined' ) l = "";
          t.labels.push( l = t.p.paper.text( 10, 10, l.toString() ).attr( t.font ) );
          t.bboxes.push( l = l.getBBox() );
          l.width > longuest && ( t.bbox = [longuest = l.width, l.height] )
        }
      );
      return this.bbox;
    },
    
    clear: function() {
      this.labels = null;
    },
    
    text_size: function( text, attr ) {
      var t = this.p.paper.text( 10, 10, '' ).attr( attr ).attr( { 'text' : text } );
      var d, bbox;
      //if ( this.vml ) {
        //t.shape.style.display = "inline";
        //d = [t.shape.offsetWidth, t.shape.offsetHeight];
      //} else {
        bbox = t.getBBox();
        d = [bbox.width, bbox.height];
      //}
      t.remove();
      return d;
    },
    
    draw: function( o ) { this.draw_labels_grid( this.graph.x, o ); },
    
    draw_labels_grid: function( d, o ) {
      var t = this, dx = d.direction[0], dy = d.direction[1], step = d.step,
          x = this.x.start + this.x.start_offset * dx,
          y = this.y.start - this.y.start_offset * dy,
          marker = o.marker_size, fx = d.f[0], fy = d.f[1], angle = d.angle,
          paper = this.p.paper, grid = o.grid
      ;
      if ( dy ) angle += 90;
      var path = [], grid_path = [];
      this.labels || this.get_labels_bounding_boxes( d );
      this.labels.forEach( function( label ) {
        marker &&    path.push( 'M', x, y, dx ? 'v' : 'h-', marker );
        grid && grid_path.push( 'M', x, y, dx ? 'v-' + t.y.len : 'h' + t.x.len );
        var x_anchor = x + fx;
        var y_anchor = y + fy;
        // label is already drawn, only anchor then rotate here
        label.attr( { x: x_anchor, y: y_anchor, 'text-anchor': d.anchor } ).toFront();
        // !!! set 'text-anchor' attribute before rotation
        angle && label.rotate( angle, x_anchor, y_anchor );  // !!! then rotate around anchor
        dx && ( x += step );
        dy && ( y -= step );
      } );
      marker && paper.path( Ico.svg_path( path ) ).attr( this.markers_attributes );
      if ( grid ) {
        dx && grid_path.push( 'M', this.x.start, ' ', this.y.stop, 'h', this.x.len, 'v', this.y.len );
        paper.path( Ico.svg_path( grid_path ) ).attr( grid );
      }
    }
  } );

  Ico.Component.components.labels = [Ico.Component.Labels, 3];

  Ico.Component.ValueLabels = Ico.Class.create( Ico.Component.Labels, {
    calculate: function( o, p ) {
      var t = this, max = p.max, min = p.min, range = max - min
        , spaces = o.spaces, params
      ;
      
      p.calculate_graph_len( this.graph.y );
      if ( ! spaces ) {
        // Calculate minimal step between labels
        var angle = Math.abs( o.angle ), min_step;
        if ( ( this.orientation && angle < 30 ) || ( !this.orientation && angle > 60 ) ) {
          min_step = Math.max.apply( Math, [min, max].map( function( v ) {
            return t.text_size(
              '0' + Ico.significant_digits_round( v, 3, Math.round, true ) + t.p.options.units,
              t.font
            )[0]
          } ) );
        } else {
          min_step = 1.5 * this.text_size( '0', this.font )[1]; // allow 1/2 character height spacing
        }
        // Calculate maximum number of labels spaces 
        spaces = Math.round( this.graph.y.len / min_step );
        // Search (trial/error method) for the best number of spaces yiedling the lowest waste 
        if ( spaces > 2 ) {
          var min_waste = range, max_spaces = spaces;
          for ( var tried_spaces = 1; ++tried_spaces <= max_spaces; ) {
            params = t.calculate_value_labels_params( min, max, range, tried_spaces );
            if ( params.waste <= min_waste ) {
              min_waste = params.waste;
              spaces = tried_spaces;
            }
          };
        }
      }
      params = this.calculate_value_labels_params( min, max, range, spaces );
      p.range = ( p.max = params.max ) - ( p.min = params.min );
      
      var p1000 = Ico.root( params.step * params.spaces, 1000 );
      if ( p1000 ) {
        var dividand = Math.pow( 1000, p1000 );
        params.step /= dividand;
        params.min /= dividand;
      };
      
      // Finally build value labels array
      var labels = o.values = [];
      var precision = 0;
      for ( var label = params.min, i = -1; ++i <= params.spaces; label += params.step ) {
        var l = Ico.significant_digits_round( label, 3, Math.round, true ).toString();
        var len = ( l + '.' ).split( '.' )[1].length;
        if ( len > precision ) precision = len; // get longuest precision
        labels.push( l );
      }
      // Then fix value labels precision and add units
      labels.forEach( function( l, i ) {
        var len = ( l + '.' ).split( '.' )[1].length;
        if ( len < precision ) {
          if ( len == 0 ) l += '.';
          l += '0000'.substring( 0, precision - len );
        }
        labels[i] = t.p.format_value( l, p1000 )
      } );
      
      this.graph.y.step = this.graph.y.len / params.spaces;
      this.calculate_labels_padding( this.graph.y, 0, o );
    },
    
    calculate_value_labels_params : function ( min, max, range, spaces ) {
      if ( min < 0 && max > 0 ) {
        var spaces_above_zero = Math.round( spaces * max / range );
        if ( spaces_above_zero == 0 ) {
          spaces_above_zero = 1;
        } else if ( spaces_above_zero == spaces ) {
          spaces_above_zero -= 1;
        }
        var spaces_under_zero = spaces - spaces_above_zero;
        var step = Ico.significant_digits_round( Math.max( max / spaces_above_zero, - min / spaces_under_zero ), 2,
          function( v ) { // the 2 digits rounding function
            v = Math.ceil( v );
            if ( v <= 10 ) return v;
            if ( v <= 12 ) return 12;
            var mod;
            // allows only multiples of five until 50 => allows 15, 20, 25, 30, 35, 40, 45, 50
            if ( v <= 54 ) return ( mod = v % 5 )? v - mod + 5 : v; // always round above
            // allow only multiples of 10 thereafter
            return ( mod = v % 10 )? v - mod + 10 : v
          }
        );
        min = -step * spaces_under_zero;
        max = step * spaces_above_zero;
      } else {
        var step = Ico.significant_digits_round( range / spaces, 1, Math.ceil );
        if ( max <= 0 ) min = max - step * spaces;
        else if ( min >= 0 ) max = min + step * spaces;
      }
      return { min: min, max: max, spaces: spaces, step: step, waste: spaces * step - range };
    },
    
    draw: function( o ) { this.draw_labels_grid( this.graph.y, o ) }
  } );

  Ico.Component.components.value_labels = [Ico.Component.ValueLabels, 4];

  Ico.Component.Meanline = Ico.Class.create( Ico.Component, {
    defaults: function() { return { attributes: { stroke: '#bbb', 'stroke-width': 2 } } },

    calculate: function() {
      var values = this.p.all_values;
      this.mean = values.reduce( function( sum, v ) { return sum + v }, 0 );
      de&&ug( "Ico.Component.Meanline, calculate, len: " + values.length + ", mean=" + this.mean );
      this.mean = Ico.significant_digits_round(
        this.mean / values.length, 3, Math.round, true
      );
      de&&ug( "Ico.Component.Meanline, calculate, len: " + values.length + ", mean=" + this.mean );
    },
    
    draw: function( o, p ) {
      var a = o.attributes;
      if ( ! a ) return;
      var mean = this.graph.y.start - p.plot( this.mean );
      this.graph.y.mean = { start: mean, stop: mean };
      this.graph.x.mean = this.graph.x; // for .start and .stop
      this.shape = p.paper.path( Ico.svg_path(
        ['M', this.x.mean.start, this.y.mean.start, 'L', this.x.mean.stop, this.y.mean.stop]
      ) ).attr( a );
      p.show_label_onmouseover( this.shape, this.mean, a, 0, 0, 'Average' );
    }
  } );

  Ico.Component.components.meanline = [Ico.Component.Meanline, 3];

  Ico.Component.FocusHint = Ico.Class.create( Ico.Component, {
    defaults: function() { return {
      length: 6,
      attributes: { 'stroke-width': 2, stroke: this.p.get_font().fill }
    } },
    
    draw: function( o, p ) {
      if ( p.min == 0 ) return;
      var len = o.length, l = Ico.svg_path( ['l', len, len] );
      this.shape = p.paper.path( Ico.svg_path( this.orientation ?
        ['M', this.x.start, this.y.start - len / 2, l, 'm0-', len, l] :
        ['M', this.x.start - len / 2, this.y.start - 2 * len, l + 'm-', len, ' 0' + l]
      ) ).attr( o.attributes );
    }
  } );

  Ico.Component.components.focus_hint = [Ico.Component.FocusHint, 5];

  Ico.Component.Axis = Ico.Class.create( Ico.Component, {
    defaults: function() { return { attributes: { stroke: '#666', 'stroke-width': 1 } } },
    draw: function( o ) {
      var x = this.x, y = this.y;
      this.shape = this.p.paper.path( Ico.svg_path( ['M', x.start, y.stop, 'v', y.len, 'h', x.len] ) )
      .attr( o.attributes );
    }  
  } );

  Ico.Component.components.axis = [Ico.Component.Axis, 4];
} )();
