/* Ico Graph Prototype/Raphael library
 *
 * Copyright (c) 2009, Jean Vincent
 * Copyright (c) 2009, Alex R. Young
 * Licensed under the MIT license: http://github.com/alexyoung/ico/blob/master/MIT-LICENSE
 */
var Ico = {
  VERSION: 0.94,
  
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
    this.series = series || [];
    this.set_series();
    this.set_defaults();
    this.process_options( options );
    this.set_raphael();
    this.calculate();
    this.draw();
    return this;
  },
  
  set_series: function() {
    if ( Object.isNumber( this.series ) ) this.series = [this.series];
  },
  
  set_defaults: function() {
    this.options = {
      width:                  parseInt( this.element.getStyle( 'width' ) ),
      height:                 parseInt( this.element.getStyle( 'height' ) ),
      color:                  this.element.getStyle( 'color' ),
      mouseover_attributes:   { stroke: 'red' }
    };
  },
  
  process_options: function( options ) {
    if ( options ) Object.extend( this.options, options );
    this.orientation = ( this.options.orientation || this.orientation || 0 );
    this.x = {}; this.y = {};
    this.graph = { x: this[this.orientation? 'y' : 'x'], y: this[this.orientation? 'x' : 'y'] };
    this.comps = [];
    Ico.Component.components.each( function( c ) {      
      var k = c.key, a = this.options[k + '_attributes'], o = this.options[k];
      if ( o === true && a ) o = this.options[k] = a;
      if ( o ) {
        var layer = c.value[1];
        if ( ! this.comps[layer] ) this.comps[layer] = [];
        this.comps[layer].push( this[k] = new (c.value[0])( this, o ) );
      }
    }.bind( this ) );
  },
  
  set_raphael: function() {
    this.paper = Raphael( this.element, this.options.width, this.options.height );
    this.svg = ! ( this.vml = Raphael.vml );
  },
  
  clear: function() {
    this.paper.remove();
    this.paper = null;
    return this;
  },
  
  calculate: function() {
    this.components_call( 'calculate' );
  },
  
  draw: function() {
    if ( this.paper == null ) this.set_raphael();
    this.components_call( 'draw' );
    this.draw_series();
    return this;
  },
    
  components_call: function( f ) {
    for( var i = -1; ++i < this.comps.length; ) {
      var l = this.comps[i];
      if ( ! l ) continue;
      for( var j = -1; ++j < l.length; ) {
        var c = l[j];
        c[f] && c[f]()
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
  set_series: function( $super ) { $super();
    this.min = this.series.min();
    this.max = this.series.max();
    this.samples = this.series.length;
  },
  
  calculate: function( $super ) { $super();
    this.x.start = 0;
    this.step = this.calculate_values_step();
    this.scale = ( this.options.height - 1 ) / ( this.max - this.min );
  },
  
  calculate_values_step: function() {
    return ( this.options.width - 1 ) / ( this.samples - 1 );
  },
  
  draw_series: function() {
    this.draw_serie().attr( { stroke: this.options.color } );
    this.options.highlight && this.draw_highlight();
  },
    
  draw_serie: function() {
    var x = 0, p;
    this.series.each( function( v ) {
      p = Ico.svg_path( [( p ? p + 'L' : 'M' ), x, this.options.height - 1 - this.plot( v )] );
      x += this.step;
    }.bind( this ) );
    return this.paper.path( p );
  },
  
  draw_highlight: function() {
    var i = this.options.highlight.index || this.samples - 1;
    this.paper.circle( this.x.start + i * this.step, this.options.height - 1 - this.plot( this.series[i] ), 1 )
      .attr( { stroke: 'none', fill: this.options.highlight.color || 'red' } );
  }
});

Ico.SparkBar = Class.create( Ico.SparkLine, {
  calculate_values_step: function() {
    return ( this.options.width - 1 ) / this.samples;
  },

  calculate: function( $super ) { $super();
    this.graph.x.start = this.step / 2;
    this.bar_base = this.options.height - 1 - this.scale * (
      ( this.max <= 0? this.max : 0 ) -
      ( this.min <  0? this.min : 0 )
    );
  },

  draw_serie: function() {
    var x = - this.x.start, p = '';
    this.series.each( function( v ) {
      p += Ico.svg_path( ['M', x += this.step, this.bar_base, 'v', - this.scale * v ] );
    }.bind( this ) )
    return this.paper.path( p ).attr( { 'stroke-width': this.step } );
  }
});

Ico.BulletGraph = Class.create( Ico.Base, {
  set_series: function( $super ) { $super();
    this.value  = this.series[0] || 50;    
  },
  
  set_defaults: function( $super ) { $super();
    this.orientation = 1;
    
    Object.extend( this.options, {
      min               : 0,
      max               : 100,
      color             : '#33e',
      target_color      : '#666',
      graph_background  : true
      // status_bar        : true
    })
  },
  
  calculate: function( $super ) { $super();
    this.range = ( this.max = this.options.max ) - ( this.min = this.options.min );
  
    this.x.start  = 0;
    this.x.stop   = this.x.len = this.options.width;
    this.y.start  = this.y.len = this.options.height;
    this.y.stop   = 0;
    this.y_offset = this.y.stop + this.y.len / 2;
    
    this.scale = this.graph.y.len / ( this.range );
    this.bar_width = this.y.len / 3; // use bar_padding instead
    this.bar_base = this.graph.y.start - this.scale * (
      ( this.max <= 0? this.max : 0 ) -
      ( this.min <  0? this.min : 0 )
    );
  },
  
  draw_series: function() {
    var a, p = this.paper.path( Ico.svg_path( [
        'M', this.plot( this.min ) - this.bar_base, this.y_offset, 'H', this.plot( this.value )
      ] ) ).attr( a = { stroke: this.options.color, 'stroke-width' : this.bar_width } )
    ;
    this.show_label_onmouseover( p, '' + this.value, a );
    if ( typeof( this.options.target ) != 'undefined' ) {
      this.paper.path( Ico.svg_path(
        ['M', this.plot( this.options.target ), this.y.len * 0.2, 'v', this.y.len * 0.6 ] )
      ).attr( { stroke: this.options.target_color, 'stroke-width' : 1 } )
    }
  }
});
 
Ico.BaseGraph = Class.create( Ico.Base, {
  set_series: function( $super ) { $super();
    this.series = Object.isArray( this.series ) ? new Hash( { one: this.series } ) : $H( this.series );
    this.data_samples = this.series.collect( function( serie ) { return serie[1].length } ).max();
    var all_values = this.all_values = this.series.collect( function( serie ) { return serie[1] } ).flatten(),
        max = Ico.significant_digits_round( all_values.max(), 2, Math.ceil ),
        min = Ico.significant_digits_round( all_values.min(), 2, Math.floor ),
        range = max - min
    ;
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
      x_padding_left:           20,
      x_padding_right:          20,
      y_padding_top:            20,
      y_padding_bottom:         10,
      // Series options
      dot_radius:               5, // 0 for no dot
      colors:                   {}, // Hash by data series key for line graphs
      series_attributes:        {}, // idem for bar graphs
      dot_attributes:           {}, // idem for line graphs
      // Font options
      font_size:                10,
      labels_color:             '#666',
      labels_font:              { stroke: 'none', fill: '#666', 'font-family': 'Helvetica' },
      // Other options
      value_labels:             {},
      focus_hint:               true,
      axis:                     true,
      grid_attributes:          { stroke: '#eee', 'stroke-width': 1 },
      marker_size:              5 // 0 to disable
    } );
  },  
  
  process_options: function( $super, options ) { $super( options );
    // Series options -> todo go in series instead of options
    this.series.keys().each( function( key ) {
      var color = this.options.colors[key];
      if ( ! color ) {
        color = this.options.colors[key] = this.options.color || Raphael.hsb2rgb( Math.random(), 1, .75 ).hex;
      }
      if ( ! this.options.series_attributes[key] ) {
        this.options.series_attributes[key] = {
          stroke: 'none', 'stroke-width': 2, gradient: '' + ( this.orientation ? 270 : 0 ) + '-' + color + ':20-#555555'
        };
      }
      if ( ! this.options.dot_attributes[key] ) {
        this.options.dot_attributes[key] = {
          'stroke-width': 1, stroke: this.background ? this.background.options.color : color,
          fill: color
        };
      }
    }.bind( this) );
    
    // Labels Font Attributes
    this.labels_font = this.options.labels_font;
    this.labels_font['font-size'] = this.labels_font['font-size'] || this.options.font_size;
    this.labels_font.fill         = this.labels_font.fill   || this.options.labels_color;
    this.labels_font.stroke       = this.labels_font.stroke || 'none';    
    this.markers_attributes = this.options.markers_attributes ||
      { stroke: this.labels_font.fill, 'stroke-width': 1 }
    ;
    
    this.x.width = this.options.width; this.y.width = this.options.height;
    this.graph.x.labels_font = this.graph.y.labels_font = this.options.labels_font;
    this.x.padding = [this.options.x_padding_left, this.options.x_padding_right];
    this.y.padding = [this.options.y_padding_top, this.options.y_padding_bottom];
    // this.graph.x.angle = this.options.value_labels_angle || 0;
  },
  
  calculate: function( $super ) { $super();
    this.calculate_graph_len( this.graph.x );
    this.calculate_graph_len( this.graph.y );
    this.scale = ( this.orientation? -1 : 1 ) * this.graph.y.len / this.range;
    this.x.direction = [0, -1];
    this.y.direction = [1, 0];
    this.graph.x.step = this.calculate_values_step();
    this.x.start_offset = 0;
    this.y.start_offset = 0;
    
    this.x.start = this.x.padding[0];
    this.x.stop = this.x.start + this.x.len;
    
    this.y.start = this.y.padding[0] + this.y.len;
    this.y.stop = this.y.padding[0];
  },
  
  calculate_graph_len: function( d ) {
    d.len  = d.width - d.padding[0] - d.padding[1];
  },

  draw_series: function() {
    this.series.each( this.draw_serie.bind( this ) );
  },
  
  draw_serie: function( serie ) {
    var x = this.x.start + this.x.start_offset,
        y = this.y.start - this.y.start_offset,
        p = this.paper.path(),
        path = '',
        label = serie.key
    ;
    if ( this.orientation ) {
      x += this.scale * this.min;
      y += this.y.step;
    } else {
      x -= this.x.step;
      y += this.scale * this.min;
    }
    serie.value.each( function( v, i ) {
      path += this.orientation?
        this.draw_value( i, x - this.scale * v, y -= this.y.step, v, label ) :
        this.draw_value( i, x += this.x.step, y - this.scale * v, v, label )
      ;
    }.bind( this ) );
    if ( path != '' ) p.attr( { path: path } ).attr( { stroke: this.options.colors[label], 'stroke-width': 3 } );
  }
});

