/* Ico Graph Prototype/Raphael library
 *
 * Copyright (c) 2009, Jean Vincent
 * Copyright (c) 2009, Alex R. Young
 * Licensed under the MIT license: http://github.com/uiteoi/ico/blob/master/MIT-LICENSE
 */
var Ico = {
  Version: 0.95,
  
  significant_digits_round: function( v, significant_digits, f, string ) {
    if ( v == 0 ) return 0;
    var sign = 1;
    if ( v < 0 ) v = -v, sign = -1;
    var limit = Math.pow( 10, significant_digits ), p10 = 0;
    while ( v >= limit ) v /= 10, p10 += 1;
    limit /= 10;
    while ( v < limit ) v *= 10, p10 -= 1;
    v = ( f? f : Math.round )( sign * v );
    if ( string && p10 < 0 ) {
      v = sign * v;
      v = '' + v;
      var len = v.length;
      while ( v.substring( len - 1 ) == '0' ) { p10 += 1; v = v.substring( 0, len -= 1 ); }
      if ( ( len += p10 ) <= 0 ) {
        return ( sign < 0 ? '-' : '' ) + '0.00000000000'.substring(0, 2 - len ) + v;
      } else if ( p10 < 0 ) {
        return ( sign < 0 ? '-' : '' ) + v.substring( 0, len ) + '.' + v.substring( len );
      }
      v = sign * v;
    }
    return v * Math.pow( 10, p10 );
  },
  
  svg_path: function( a ) {
    var path = '', previous_isNumber = false;
    $A( a ).each( function( v ) {
      if ( Object.isNumber( v ) ) {
        if ( previous_isNumber ) path += ' ';
        path += Math.round( v );
        previous_isNumber = true;
      } else {
        path += v;
        previous_isNumber = false;
      }
    } );
    return path;
  }
};

