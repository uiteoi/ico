/* Ico Graph Prototype/Raphael library
 *
 * Copyright (c) 2009, 2010, 2011 Jean Vincent, ReverseRisk
 * Copyright (c) 2009, Alex R. Young
 * Licensed under the MIT license: http://github.com/uiteoi/ico/blob/master/MIT-LICENSE
 */

"use strict";

var Ico = {
  Version: 0.97,
  
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
    initialize: function( element, series, options ) {
      if ( typeof element == "string" ) element = document.getElementById( element );
      this.element = element;
      this.series = series || [[0]];
      this.set_defaults();
      this.set_series();
      this.process_options( options );
      this.set_raphael();
      this.calculate();
      this.draw();
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
      this.options = {
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
      de&&ug( "options: width: " + this.options.width + ', height: ' + this.options.height + ', color: ' + this.options.color );
    },
    
    process_options: function( options ) {
      var that = this;
      
      if ( options ) Ico.extend( this.options, options );
      
      // Set min and max if overriden
      if ( typeof( this.options.min ) != 'undefined' ) this.min = Math.min( this.min, this.options.min ); 
      if ( typeof( this.options.max ) != 'undefined' ) this.max = Math.max( this.max, this.options.max );
      this.range = this.max - this.min;

      // Set x and y attributes
      this.x = { direction: [1,  0], start_offset: 0, width: this.options.width  };
      this.y = { direction: [0, -1], start_offset: 0, width: this.options.height };
      this.x.other = this.y; this.y.other = this.x;
      this.x.padding = [this.options.x_padding_left, this.options.x_padding_right];
      this.y.padding = [this.options.y_padding_top, this.options.y_padding_bottom];
      
      this.orientation = ( this.options.orientation || this.orientation || 0 );
      this.y_direction = this.orientation? -1 : 1;
      // this.graph.x => labels axis; this.graph.y => value labels axis
      this.graph = this.orientation? { x: this.y, y: this.x } : { x: this.x, y: this.y };
        
      // Scan components and process their options
      this.components = [];
      for ( var k in Ico.Component.components ) {
        if ( ! Ico.Component.components.hasOwnProperty( k ) ) continue;
        var a = that.options[k + '_attributes'], o = that.options[k], v = Ico.Component.components[k];
        if ( o === true && a ) o = that.options[k] = a;
        if ( o ) {
          var layer = v[1];
          if ( ! that.components[layer] ) that.components[layer] = [];
          try {
            that.components[layer].push( that[k] = new (v[0])( that, o ) )
          } catch( e ) {
            that.error = e;
            de&&ug( "process_options(), exception: " + e );
          }
        }
      };
    },
    
    get_font: function() {
      if( this.font ) return this.font;
      this.font = {
        'font-family': Ico.get_style( this.element, 'font-family' ),
        'font-size'  : this.options.font_size || Ico.get_style( this.element, 'font-size' ) || 10,
        fill         : Ico.get_style( this.element, 'color' ) || '#666',
        stroke       : 'none'
      };
      Ico.extend( this.font, this.options.font || {} );
      // this.graph.x.labels_font = this.graph.y.labels_font = this.font;
      return this.font
    },
    
    set_raphael: function() {
      if ( this.paper ) return;
      this.paper = Raphael( this.element, this.options.width, this.options.height );
      this.svg = ! ( this.vml = Raphael.vml );
    },
    
    clear: function() {
      if ( this.paper ) {
        this.components_call( 'clear' );
        this.paper.remove();
        this.paper = null;
      }
      return this
    },
    
    calculate: function() {
      this.paper || this.set_raphael();
      
      // component calculations may modify padding to make room for themselves
      this.components_call( 'calculate' );
      
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
    
    calculate_bars: function() {
      this.bar_width = this.graph.x.step - this.options.bar_padding;
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
      if ( this.options.units ) { // add units
        return this.options.units_position? v + this.options.units : this.options.units + v;
      }
      return v
    },

    draw: function() {
      this.paper || this.set_raphael();
      this.components_call( 'draw' );
      this.draw_series();
      return this
    },
    
    draw_series: function() {
      for ( var i = -1; ++i < this.series.length; ) {
        this.series_shapes[i] = {
          shape: this.draw_serie( this.series[i], i ),
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
    
    components_call: function( f ) {
      for( var i = -1; ++i < this.components.length; ) {
        var layer = this.components[i];
        if ( ! layer ) continue;
        for( var j = -1; ++j < layer.length; ) {
          var c = layer[j];
          try {
            c[f] && c[f]()
          } catch( e ) {
            this.set_raphael()
            this.errors = ( this.errors || 0 ) + 1;
            de&&ug( "Ico::Base::components_call(), exception " + e );
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
        var that = this, v = '';
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
          that.status_bar && that.status_bar.shape.hide();
          o.attr( attr );
        };
        
        o.node.onmouseover = function() {
          that.status_bar && that.status_bar.shape.attr( { 'text': v } ).show();
          o.attr( that.options.mouseover_attributes );
        };
    }
  } );

  Ico.SparkLine = Ico.Class.create( Ico.Base, {
    process_options: function( options ) {
      Ico.Base.prototype.process_options.call( this, options );
      
      this.graph.y.padding[1] += 1;
      var highlight = this.options.highlight;
      if ( highlight ) {
        this.highlight = { index: this.data_samples - 1, color: 'red', radius: 2 };
        Ico.extend( this.highlight, highlight == true? {} : highlight );
        if ( this.highlight.index == this.data_samples - 1  ) this.graph.x.padding[1] += this.highlight.radius + 1;
      }
    },
      
    label_slots_count: function() { return this.data_samples - 1 },
    
    draw_serie: function( serie ) {
      var that = this, x = this.x.start + this.x.start_offset, p;
      serie.forEach( function( v ) {
        p = Ico.svg_path(
          [( p ? p + 'L' : 'M' ), x, that.y.start + that.y.start_offset - that.plot( v )]
        );
        x += that.x.step;
      } );
      return this.paper.path( p ).attr( { stroke: this.options.color } );
    },
    
    draw_highlight: function() {
      var i = this.highlight.index;
      this.paper.circle(
        Math.round( this.x.start + this.x.start_offset + i * this.x.step ),
        Math.round( this.y.start + this.y.start_offset - this.plot( this.series[0][i] ) ),
        this.highlight.radius
      ).attr( { stroke: 'none', fill: this.highlight.color } );
    }
  } );

  Ico.SparkBar = Ico.Class.create( Ico.SparkLine, {
    label_slots_count: function() { return this.data_samples },

    calculate: function() {
      Ico.SparkLine.prototype.calculate.call( this );
      
      this.calculate_bars()
    },

    draw_serie: function( serie ) {
      var that = this, x = this.x.start + this.x.start_offset, p = '';
      serie.forEach( function( v ) {
        p += Ico.svg_path( ['M', x, that.bar_base, 'v', - that.scale * v ] );
        x += that.x.step;
      } )
      return this.paper.path( p ).attr( { 'stroke-width': this.graph.x.step, stroke: this.options.color } );
    },
    
    draw_highlight: function() {
      var i = this.highlight.index;
      this.paper.path( Ico.svg_path( [
        'M', this.x.start + this.x.start_offset + i * this.x.step, this.bar_base,
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
    
    process_options: function( options ) {
      Ico.Base.prototype.process_options.call( this, options );
      
      this.target = { color: '#666', length: 0.8, 'stroke-width' : 2 };
      if ( typeof this.options.target === "number" ) {
        this.target.value = this.options.target
      } else {
        Ico.extend( this.target, this.options.target || {} );
      }
    },
    
    label_slots_count: function() { return 1 },
    
    calculate: function() {
      Ico.Base.prototype.calculate.call( this );
      
      this.options.bar_padding || ( this.options.bar_padding = 2 * this.graph.x.len / 3 );
      this.calculate_bars()
    },
    
    draw_series: function() {
      var x = this.x.start + this.x.start_offset,
          y = this.y.start + this.y.start_offset,
          value = this.series[0][0]
      ;
      
      // this is a bar value => new Ico.Serie.Line(serie).draw()
      var a, p = this.series_shapes[0] = this.paper.path( Ico.svg_path(
        ['M', x - this.plot( value ), y - this.bar_width / 2,
         'H', this.bar_base, 'v', this.bar_width,
         'H', x - this.plot( value ), 'z']
      ) ).attr( a = { fill: this.options.color, 'stroke-width' : 1, stroke: 'none' } );

      this.show_label_onmouseover( p, value, a, 0, 0 );
      
      // target should be a component, or might be a graph background option
      if ( typeof( this.target.value ) != 'undefined' ) {
        var padding = 1 - this.target.length;
        this.paper.path( Ico.svg_path(
          ['M', x - this.plot( this.target.value ), this.y.len * padding / 2, 'v', this.y.len * ( 1 - padding )]
        ) ).attr( { stroke: this.target.color, 'stroke-width' : this.target['stroke-width'] } )
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
      var that = this, min_max = Ico.adjust_min_max( this.min, this.max );
      this.min = min_max[0];
      this.max = min_max[1];
      
      // !! process superclass options after min and max adjustments
      Ico.Base.prototype.process_options.call( this, options );
      
      // Set default colors[] for individual series
      this.series.forEach( function( serie, i ) {
        that.options.colors[i] || (
          that.options.colors[i] = that.options.color || Raphael.hsb2rgb( Math.random(), 1, .75 ).hex
        )
      } );
    },
    
    draw_serie: function( serie, index ) {
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
          path += this.draw_value( i, x, y - this.scale * v, v, index, set );
        }
        x += this.y_direction * this.graph.x.step;
      };
      if ( path != '' ) { // only for line graphs
        p.attr( { path: path } ).attr( this.options.series_attributes[index] ||
          { stroke: this.options.colors[index], 'stroke-width': this.options.stroke_width || 3 }
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
      
      var that = this;
      
      this.series.forEach( function( serie, i ) {
        var color = that.options.colors[i];
        
        if ( ! that.options.series_attributes[i] ) {
          that.options.series_attributes[i] = {
            stroke: color, 'stroke-width': 2
          };
        }
        // line dots attribute apply only to line series
        if ( ! that.options.dot_attributes[i] ) {
          that.options.dot_attributes[i] = {
            'stroke-width': 1,
            stroke: that.background ? that.background.options.color : color,
            fill: color
          };
        }
      } );
    },
    
    label_slots_count: function() { return this.data_samples - 1 },

    draw_value: function( i, x, y, value, serie, set ) {
      var radius = this.options.dot_radius,
          focus  = this.options.focus_radius,
          t
      ;
          
      this.orientation && ( t = x, x = y, y = t );
      
      if ( typeof radius == 'object' ) radius = radius[ serie ]; 
      if ( radius ) {
        set.push( this.paper.circle( x, y, radius ).attr( this.options.dot_attributes[ serie ] ) );
      }
      
      if ( typeof focus == 'object' ) focus = focus[ serie ];
      if ( focus ) {
        var a = this.options.focus_attributes,
            c = this.paper.circle( x, y, focus ).attr( a )
        ;
        set.push( c );
        this.show_label_onmouseover( c, value, a, serie, i );
      }
      
      var p, w = this.options.curve_amount;
      if ( i == 0 || ( w && this.last == null ) ) {
        p = ['M', x, y];
      } else if ( w ) {
        serie = this.series[serie];
        // Calculate cubic Bezier control points relative coordinates based on the two previous, current
        // and next points
        var scale = this.scale * w / 2 / this.graph.x.step,
          ym1 = serie[i - 1], ym2 = serie[i - 2], y0 = serie[i], y1 = serie[i + 1],
          d = [
            [w, ( ym2? ( ym2 - y0 ) : ( ym1 - y0 ) * 2 ) * scale],
            [w, ( y1 ? ( ym1 - y1 ) : ( ym1 - y0 ) * 2 ) * scale]
          ]
        ;
        this.orientation && ( d = [[d[0][1], -w], [d[1][0]], -w] );
        // Display control points and lines
        //if ( serie === this.series[0] ) {
        //  this.paper.circle( this.last[0] + d[0][0], this.last[1] + d[0][1], 1 ).attr( { 'stroke':'black' } );
        //  this.paper.path( Ico.svg_path( ['M', this.last[0], this.last[1], 'l', d[0][0], d[0][1] ] ) ).attr( { 'stroke':'black' } );
        //  this.paper.circle( x - d[1][0], y - d[1][1], 1 ).attr( { 'stroke':'red' } );
        //  this.paper.path( Ico.svg_path( ['M', x, y, 'l', - d[1][0], - d[1][1] ] ) ).attr( { 'stroke':'red' } );
        //}
        p = ["C", this.last[0] + d[0][0], this.last[1] + d[0][1], x - d[1][0], y - d[1][1], x, y];
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
      
      this.options.bar_padding = 5;
    },
    
    process_options: function( options ) {
      Ico.BaseGraph.prototype.process_options.call( this, options );
      
      var that = this;
      
      this.series.forEach( function( serie, i ) {
        var color = that.options.colors[i];
        if ( ! that.options.series_attributes[i] ) {
          that.options.series_attributes[i] = {
            stroke: 'none', 'stroke-width': 2,
            gradient: '' + ( that.orientation ? 270 : 0 ) + '-' + color + ':20-#555555'
          };
        }
      } );
    },
    
    calculate: function() {
      Ico.BaseGraph.prototype.calculate.call( this );
      
      this.calculate_bars()
    },
    
    label_slots_count: function() { return this.data_samples },
    
    draw_value: function( i, x, y, v, serie, set ) {
      var a = this.options.series_attributes[serie],
        sup = this.series.length + 1,
        w = this.bar_width,
        width = w * 2 / sup,
        base = this.bar_base,
        bar
      ;
      x += w * serie / sup - w / 2;
      this.show_label_onmouseover( bar = this.paper.path( Ico.svg_path( this.orientation?
          ['M', y, x, 'H', base, 'v', width, 'H', y, 'z'] :
          ['M', x, y, 'V', base, 'h', width, 'V', y, 'z']
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
    initialize: function( p, options ) {
      Ico.extend( this, {
        p           : p,
        graph       : p.graph,
        x           : p.x,
        y           : p.y,
        orientation : p.orientation
      } );
      if( Ico.isArray( options ) ) options = { values: options };
      else if( typeof options === "number" || typeof options === "string" ) options = { value: options };
      this.options = Ico.extend( this.defaults(), options );
      this.process_options();
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
    
    process_options: function() {
      if ( this.options.color && ! this.options.attributes ) {
        this.options.attributes = { stroke: 'none', fill: this.options.color };
      }
      if ( this.options.attributes ) this.options.color = this.options.attributes.fill;
      if ( this.options.corners === true ) this.options.corners = Math.round( this.p.options.height / 20 );
    },
    
    draw: function() {
      this.shape = this.p.paper.rect( 0, 0, this.p.options.width, this.p.options.height, this.options.corners )
      .attr( this.options.attributes );
    }
  } );

  Ico.Component.components.background = [Ico.Component.Background, 0];

  Ico.Component.StatusBar = Ico.Class.create( Ico.Component, {
    defaults: function() { return { attributes: { 'text-anchor': 'end' } } },
    
    draw: function() {
      this.shape = this.p.paper.text(
        this.options.x || this.p.options.width - 10,
        this.options.y || ( this.y ? this.y.padding[0] : this.p.options.height ) / 2,
      '' ).hide().attr( this.options.attributes );
    }
  } );

  Ico.Component.components.status_bar = [Ico.Component.StatusBar, 2];

  Ico.Component.MousePointer = Ico.Class.create( Ico.Component, {
    defaults: function() { return { attributes: { stroke: '#666', 'stroke-dasharray': '--' } } },

    draw: function() {
      if ( ! Ico.viewport_offset ) return;
      
      var that = this;
      
      this.shape = this.p.paper.path().attr( this.options.attributes ).hide();
      
      this.p.element.onmousemove = function( e ) {
        e || ( e = window.event );
        var viewport_offset = Ico.viewport_offset( that.p.element );
        var x = e.clientX - viewport_offset[0];
        var y = e.clientY - viewport_offset[1];
        // Google chrome: if the view does not start at 0, 0, there is an offset
        // IE: Slow moves
        // FF provides the best result with smooth moves
        var in_graph = x >= that.x.start && x <= that.x.stop && y >= that.y.stop  && y <= that.y.start;
        if ( in_graph ) {
          that.shape.attr( { path: Ico.svg_path( [
            'M', that.x.start, y, 'h', that.x.len,
            'M', x, that.y.stop , 'v', that.y.len
          ] ) } ).show();
        } else {
          that.shape.hide();
        }
      };
      
      this.p.element.onmouseout = function( e ) { that.shape.hide() };
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

    draw: function() {
      // Calculate background gradient
      var l = this.options.colors_transition, u = 100 - l, g = this.orientation ? '0' : '90';
      var v = this.options.key_values, colors = this.options.key_colors;
      for ( var a = 0, i = -1; ++i < colors.length; ) {
        if ( i > v.length ) break; // too many colors vs values
        var b = ( i < v.length ? v[i] : this.p.max ) - this.p.min;
        if ( i ) {
          a = v[i - 1] - this.p.min;
          g += '-' + colors[i] + ':' + Math.round( ( a * u + b * l ) / this.p.range );
        }
        if ( i < v.length ) g += '-' + colors[i] + ':' + Math.round( ( a * l + b * u ) / this.p.range );
      }
      this.shape = this.p.paper.rect( this.x.start, this.y.stop, this.x.len, this.y.len )
      .attr( { gradient: g, stroke: 'none', 'stroke-width': 0 } );
    }
  } );

  Ico.Component.components.graph_background = [Ico.Component.GraphBackground, 1];

  Ico.Component.Labels = Ico.Class.create( Ico.Component, {
    defaults: function() { return {
      marker_size: 5, // 0 to disable
      angle:       0, // degrees, clockwise
      add_padding: true,
      position:    0  // labels position, 0 => ( left / bottom ), 1 => ( right / top )
                      // this is under development, so don't use it yet
    } },
    
    process_options: function( options ) {
      Ico.extend( this.font = this.p.get_font(), this.options.font || {} );
      this.markers_attributes = { stroke: this.font.fill, 'stroke-width': 1 };
      Ico.extend( this.markers_attributes, this.options.markers_attributes );
      if ( this.options.title ) {
        var title = this.options.title;
        this.title = title.value;
        Ico.extend( this.title_font = this.font, this.options.title_font );
      }
      this.x.angle = 0;
      this.y.angle = -90; // default vertical labels angle vs vertical axis
    },
    
    calculate: function() { // value labels should overload without calling super
      this.calculate_labels_padding( this.graph.x, 1 );
    },
    
    calculate_labels_padding: function( d, position ) {
      var dx = d.direction[0], dy = d.direction[1], marker = this.options.marker_size, padding = [];
      if ( ( d.labels = this.options.values ) === undefined ) {
        this.options.values = d.labels = [];
        for ( i = 0; ++i <= this.data_samples; ) d.labels[ i ] = i;
      }
      var angle = d.angle += this.options.angle;
      if ( d.labels ) {
        var bbox = this.get_labels_bounding_boxes( d ), font_size = d.font_size = bbox[1];
        if ( angle % 180 ) {
          angle = angle * Math.PI / 180;
          var sin = Math.abs( Math.sin( angle ) ), cos = Math.abs( Math.cos( angle ) );
          d.f = [font_size * cos / 2, font_size * sin / 2 + marker];
          padding[1] = Math.round( bbox[0] * sin + d.f[1] + d.f[0] );
          // padding[0] = Math.round( bbox[0] * cos + d.f[1] );
          if ( dx ) {
            angle < 0 ^ this.options.position && ( d.f[0] = -d.f[0] )
          } else {
            d.f = [-d.f[1], 0];
          }
          if ( this.p.vml ) { // Fix VML vs SVG text positionning
            var offset = 2.2; //+ font_size / 30;
            if ( dy ) angle += Math.PI / 2;
            d.f[0] -= offset * Math.sin( angle );
            d.f[1] += offset * Math.cos( angle )
          }
          d.anchor = dy? ( this.options.position? 'start' : 'end' )
           : ( angle > 0 ^ this.options.position? 'start' : 'end' )
        } else {
          // Labels parallel to axis
          var o = 0.6 * font_size + marker;
          d.f = [ dy * o, dx * o];
          padding[1] = bbox[1] * 1.1 + marker;
          // padding[0] = bbox[0] / 2;
          d.anchor = 'middle'
        }
      }
      var i = position ^ this.orientation ^ this.options.position;
      if ( this.options.add_padding ) {
        d.other.padding[i] += padding[1]
      } else if ( d.other.padding[i] < padding[1] ) {
        d.other.padding[i] = padding[1]
      }
    },
    
    get_labels_bounding_boxes: function( d ) {
      if ( this.labels ) return this.bbox;
      this.labels = []; this.bboxes = []; this.bbox = [0, 0];
      var that = this, longuest = 0; d.labels.forEach(
        function ( l ) {
          if ( typeof( l ) == 'undefined' ) l = "";
          that.labels.push( l = that.p.paper.text( 10, 10, l.toString() ).attr( that.font ) );
          that.bboxes.push( l = l.getBBox() );
          l.width > longuest && ( that.bbox = [longuest = l.width, l.height] )
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
    
    draw: function() { this.draw_labels_grid( this.graph.x ); },
    
    draw_labels_grid: function( d ) {
      var that = this, dx = d.direction[0], dy = d.direction[1], step = d.step,
          x = this.x.start + this.x.start_offset * dx,
          y = this.y.start - this.y.start_offset * dy,
          marker = this.options.marker_size,
          fx = d.f[0], fy = d.f[1], angle = d.angle,
          options = this.p.options, paper = this.p.paper,
          grid = this.options.grid || options.grid
      ;
      if ( dy ) angle += 90;
      var path = [], grid_path = [];
      this.labels || this.get_labels_bounding_boxes( d );
      this.labels.forEach( function( label ) {
        if ( marker )    path.push( 'M', x, y, dx ? 'v' : 'h-', marker );
        if ( grid ) grid_path.push( 'M', x, y, dx ? 'v-' + that.y.len : 'h' + that.x.len );
        var x_anchor = x + fx;
        var y_anchor = y + fy;
        // label is already drawn, only anchor then rotate here
        label.attr( { x: x_anchor, y: y_anchor, 'text-anchor': d.anchor } ).toFront();
        // !!! set 'text-anchor' attribute before rotation
        angle && label.rotate( angle, x_anchor, y_anchor );  // !!! then rotate around anchor
        dx && ( x += step );
        dy && ( y -= step );
      } );
      if ( marker ) paper.path( Ico.svg_path( path ) ).attr( this.markers_attributes );
      if ( grid ) {
        if ( dx ) grid_path.push( 'M', this.x.start, ' ', this.y.stop, 'h', this.x.len, 'v', this.y.len );
        paper.path( Ico.svg_path( grid_path ) ).attr( this.options.grid_attributes || options.grid_attributes );
      }
    }
  } );

  Ico.Component.components.labels = [Ico.Component.Labels, 3];

  Ico.Component.ValueLabels = Ico.Class.create( Ico.Component.Labels, {
    calculate: function() {
      var that = this, max = this.p.max, min = this.p.min, range = max - min,
          spaces = this.options.spaces,
          params;
      
      this.p.calculate_graph_len( this.graph.y );
      if ( ! spaces ) {
        // Calculate minimal step between labels
        var angle = Math.abs( this.options.angle ), min_step;
        if ( ( this.orientation && angle < 30 ) || ( !this.orientation && angle > 60 ) ) {
          min_step = Math.max.apply( Math, [min, max].map( function( v ) {
            return that.text_size(
              '0' + Ico.significant_digits_round( v, 3, Math.round, true ) + that.p.options.units,
              that.font
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
            params = that.calculate_value_labels_params( min, max, range, tried_spaces );
            if ( params.waste <= min_waste ) {
              min_waste = params.waste;
              spaces = tried_spaces;
            }
          };
        }
      }
      params = this.calculate_value_labels_params( min, max, range, spaces );
      this.p.range = ( this.p.max = params.max ) - ( this.p.min = params.min );
      
      var p1000 = Ico.root( params.step * params.spaces, 1000 );
      if ( p1000 ) {
        var dividand = Math.pow( 1000, p1000 );
        params.step /= dividand;
        params.min /= dividand;
      };
      
      // Finally build value labels array
      var labels = this.options.values = [];
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
        labels[i] = that.p.format_value( l, p1000 )
      } );
      
      this.graph.y.step = this.graph.y.len / params.spaces;
      this.calculate_labels_padding( this.graph.y, 0 );
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
    
    draw: function() { this.draw_labels_grid( this.graph.y ) }
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
    
    draw: function() {
      var a = this.options.attributes;
      if ( ! a ) return;
      var mean = this.graph.y.start - this.p.plot( this.mean );
      this.graph.y.mean = { start: mean, stop: mean };
      this.graph.x.mean = this.graph.x; // for .start and .stop
      this.shape = this.p.paper.path( Ico.svg_path(
        ['M', this.x.mean.start, this.y.mean.start, 'L', this.x.mean.stop, this.y.mean.stop]
      ) ).attr( a );
      this.p.show_label_onmouseover( this.shape, this.mean, a, 0, 0, 'Average' );
    }
  } );

  Ico.Component.components.meanline = [Ico.Component.Meanline, 3];

  Ico.Component.FocusHint = Ico.Class.create( Ico.Component, {
    defaults: function() { return {
      length: 6,
      attributes: { 'stroke-width': 2, stroke: this.p.get_font().fill }
    } },
    
    draw: function() {
      if ( this.p.min == 0 ) return;
      var len = this.options.length, l = Ico.svg_path( ['l', len, len] );
      this.shape = this.p.paper.path( Ico.svg_path( this.orientation ?
        ['M', this.x.start, this.y.start - len / 2, l, 'm0-', len, l] :
        ['M', this.x.start - len / 2, this.y.start - 2 * len, l + 'm-', len, ' 0' + l]
      ) ).attr( this.options.attributes );
    }
  } );

  Ico.Component.components.focus_hint = [Ico.Component.FocusHint, 5];

  Ico.Component.Axis = Ico.Class.create( Ico.Component, {
    defaults: function() { return { attributes: { stroke: '#666', 'stroke-width': 1 } } },
    draw: function() {
      this.shape = this.p.paper.path( Ico.svg_path( ['M', this.x.start, this.y.stop, 'v', this.y.len, 'h', this.x.len] ) )
      .attr( this.options.attributes );
    }  
  } );

  Ico.Component.components.axis = [Ico.Component.Axis, 4];
} )();