Ico.LineGraph = Class.create( Ico.BaseGraph, {
  calculate_values_step: function() {
    return this.graph.x.len / ( this.data_samples - 1 );
  },

  draw_value: function( i, x, y, value, label ) {
    var radius = this.options.dot_radius;
    if ( radius ) this.paper.circle( x, y, radius ).attr( this.options.dot_attributes[label] );
    var a = { stroke: 'none', fill: 'white', 'fill-opacity' : 0 };
    this.show_label_onmouseover( this.paper.circle( x, y, 2 * ( radius || 5 ) ).attr( a ), '' + value, a );
    var p, w = this.options.curve_amount;
    if ( i == 0 ) {
      p = ['M', x, y];
    } else if ( w ) {
      p = ["C", this.last_x + w, this.last_y, x - w, y, x, y];
    } else {
      p = ['L', x, y];
    }
    this.last_x = x, this.last_y = y;
    return Ico.svg_path( p );
  }
});

Ico.BarGraph = Class.create( Ico.BaseGraph, {
  set_defaults: function( $super ) { $super();
    this.options.bar_padding = 5;
  },
  
  calculate: function( $super ) { $super();
    this.bar_width = this.graph.x.step - this.options.bar_padding;
    if ( this.bar_width < 10 ) this.bar_width = 10;
    this.bars_count = this.series.length;
    
    this.graph.x.start_offset = this.graph.x.step / 2;
    
    this.bar_base = this.graph.y.start - this.scale * (
      ( this.max <= 0? this.max  : 0 ) -
      ( this.min <  0? this.min : 0 )
    );
  },
  
  calculate_values_step: function() {
    return this.graph.x.len / this.data_samples;
  },
  
  draw_value: function( i, x, y, v, label ) {
    var a = this.options.series_attributes[label];
    
    this.show_label_onmouseover( this.paper.path( Ico.svg_path( this.orientation?
        ['M', x, y - this.bar_width / 2, 'H', this.bar_base, 'v', this.bar_width, 'H', x, 'z'] :
        ['M', x - this.bar_width / 2, y, 'V', this.bar_base, 'h', this.bar_width, 'V', y, 'z']
      ) ).attr( a ), '' + v, a
    );
    return '';
  }
});

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
    values: $A( $R( 1, this.data_samples ) ),
    angle: 0
  } },
  
  calculate: function() {
    if ( Object.isUndefined( this.x.angle ) ) {
      this.x.angle = -90; // vertical labels angle
      this.y.angle = 0;
    }
    this.calculate_labels_padding( this.graph.y, this.orientation ^ 1 );
  },
  
  calculate_labels_padding: function( d, pos ) {
    d.labels = this.options.values;
    d.angle += this.options.angle;
    var padding = ( this.p.options.marker_size || 0 );
    if ( d.labels ) {
      d.font_size = this.text_size( 'A', d.labels_font )[1];
      var angle = d.angle;
      if ( angle ) {
        var angle = d.angle * Math.PI / 180;
        d.sin = Math.abs( Math.sin( angle ) ); d.cos = Math.abs( Math.cos( angle ) );
        var m = 0, t, len; d.labels.each( function ( l ) { ( len = l.toString().length ) > m && ( m = len, t = l ); });
        padding += Math.round( this.text_size( t, d.labels_font )[0] * d.sin + d.font_size * d.cos / 2 );
      } else {
        padding += d.font_size;
      }
    }
    return d.padding[pos] += padding;
  },
  
  text_size: function( text, attr ) {
    var t = this.p.paper.text( 20, 20, text ).attr( attr ), d;
    //if ( this.vml ) {
      //t.shape.style.display = "inline";
      //d = [t.shape.offsetWidth, t.shape.offsetHeight];
    //} else { 
      d = [ t.getBBox().width, t.getBBox().height ];
    //}
    t.remove();
    return d;
  },
  
  draw: function() {
    this.draw_labels_grid( this.graph.y, this.graph.x.step );
  },
  
  draw_labels_grid: function( d, step ) {
    var dx = d.direction[0], dy = d.direction[1],
        x = this.x.start + this.x.start_offset * dx,
        y = this.y.start + this.y.start_offset * dy,
        marker = this.p.options.marker_size || 0,
        labels = d.labels,
        font_size = d.font_size,
        anchor, fx, fy, angle = d.angle, svg = this.svg,
        options = this.p.options, paper = this.p.paper
    ;
    if ( dy ) angle += 90;
    if ( angle ) {
      if ( dx ) {
        fx = ( angle > 0 ? 1 : -1 ) * ( svg ? 0.4 : 0.4 ) * font_size * d.cos;
        fy =                          ( svg ? 0.4 : 0.8 ) * font_size * d.sin + marker;
        anchor = angle < 0 ? 'end' : 'start';
      } else if ( Math.abs( angle ) != 90 ) {
        fx =                        - ( svg ? 0.4 : 0.4 ) * font_size * d.cos - marker;
        fy = ( angle < 0 ? 1 : -1 ) * ( svg ? 0.0 : 0.0 ) * font_size * d.sin;
        anchor = 'end';
      } else {
        fx = -( svg ? 0.6 : 0.6 ) * font_size - marker;
        fy = 0;
        anchor = 'middle';
      }
    } else {
      fx = ( ( svg ? 0.2 : 0.4 ) * font_size + marker ) * dy;
      fy = ( ( svg ? 0.6 : 0.8 ) * font_size + marker ) * dx -
           ( ( svg ? 0.0 : 0.2 ) * font_size          ) * dy;
      anchor = dx ? 'middle' : 'end';
    }
    var path = [], grid_path = [];
    labels.each( function( label ) {
      if ( marker ) path.push( 'M', x, y, dx ? 'v' : 'h-', marker );
      if ( options.grid ) grid_path.push( 'M', x, y, dx ? 'v-' + this.y.len : 'h' + this.x.len );
      var x_anchor = x + fx;
      var y_anchor = y + fy;
      var l = paper.text( x_anchor, y_anchor, '' + label ).attr( d.labels_font );
      l.attr( { 'text-anchor': anchor } ); // !!! set 'text-anchor' attribute before rotation
      angle && l.rotate( angle, x_anchor, y_anchor );  // !!! then rotate around anchor
      x += step * dx;
      y += step * dy;
    }.bind( this ) );
    if ( marker ) paper.path( Ico.svg_path( path ) ).attr( this.markers_attributes );
    if ( options.grid ) {
      if ( dx ) grid_path.push( 'M', this.x.start, ' ', this.y.stop, 'h', this.x.len, 'v', this.y.len );
      paper.path( Ico.svg_path( grid_path ) ).attr( options.grid_attributes );
    }
  }
} );