Ico.Base = Class.create( {
  initialize: function( element, series, options ) {
    this.element = element;
    this.series = series || [[]];
    this.set_defaults();
    this.set_series();
    this.process_options( options );
    this.set_raphael();
    this.calculate();
    this.draw();
    return this;
  },
  
  set_series: function() {
    if ( Object.isArray( this.series ) ) {
      if ( ! Object.isArray( this.series[0] ) ) this.series = [this.series];
    } else if ( Object.isNumber( this.series ) ) {
      this.series = [[this.series]];
    } else { // this is a hash { serie_name : [list of values] } (deprecated)
      // Transform to array of arrays
      var series =[];
      $H( this.series ).keys().each( function( key ) {
        series.push( this.series[key] ); 
      }.bind( this ) )
      this.series = series;
    }
    this.data_samples = this.series.pluck( 'length' ).max();
    var all_values = this.all_values = this.series.flatten();
    this.max = Ico.significant_digits_round( all_values.max(), 2, Math.ceil );
    this.min = Ico.significant_digits_round( all_values.min(), 2, Math.floor );
    this.range = this.max - this.min;
  },
  
  set_defaults: function() {
    this.options = {
      // Canvas dimensions
      width:                parseInt( this.element.getStyle( 'width'  ) ) -1,
      height:               parseInt( this.element.getStyle( 'height' ) ) -1,
      // Padding
      x_padding_left:       0,
      x_padding_right:      0,
      y_padding_top:        0,
      y_padding_bottom:     0,
      // Attributes
      color:                this.element.getStyle( 'color' ),
      mouseover_attributes: { stroke: 'red' },
      // Units
      units:                '',
      units_position:       1   // 0 => before value e.g. $34, 1 => after value e.g. 45%.
    };
  },
  
  process_options: function( options ) {
    if ( options ) Object.extend( this.options, options );
    
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
    Ico.Component.components.each( function( c ) {      
      var k = c.key, a = this.options[k + '_attributes'], o = this.options[k];
      if ( o === true && a ) o = this.options[k] = a;
      if ( o ) {
        var layer = c.value[1];
        if ( ! this.components[layer] ) this.components[layer] = [];
        try {
          this.components[layer].push( this[k] = new (c.value[0])( this, o ) )
        } catch( error ) {
          this.error = error
        }
      }
    }.bind( this ) );
  },
  
  get_font: function() {
    if( this.font ) return this.font;
    this.font = {
      'font-family': this.element.getStyle( 'font-family' ),
      'font-size'  : this.options.font_size || this.element.getStyle( 'font-size' ) || 10,
      fill         : this.element.getStyle( 'color' ) || '#666',
      stroke       : 'none'
    };
    Object.extend( this.font, this.options.font || {} );
    // this.graph.x.labels_font = this.graph.y.labels_font = this.font;
    return this.font
  },
  
  set_raphael: function() {
    if ( this.paper ) return;
    this.paper = Raphael( this.element, this.options.width, this.options.height );
    this.svg = ! ( this.vml = Raphael.vml );
  },
  
  clear: function() {
    this.components_call( 'clear' );
    this.paper.remove();
    this.paper = null;
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
  
  format_value: function( v ) {
    if ( this.options.units ) { // add units
      return this.options.units_position? '' + v + this.options.units : this.options.units + v;
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
    this.series.each( this.draw_serie.bind( this ) )
    this.highlight && this.draw_highlight(); // make highlight a component
  },
  
  components_call: function( f ) {
    for( var i = -1; ++i < this.components.length; ) {
      var layer = this.components[i];
      if ( ! layer ) continue;
      for( var j = -1; ++j < layer.length; ) {
        var c = layer[j];
        try {
          c[f] && c[f]()
        } catch( error ) {
          this.set_raphael()
          this.errors = ( this.errors || 0 ) + 1;
          this.paper.text( 0, 12 * this.errors, "Error in " + f + "(): " + ( this.error = error ) )
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

  show_label_onmouseover : function( o, label, attr ) {
      o.node.onmouseout = function() {
        this.status_bar && this.status_bar.shape.attr( { text: '' } ).hide();
	o.attr( attr );
        // this.paper.safari();
      }.bind( this );
      
      o.node.onmouseover = function() {
        label && this.status_bar && this.status_bar.shape.attr( { 'text': label } ).show();
        o.attr( this.options.mouseover_attributes );
        // this.paper.safari();
      }.bind( this );
  }
} );

Ico.SparkLine = Class.create( Ico.Base, {
  process_options: function( $super, options ) { $super( options );
    this.graph.y.padding[1] += 1;
    var highlight = this.options.highlight;
    if ( highlight ) {
      this.highlight = { index: this.data_samples - 1, color: 'red', radius: 2 };
      Object.extend( this.highlight, highlight == true? {} : highlight );
      if ( this.highlight.index == this.data_samples - 1  ) this.graph.x.padding[1] += this.highlight.radius + 1;
    }
  },
    
  label_slots_count: function() { return this.data_samples - 1 },
  
  draw_serie: function( serie ) {
    var x = this.x.start + this.x.start_offset, p;
    serie.each( function( v ) {
      p = Ico.svg_path(
        [( p ? p + 'L' : 'M' ), x, this.y.start + this.y.start_offset - this.plot( v )]
      );
      x += this.x.step;
    }.bind( this ) );
    this.paper.path( p ).attr( { stroke: this.options.color } );
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

Ico.SparkBar = Class.create( Ico.SparkLine, {
  label_slots_count: function() { return this.data_samples },

  calculate: function( $super ) { $super();
    this.calculate_bars()
  },

  draw_serie: function( serie ) {
    var x = this.x.start + this.x.start_offset, p = '';
    serie.each( function( v ) {
      p += Ico.svg_path( ['M', x, this.bar_base, 'v', - this.scale * v ] );
      x += this.x.step;
    }.bind( this ) )
    this.paper.path( p ).attr( { 'stroke-width': this.graph.x.step, stroke: this.options.color } );
  },
  
  draw_highlight: function() {
    var i = this.highlight.index;
    this.paper.path( Ico.svg_path( [
      'M', this.x.start + this.x.start_offset + i * this.x.step, this.bar_base,
      'v', - this.scale * this.series[0][i]
    ] ) ).attr( { 'stroke-width': this.graph.x.step, stroke: this.highlight.color } );
  }
} );

Ico.BulletGraph = Class.create( Ico.Base, {
  set_series: function( $super ) { $super();
    this.value  = this.series[[0]] || 50;
  },
  
  set_defaults: function( $super ) { $super();
    this.orientation = 1;
    
    Object.extend( this.options, {
      min              : 0,
      max              : 100,
      color            : '#33e',
      graph_background : true
    })
  },
  
  process_options: function( $super, options ) { $super( options );
    this.range = ( this.max = this.options.max ) - ( this.min = this.options.min );
    this.target = { color: '#666', length: 0.8, 'stroke-width' : 2 };
    if ( Object.isNumber( this.options.target ) ) {
      this.target.value = this.options.target
    } else {
      Object.extend( this.target, this.options.target || {} );
    }
  },
  
  label_slots_count: function() { return 1 },
  
  calculate: function( $super ) { $super();  
    this.options.bar_padding || ( this.options.bar_padding = 2 * this.graph.x.len / 3 );
    this.calculate_bars()
  },
  
  draw_series: function() {
    var x = this.x.start + this.x.start_offset;
    var y = this.y.start + this.y.start_offset;
    
    // this is a bar value => new Ico.Serie.Line(serie).draw()
    var a, p = this.paper.path( Ico.svg_path(
      ['M', x - this.plot( this.value ), y - this.bar_width / 2,
       'H', this.bar_base, 'v', this.bar_width,
       'H', x - this.plot( this.value ), 'z']
    ) ).attr( a = { fill: this.options.color, 'stroke-width' : 1, stroke: 'none' } );
    
    this.show_label_onmouseover( p, this.format_value( this.value ), a );
    
    // target should be a component
    if ( typeof( this.target.value ) != 'undefined' ) {
      var padding = 1 - this.target.length;
      this.paper.path( Ico.svg_path(
        ['M', x - this.plot( this.target.value ), this.y.len * padding / 2, 'v', this.y.len * ( 1 - padding )]
      ) ).attr( { stroke: this.target.color, 'stroke-width' : this.target['stroke-width'] } )
    }
  }
} );
 
Ico.BaseGraph = Class.create( Ico.Base, {
  set_series: function( $super ) { $super();
    var min = this.min, max = this.max, range = this.range;
    // Adjust start value to show zero if reasonable (e.g. range < min)
    if ( range < min ) {
      min -= range / 2;
    } else if ( min > 0 ) {
      min = 0;
    } else if ( range < -max ) {
      max += range / 2;
    } else if ( max < 0 ) {
      max = 0;
    }
    this.range = ( this.max = max ) - ( this.min = min );
  },
  
  set_defaults: function( $super ) { $super();
    Object.extend( this.options, {
      // Padding options
      x_padding_left:           10,
      x_padding_right:          20,
      y_padding_top:            20,
      y_padding_bottom:         10,
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
  
  process_options: function( $super, options ) { $super( options );
    // Set default colors[] for individual series
    this.series.each( function( serie, i ) {
      this.options.colors[i] || (
        this.options.colors[i] = this.options.color || Raphael.hsb2rgb( Math.random(), 1, .75 ).hex
      )
    }.bind( this) );
  },
  
  draw_serie: function( serie, index ) {
    var x = this.graph.x.start + this.graph.x.start_offset,
        y = this.graph.y.start + this.graph.y.start_offset + this.scale * this.min,
        p = this.paper.path(),
        path = ''
    ;
    serie.each( function( v, i ) {  
      path += this.draw_value( i, x, y - this.scale * v, v, index );
      x += this.y_direction * this.graph.x.step;
    }.bind( this ) );
    if ( path != '' ) { // only for line graphs
      p.attr( { path: path } ).attr( this.options.series_attributes[index] ||
        { stroke: this.options.colors[index], 'stroke-width': this.options.stroke_width || 3 }
      );
    }
  }  
} );

Ico.LineGraph = Class.create( Ico.BaseGraph, {
  set_defaults: function( $super ) { $super();
    Object.extend( this.options, {
      curve_amount:     5,  // 0 => disable
      dot_radius:       3,  // 0 => no dot
      dot_attributes:   [], // List of attributes for dots
      focus_radius:     6,  // 0 => disable mouseover action
      focus_attributes: { stroke: 'none', 'fill': 'white',  'fill-opacity' : 0 }
    }
  ) },
  
  process_options: function( $super, options ) { $super( options );
    this.series.each( function( serie, i ) {
      var color = this.options.colors[i];
      
      if ( ! this.options.series_attributes[i] ) {
        this.options.series_attributes[i] = {
          stroke: color, 'stroke-width': 2
        };
      }
      // line dots attribute apply only to line series
      if ( ! this.options.dot_attributes[i] ) {
        this.options.dot_attributes[i] = {
          'stroke-width': 1,
          stroke: this.background ? this.background.options.color : color,
          fill: color
        };
      }
    }.bind( this) );
  },
  
  label_slots_count: function() { return this.data_samples - 1 },

  draw_value: function( i, x, y, value, serie ) {
    var radius = this.options.dot_radius, focus = this.options.focus_radius;
    var t; this.orientation && ( t = x, x = y, y = t );
    radius && this.paper.circle( x, y, radius ).attr( this.options.dot_attributes[serie] );
    if ( focus ) {
      var a = this.options.focus_attributes;
      this.show_label_onmouseover(
        this.paper.circle( x, y, focus ).attr( a ), this.format_value( value ), a
      );
    }
    var p, w = this.options.curve_amount;
    if ( i == 0 ) {
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

Ico.BarGraph = Class.create( Ico.BaseGraph, {
  set_defaults: function( $super ) { $super();
    this.options.bar_padding = 5;
  },
  process_options: function( $super, options ) { $super( options );
    this.series.each( function( serie, i ) {
      var color = this.options.colors[i];
      if ( ! this.options.series_attributes[i] ) {
        this.options.series_attributes[i] = {
          stroke: 'none', 'stroke-width': 2,
          gradient: '' + ( this.orientation ? 270 : 0 ) + '-' + color + ':20-#555555'
        };
      }
    }.bind( this) );
  },
  
  calculate: function( $super ) { $super();
    this.calculate_bars()
  },
  
  label_slots_count: function() { return this.data_samples },
  
  draw_value: function( i, x, y, v, serie ) {
    var a = this.options.series_attributes[serie],
      sup = this.series.length + 1
      w = this.bar_width,
      width = w * 2 / sup,
      x += w * serie / sup - w / 2,
      base = this.bar_base
    ;
    this.show_label_onmouseover( this.paper.path( Ico.svg_path( this.orientation?
        ['M', y, x, 'H', base, 'v', width, 'H', y, 'z'] :
        ['M', x, y, 'V', base, 'h', width, 'V', y, 'z']
      ) ).attr( a ), this.format_value( v ), a
    );
    return '';
  }
} );

Ico.HorizontalBarGraph = Class.create( Ico.BarGraph, {
  set_defaults: function( $super ) { $super();
    this.orientation = 1;
  }
});

// ----------------
// Chart components
// ----------------

Ico.Component = Class.create( {
  initialize: function( p, options ) {
    Object.extend( this, {
      p           : p,
      graph       : p.graph,
      x           : p.x,
      y           : p.y,
      orientation : p.orientation
    } );
    if( Object.isArray( options ) ) options = { values: options };
    else if( Object.isNumber( options || Object.isString( options ) ) ) options = { value: options };
    this.options = Object.extend( this.defaults(), options );
    this.process_options();
  },
  defaults: function() { return {} }, // return default options, if any
  process_options: function() {}      // process options once set
} );

Ico.Component.components = new Hash();

Ico.Component.Template = Class.create( Ico.Component, {
  defaults: function() { return {} },
  process_options: function() {},
  calculate: function() {},
  draw: function() {}
} );

Ico.Component.components.set( 'template', [Ico.Component.Template, 0] );

Ico.Component.Background = Class.create( Ico.Component, {
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

Ico.Component.components.set( 'background', [Ico.Component.Background, 0] );

Ico.Component.StatusBar = Class.create( Ico.Component, {
  defaults: function() { return { attributes: { 'text-anchor': 'end' } } },
  
  draw: function() {
    this.shape = this.p.paper.text( this.p.options.width - 10, ( this.y ? this.y.padding[0] : this.p.options.height ) / 2, '' )
      .hide().attr( this.options.attributes )
    ;
  }
} );

Ico.Component.components.set( 'status_bar', [Ico.Component.StatusBar, 2] );

Ico.Component.MousePointer = Class.create( Ico.Component, {
  defaults: function() { return { attributes: { stroke: '#666', 'stroke-dasharray': '--' } } },

  draw: function() {
    this.shape = this.p.paper.path().attr( this.options.attributes ).hide();
    
    this.p.element.observe( 'mousemove', function( e ) {
      var viewport_offset =  this.p.element.viewportOffset();
      var x = e.clientX - viewport_offset[0];
      var y = e.clientY - viewport_offset[1];
      // Google chrome: if the view does not start at 0, 0, there is an offset
      // IE: Slow moves
      // FF provides the best result with smooth moves
      var in_graph = x >= this.x.start && x <= this.x.stop && y >= this.y.stop  && y <= this.y.start;
      if ( in_graph ) {
        this.shape.attr( { path: Ico.svg_path( [
          'M', this.x.start, y, 'h', this.x.len,
          'M', x, this.y.stop , 'v', this.y.len
        ] ) } ).show();
      } else {
        this.shape.hide();
      }
    }.bind( this ) );
    
    this.p.element.observe( 'mouseout', function( e ) {
      this.shape.hide();
    }.bind( this ) );    
  }
} );

Ico.Component.components.set( 'mouse_pointer', [Ico.Component.MousePointer, 2] );

Ico.Component.Graph = Class.create( Ico.Component, {
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

Ico.Component.components.set( 'graph_background', [Ico.Component.Graph, 1] );

Ico.Component.Labels = Class.create( Ico.Component, {
  defaults: function() { return {
    marker_size: 5, // 0 to disable
    angle:       0, // degrees, clockwise
    position:    0  // labels position, 0 => ( left / bottom ), 1 => ( right / top )
                    // this is under development, so don't use 1 just yet
  } },
  
  process_options: function( options ) {
    Object.extend( this.font = this.p.get_font(), this.options.font || {} );
    this.markers_attributes = { stroke: this.font.fill, 'stroke-width': 1 };
    Object.extend( this.markers_attributes, this.options.markers_attributes );
    if ( this.options.title ) {
      var title = this.options.title;
      this.title = title.value;
      Object.extend( this.title_font = this.font, this.options.title_font );
    }
  },
  
  calculate: function() { // value labels should overload without calling super
    this.y.angle = -90; // vertical labels angle, for horinzontal graphs, unsused if vertical graph
    this.x.angle = 0;
    this.calculate_labels_padding( this.graph.x, 1 );
  },
  
  calculate_labels_padding: function( d, position ) {
    var dx = d.direction[0], dy = d.direction[1], marker = this.options.marker_size, padding = [];
    d.labels = this.options.values || $A( $R( 1, this.data_samples ) );
    var angle = d.angle += this.options.angle;
    if ( d.labels ) {
      var bbox = this.labels_bounding_box( d ), font_size = d.font_size = bbox[1];
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
        if ( this.p.vml ) { // Fix VML text positionning
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
    d.other.padding[position ^ this.orientation ^ this.options.position] += padding[1]
  },
  
  labels_bounding_box: function( d ) {
    if ( this.labels ) return this.bbox;
    this.labels = [];
    var longuest = 0; d.labels.each( // get longest label bounding box
      function ( l ) {
        this.labels.push( l = this.p.paper.text( 10, 10, l.toString() ).attr( this.font ) );
        var bb = l.getBBox();
        bb.width > longuest && ( this.bbox = [longuest = bb.width, bb.height] )
      }.bind( this )
    );
    return this.bbox;
  },
  
  clear: function() {
    this.labels = null;
  },
  
  text_size: function( text, attr ) {
    var t = this.p.paper.text( 10, 10, '' ).attr( attr ).attr( { 'text' : text } );
    var d;
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
    var dx = d.direction[0], dy = d.direction[1], step = d.step,
        x = this.x.start + this.x.start_offset * dx,
        y = this.y.start - this.y.start_offset * dy,
        marker = this.options.marker_size,
        fx = d.f[0], fy = d.f[1], angle = d.angle,
        options = this.p.options, paper = this.p.paper,
        grid = Object.isUndefined( this.options.grid ) ? options.grid : this.options.grid
    ;
    if ( dy ) angle += 90;
    var path = [], grid_path = [];
    this.labels || this.labels_bounding_box( d );
    this.labels.each( function( label ) {
      if ( marker )    path.push( 'M', x, y, dx ? 'v' : 'h-', marker );
      if ( grid ) grid_path.push( 'M', x, y, dx ? 'v-' + this.y.len : 'h' + this.x.len );
      var x_anchor = x + fx;
      var y_anchor = y + fy;
      // label is already drawn, only anchor then rotate here
      label.attr( { x: x_anchor, y: y_anchor, 'text-anchor': d.anchor } ).toFront();
      // !!! set 'text-anchor' attribute before rotation
      angle && label.rotate( angle, x_anchor, y_anchor );  // !!! then rotate around anchor
      dx && ( x += step );
      dy && ( y -= step );
    }.bind( this ) );
    if ( marker ) paper.path( Ico.svg_path( path ) ).attr( this.markers_attributes );
    if ( grid ) {
      if ( dx ) grid_path.push( 'M', this.x.start, ' ', this.y.stop, 'h', this.x.len, 'v', this.y.len );
      paper.path( Ico.svg_path( grid_path ) ).attr( Object.isUndefined( this.options.grid_attributes )
        ? options.grid_attributes : this.options.grid_attributes
      );
    }
  }
} );

Ico.Component.components.set( 'labels', [Ico.Component.Labels, 3] );

Ico.Component.ValueLabels = Class.create( Ico.Component.Labels, {
  calculate: function() {
    var max = this.p.max, min = this.p.min, range = this.p.range;    
    
    this.p.calculate_graph_len( this.graph.y );
    // Calculate minimal step between labels
    var angle = Math.abs( this.options.angle ), min_step;
    if ( ( this.orientation && angle < 30 ) || ( !this.orientation && angle > 60 ) ) {
      min_step = [min, max].map( function( v ) {
        return this.text_size(
          '0' + Ico.significant_digits_round( v, 3, Math.round, true ) + this.p.options.units,
          this.font
        )[0]
      }.bind( this ) ).max();
    } else {
      min_step = 1.5 * this.text_size( '0', this.font )[1]; // allow 1/2 character height spacing
    }
    // Calculate maximum labels count 
    var count = Math.round( this.graph.y.len / min_step ), params;
    // Search (trial/error method) for the best count yiedling the lowest waste 
    if ( count >= 2 ) {
      var min_waste = range, max_count = count;
      $R( 2, max_count ).each( function( tried_count ) {
        params = this.calculate_value_labels_params( min, max, range, tried_count );
        if ( params.waste <= min_waste ) {
          min_waste = params.waste;
          count = tried_count;
        }
      }.bind( this ) );
    }
    params = this.calculate_value_labels_params( min, max, range, count );
    this.p.range = ( this.p.max = params.max ) - ( this.p.min = params.min );
    this.p.labels_count = params.count;
    
    // Finally build value labels array
    var labels = this.options.values = [];
    var precision = 0;
    for ( var label = this.p.min, i = -1; ++i <= params.count; label += params.step ) {
      var l = Ico.significant_digits_round( label, 3, Math.round, true ).toString();
      var len = ( l + '.' ).split( '.' )[1].length;
      if ( len > precision ) precision = len; // get longuest precision 
      labels.push( l );
    }
    // Then fix value labels precision and add units
    labels.each( function( l, i ) {
      var len = ( l + '.' ).split( '.' )[1].length;
      if ( len < precision ) {
        if ( len == 0 ) l += '.';
        l += '0000'.substring( 0, precision - len );
      }
      labels[i] = this.p.format_value( l )
    }.bind( this ) );
    
    this.graph.y.step = this.graph.y.len / params.count;
    this.calculate_labels_padding( this.graph.y, 0 );
  },
  
  calculate_value_labels_params : function ( min, max, range, count ) {
    if ( min < 0 && max > 0 ) {
      var positive_slots = Math.round( count * max / range );
      if ( positive_slots == 0 ) {
        positive_slots = 1;
      } else if ( positive_slots == count ) {
        positive_slots -= 1;
      }
      var negative_slots = count - positive_slots;
      var step = Ico.significant_digits_round( [max / positive_slots, - min / negative_slots].max(), 2,
        function( v ) { // the 2 digits rounding function
          v = Math.ceil( v );
          if ( v <= 10 ) return v;
          if ( v <= 12 ) return 12;
          var mod;
          // allows only multiples of five until 50 => allows 15, 20, 25, 30, 35, 40, 45, 50
          if ( v <= 54 ) return ( mod = v % 5 )? v - mod + 5 : v; // always round above
          // return mod == 0? v : v - mod + 5;
          // allow only multiples of 10 thereafter
          return ( mod = v % 10 )? v - mod + 10 : v
        }
      );
      min = -step * negative_slots;
      max = step * positive_slots;
    } else {
      var step = Ico.significant_digits_round( range / count, 1, Math.ceil );
      if ( max <= 0 ) min = max - step * count;
      else if ( min >= 0 ) max = min + step * count;
    }
    return { min: min, max: max, count: count, step: step, waste: count * step - range };
  },
  
  draw: function() { this.draw_labels_grid( this.graph.y ); }
} );

Ico.Component.components.set( 'value_labels', [Ico.Component.ValueLabels, 4] );

Ico.Component.Meanline = Class.create( Ico.Component, {
  defaults: function() { return { attributes: { stroke: '#bbb', 'stroke-width': 2 } } },

  calculate: function() {
    var values = this.p.all_values;
    this.mean = Ico.significant_digits_round(
      values.inject( 0, function( v, sum ) { return sum + v } ) / values.length, 3, Math.round, true
    );
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
    this.p.show_label_onmouseover( this.shape, 'Average: ' + this.p.format_value( this.mean ), a );
  }
} );

Ico.Component.components.set( 'meanline', [Ico.Component.Meanline, 3] );

Ico.Component.FocusHint = Class.create( Ico.Component, {
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

Ico.Component.components.set( 'focus_hint', [Ico.Component.FocusHint, 5] );

Ico.Component.Axis = Class.create( Ico.Component, {
  defaults: function() { return { attributes: { stroke: '#666', 'stroke-width': 1 } } },
  draw: function() {
    this.shape = this.p.paper.path( Ico.svg_path( ['M', this.x.start, this.y.stop, 'v', this.y.len, 'h', this.x.len] ) )
    .attr( this.options.attributes );
  }  
} );

Ico.Component.components.set( 'axis', [Ico.Component.Axis, 4] );