Ico.Component.components.set( 'labels', [Ico.Component.Labels, 3] );

Ico.Component.ValueLabels = Class.create( Ico.Component.Labels, {
  defaults: function() {
    var options = {
      units: null,
      units_position: 1 // 0: before label, 1: after label
    }
    return options;
  },
  
  calculate: function() {
    var max = this.p.max, min = this.p.min, range = this.p.range;    
    
    // Calculate maximum labels count
    this.p.calculate_graph_len( this.graph.y );
    var count = Math.round( this.graph.y.len / 2 / this.graph.x.labels_font['font-size'] ), params;
    if ( count >= 2 ) { // Search for the best count yiedling the lowest waste 
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
      var l = Ico.significant_digits_round( label, 2, Math.round, true ).toString();
          len = ( l + '.' ).split( '.' )[1].length;
      ;
      if ( len > precision ) precision = len; 
      labels.push( l );
    }
    // Then fix value labels precision and add units
    labels.each( function( l, i ) {
      var len = ( l + '.' ).split( '.' )[1].length;
      if ( len < precision ) l += '0000'.substring( 0, precision - len );
      if ( this.options.units ) { // add units
        l = this.options.units_position? l + this.options.units : this.options.units + l;
      }
      labels[i] = l
    }.bind( this ) );
    
    
    this.graph.y.step = this.graph.y.len / params.count;
    this.calculate_labels_padding( this.graph.x, this.orientation );
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
      var step = Ico.significant_digits_round( [max / positive_slots, - min / negative_slots].max(), 1, Math.ceil );
      min = -step * negative_slots;
      max = step * positive_slots;
    } else {
      var step = Ico.significant_digits_round( range / count, 1, Math.ceil );
      if ( max <= 0 ) min = max - step * count;
      else if ( min >= 0 ) max = min + step * count;
    }
    return { min: min, max: max, count: count, step: step, waste: count * step - range };
  },
  
  draw: function() {
    this.draw_labels_grid( this.graph.x, this.graph.y.step );
  }  
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
    this.p.show_label_onmouseover( this.shape, 'Average: ' + this.mean, a );
  }
} );

Ico.Component.components.set( 'meanline', [Ico.Component.Meanline, 3] );

Ico.Component.FocusHint = Class.create( Ico.Component, {
  defaults: function() { return {
    length: 6,
    attributes: { 'stroke-width': 2 }
  } },
  
  draw: function() {
    if ( this.p.min == 0 ) return;
    var len = this.options.length, l = Ico.svg_path( ['l', len, len] );
    if ( ! this.options.attributes.stroke ) this.options.attributes.stroke = this.options.color || this.graph.x.labels_font.fill;
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