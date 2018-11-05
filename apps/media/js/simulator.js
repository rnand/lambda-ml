/*! CMB Simulator - 2013-06-27
* Includes:
*    FFT Copyright © 2012 wellflat Licensed under the MIT License (https://github.com/wellflat/javascript-labs/tree/master/cv/fft)
*    Ned Wright's Cosmology Calculator (refactored from http://www.astro.ucla.edu/~wright/CosmoCalc.html)
*    Full Screen API (http://johndyer.name/native-fullscreen-javascript-api-plus-jquery-plugin/)
*    jQuery UI Touch Punch 0.2.2 (https://github.com/furf/jquery-ui-touch-punch)
*    Ziggurat (http://www.filosophy.org/post/35/normaldistributed_random_values_in_javascript_using_the_ziggurat_algorithm/)
*/

(function ($) {

	/*
		Create a class to deal with our parameter slider instances
	*/
	function ParameterSlider(inp){

		// Keep the jQuery selector for the HTML select box
		this.select = inp.select;

		this.index = this.select[0].selectedIndex;
		// If a starting index is provided, we will use that instead
		if(typeof inp.index==="number" && parseFloat(inp.index) == parseInt(inp.index)){
			this.index = inp.index;
			// Update the select drop down
			this.select[0].selectedIndex = this.index;
		}

		this.updateOptsByIndex(this.index);

		// Store the callbacks and a context which will be used for the "this"
		this.callback = { change: "", start: "", stop: "", mouseenter: "", context: (typeof inp.context==="object") ? inp.context : this };
		if(typeof inp.change==="function") this.callback.change = inp.change;
		if(typeof inp.start==="function") this.callback.start = inp.start;
		if(typeof inp.stop==="function") this.callback.stop = inp.stop;
		if(typeof inp.mouseenter==="function") this.callback.mouseenter = inp.mouseenter;

		// Set up the slider - attaches jQuery UI functions
		this.init();

		return this;
	}

	ParameterSlider.prototype.updateOptsByIndex = function(i){
		// Get the options
		this.opts = this.select.children().map(function() {return parseFloat($(this).val());}).get();

		// Keep a copy of the current index to check for a change
		var orig = this.index;

		// Set the index and value based on the index supplied
		this.index = (typeof i==="number") ? i : 0;
		this.value = this.opts[this.index];

		// Update the select drop down if necessary
		if(orig != this.index) this.select[0].selectedIndex = this.index;
	}

	// Set up the jQuery UI slider and add some properties/callbacks to our variable.
	ParameterSlider.prototype.init = function(){
	
		// We need a copy of 'this' for use in the following functions
		var _obj = this;

		// Set up the jQuery UI Slider
		this.slider = $( "<div id='"+_obj.select.attr('id')+"_slider'><\/div>" ).insertAfter( this.select ).slider({
			animate: "fast",
			min: 1,
			max: this.opts.length,
			range: "min",
			value: _obj.index + 1,
			slide: function( event, ui ){
				// Get the current values
				_obj.updateOptsByIndex(ui.value - 1);

				// Fire the callback
				if(typeof _obj.callback.change==="function") _obj.callback.change.call(_obj.callback.context,{event:event, value: _obj.value, id: _obj.select.attr('id')});
			},
			start: function( event, ui ){
				if(typeof _obj.callback.start==="function") _obj.callback.start.call(_obj.callback.context,{event:event, value: _obj.value, id: _obj.select.attr('id')});
			},
			stop: function( event, ui ){
				if(typeof _obj.callback.stop==="function") _obj.callback.stop.call(_obj.callback.context,{event:event, value: _obj.value, id: _obj.select.attr('id')});
			}
		});
		// Attach the mouse event
		if(typeof _obj.callback.mouseenter==="function"){
			$('#'+_obj.select.attr('id')+"_slider").on('mouseenter',function(e){
				_obj.callback.mouseenter.call(_obj.callback.context,{event: e, value: _obj.value, id: _obj.select.attr('id')});		
			});
			$('#'+_obj.select.attr('id')+"_slider a.ui-slider-handle").on('focus',function(e){
				_obj.callback.mouseenter.call(_obj.callback.context,{event: e, value: _obj.value, id: _obj.select.attr('id')});		
			});
		}
		// If the select drop down is updated we need to update the slider
		// This shouldn't happen as it shouldn't be visible... but just in case.
		this.select.change(function() {
			_obj.slider.slider( "value", this.selectedIndex + 1 );
		});

		// Hide the HTML selector element
		this.select.hide();

		// Calculate the maximum precision of the options
		this.opts = this.select.children().map(function() {return $(this).val();}).get();
		this.precision = 0;
		var prec = 0;
		for(var i = 0; i < this.opts.length; i++){
			// Work out how many decimal places
			prec = (this.opts[i].length - (this.opts[i].indexOf('.')+1));
			if(prec > this.precision) this.precision = prec;
		}

	};
	
	// Placeholder function to prevent errors if we call it without it being set
	ParameterSlider.prototype.change = function(){}

	ParameterSlider.prototype.setValue = function(v){

		// Make sure we sort out rounding errors
		v = v.toFixed(this.precision);

		// Get the options
		this.opts = this.select.children().map(function() {return parseFloat($(this).val());}).get();
		for(var i = 0; i < this.opts.length; i++){
			if(this.opts[i]==v){
				this.slider.slider("value", i+1);
				this.updateOptsByIndex(i);
				break;
			}
		}
		return;
	}

	// A class to create and display a power spectrum
	// inp = {
	//	ps: 'powerspectrum' // ID of the HTML element for the plot
	//	dir: 'db/'	// Where all the data files are
	//	context: blah	// The context that will be used for the "this"
	//	updated: function(){}	// A function that will be called when the power spectrum is updated
	//}
	function PowerSpectrum(inp){

		this.id = (is(inp.ps,"string")) ? inp.ps : "powerspectrum";
		this.el = $('#'+this.id);
		this.dir = (is(inp.dir,"string")) ? inp.dir : "db/";
		this.omega = { b: "", c:"", l:"" };
		this.fullscreen = false;
		this.logging = (console && typeof console.log==="function");
		this.fixedscale = (is(inp.fixedscale,"boolean")) ? inp.fixedscale : true;

		// Store the callbacks and a context which will be used for the "this"
		this.callback = { updated: "", context: (typeof inp.context==="object") ? inp.context : this };
		if(typeof inp.updated==="function") this.callback.updated = inp.updated;

		this.precision = (is(this.callback.context.omega_b.precision,"number")) ? this.callback.context.omega_b.precision : 2;

		this.chart = {};
		
		// Define the options
		this.setOptions();
		
		// Update the plot
		this.create();

		// Load the initial data
		this.loadData("omega_b",inp.omega_b,inp.omega_c,inp.omega_l);
		
		// Hide it initially
		this.el.toggleClass('hidden');

		// Bind window resize event for when people change the size of their browser
		$(window).on("resize",{me:this},function(ev){
			ev.data.me.resize();
		});

		return this;
	}

	// A function to set various properties of the plot
	PowerSpectrum.prototype.setOptions = function(){

		// Get some properties from the CSS
		var fs = parseInt(getStyle(this.id, 'font-size'));
		var ff = getStyle(this.id, 'font-family');
		var co = getStyle(this.id, 'color');

		// Define our options
		this.opts = {
			'font-size': fs,
			'font': fs+'px',
			'offset' : {
				top: (this.fullscreen ? fs : 1),
				left : (this.fullscreen ? fs*2 : fs*1.5),
				right : (this.fullscreen ? fs : 1),
				bottom : (this.fullscreen ? fs*2 : fs*1.5)
			},			
			'grid': {
				'color': "rgb(0,0,0)",
				'opacity': 0.25,
				'width': "0.5",
				'sub': {
					'color': "rgb(0,0,0)",
					'opacity': 0.08,
					'width': "0.5"
				}
			},
			'xaxis': {
				'invert': true,
				'min': 1.5,
				'max': 3000,
				'label': {
					'color': co,
					'font' : ff
				},
				'ticks' : true
			},
			'yaxis': {
				'min': 0,
				'max': 6500,
				'label': {
					'color': co,
					'font' : ff
				}
			}
		}
	}
	
	// Resize the power spectrum Raphael paper
	PowerSpectrum.prototype.resize = function(){

		// Hide the contents so we can calculate the size of the container
		this.el.children().hide();

		// Check if the HTML element has changed size due to responsive CSS
		if(this.el.innerWidth() != this.chart.width || this.el.innerHeight() != this.chart.height){

			// Re-define the options
			this.setOptions();

			// Create the new chart
			this.create();

		}

		// Show the contents again
		this.el.children().show();

		// Draw the data
		this.draw();
			
	}

	// Set up the power spectrum. Draws the axes.
	PowerSpectrum.prototype.create = function(){

		// Set the overall width and height
		this.chart.width = this.el.innerWidth();
		this.chart.height = this.el.innerHeight();

		// Work out the chart area width and height
		this.opts.offset.width = this.chart.width-this.opts.offset.right-this.opts.offset.left;
		this.opts.offset.height = this.chart.height-this.opts.offset.bottom-this.opts.offset.top;

		if(this.chart.holder) this.chart.holder.remove();
		
		// Create the Raphael object to hold the vector graphics
		this.chart.holder = Raphael(this.id, this.chart.width, this.chart.height);

		if(!this.boundfullscreen){
			$('#'+this.id).on('dblclick', {me:this}, function(e){ e.data.me.toggleFullScreen(); });
			$('#'+this.id).on('click', {me:this}, function(e){ e.data.me.draw(); });
			$(document).on('mozfullscreenchange webkitfullscreenchange fullscreeneventchange', {me:this}, function(e){ e.data.me.updateFullScreen(); });
			this.boundfullscreen = true;
		}

		// Short handles for the chart properties
		var l = this.opts.offset.left,
		t = this.opts.offset.top,
		w = this.opts.offset.width,
		h = this.opts.offset.height,
		b = this.opts.offset.bottom;

		// Get the ell character
		var ell = $("<div>").html('&#8467;').text();
		var deg = $("<div>").html('&deg;').text();
		
		// Draw the axes
		this.chart.axes = this.chart.holder.rect(l,t,w,h).translate(0.5,-0.5).attr({stroke:'#AAAAAA','stroke-width':1});

		// Draw the axes labels
		this.chart.xLabel = this.chart.holder.text(l + w/2, t + h + b*0.5, "Scale on the sky").attr({fill: (this.opts.xaxis.label.color ? this.opts.xaxis.label.color : "black"),'font-size': this.opts.font,'font-family': this.opts.xaxis.label.font });
		this.chart.yLabel = this.chart.holder.text(l*0.5, t+(h/2), "Anisotropy "+ell+"("+ell+"+1) C"+ell+"").attr({fill: (this.opts.yaxis.label.color ? this.opts.yaxis.label.color : "black"),'font-size': this.opts.font,'font-family': this.opts.yaxis.label.font }).rotate(270);

		// Draw angular labels on chart
		if(this.opts.xaxis.ticks){
			var path = [];
			var txt = [];
			var deglabels = [30,10,3,1,0.3,0.1];
			var y,x,Xmin,Xmax,Xscale;
			Xmin = this.scaleX(this.opts.xaxis.min);
			Xmax = this.scaleX(this.opts.xaxis.max);
			Xscale = (this.opts.offset.width) / (Xmax - Xmin);
			for(var i = 0 ; i < deglabels.length ; i++){
				var l = 180/deglabels[i];
				var fs = this.opts['font-size']/2;
				y = (this.opts.offset.top + this.opts.offset.height);
				x = (this.opts.offset.left + Xscale * (this.scaleX(l) - Xmin) );
				path = path.concat(["M",x,y,"L",x,y-fs]);
				txt.push([x,y-fs-fs,deglabels[i]+deg]);
			}
			this.chart.xlines = this.chart.holder.path(path).attr({stroke:'#AAAAAA','stroke-width':1, "stroke-linejoin": "round"});
			this.chart.xtext = this.chart.holder.set();
			for(var i = 0 ; i < deglabels.length ; i++){
				this.chart.xtext.push(this.chart.holder.text(txt[i][0],txt[i][1],txt[i][2]).attr({fill:'black', "text-anchor": "middle"}));
			}
		}
	}

	PowerSpectrum.prototype.toggleTicks = function(){
		this.opts.xaxis.ticks = !this.opts.xaxis.ticks;
		if(this.opts.xaxis.ticks){
			this.chart.xlines.show();
			this.chart.xtext.show();
		}else{
			this.chart.xlines.hide();
			this.chart.xtext.hide();		
		}
	}
	
	// A scaling for the x-axis value
	PowerSpectrum.prototype.scaleX = function(l){
		if(l > 0) return Math.log(l*(l+1));
		else return 0;
	}
	
	// A scaling for the y-axis value
	PowerSpectrum.prototype.scaleY = function(l,cl){
		return cl;
	}
	
	// Anything that needs regular updating on the power spectrum
	PowerSpectrum.prototype.draw = function(){

		// Check we have somewhere to draw
		if(!this.chart.holder) return this;

		if(this.logging) var d = new Date();

		// Build the power spectrum curve
		if(this.data){

			var p,max,y,x,x1,prevy,tempx,tempy,data,peak,trough,Xmin,Xmax,Ymin,Ymax,Yrange,Yscale,Xrange,Xscale;
			max = 0;
			data = this.data;
			Xmin = this.scaleX(this.opts.xaxis.min);
			Xmax = this.scaleX(this.opts.xaxis.max);
			if(this.fixedscale){
				Ymin = this.scaleY(this.opts.xaxis.min,this.opts.yaxis.min);
				Ymax = this.scaleY(this.opts.xaxis.max,this.opts.yaxis.max);
			}else{
				var mn = Math.min.apply(null,data[1]);
				var mx = Math.max.apply(null,data[1])*1.1;
				Ymin = this.scaleY(this.opts.xaxis.min,mn);
				Ymax = this.scaleY(this.opts.xaxis.max,mx);
			}

			Xrange = (Xmax - Xmin);
			Xscale = (this.opts.offset.width) / Xrange;
			Yrange = (Ymax-Ymin);
			Yscale = (this.opts.offset.height) / Yrange;
			this.firsttrough = 0;
			this.firstpeak = 0;

			//if(!this.chart.dots) this.chart.dots = this.chart.holder.set();

			for (var i = 0, j = 0; i < data[0].length; i++) {
				tempy = this.scaleY(data[0][i],data[1][i]);
				tempx = this.scaleX(data[0][i]);
				y = (this.opts.offset.top + this.opts.offset.height - Yscale * (tempy - Ymin)).toFixed(2);
				x = (this.opts.offset.left + Xscale * (tempx - Xmin) ).toFixed(2);
				// First point of the curve. Move to the point then use Catmull-Rom 
				// curveto (Raphael) to join the initial points
				if(i==0){
					p = ["M", x, y, (data[0].length <= 2 ? "L" : "R")];
				}else{
					// If we are not at the first or last points we 
					// can check if this is a trough or peak
					if(i > 0 && i < data[0].length-1){

						trough = (data[1][i-1] > data[1][i] && data[1][i+1] > data[1][i]);
						peak = (data[1][i-1] < data[1][i] && data[1][i+1] < data[1][i]);

						// If we are sufficiently far along we draw cubic Bézier
						// curves through the peak/troughs.
						if(data[0][i] > 100 && (trough || peak)){

							// Keep a record of where the first peak is just in case we want it
							if(peak && !this.firstpeak) this.firstpeak = data[0][i];

							// Keep a record of where the first trough is for curve fitting
							if(trough && this.firstpeak && !this.firsttrough) this.firsttrough = data[0][i];

							// Work out the control point(s). See http://www.w3.org/TR/SVG/paths.html#PathDataCubicBezierCommands
							if(this.firsttrough == data[0][i]){
								tempx = this.scaleX(data[0][i-1] + (data[0][i]-data[0][i-1])*0.25);
								x1 = this.opts.offset.left + Xscale * (tempx - Xmin);
								tempx = this.scaleX(data[0][i] - (data[0][i]-data[0][i-1])*0.25);
								x2 = this.opts.offset.left + Xscale * (tempx - Xmin);
								// Draw a smooth curve with two control points
								p = p.concat(["C",x1.toFixed(2),prevy,x2.toFixed(2),y]);
							}else{
								tempx = this.scaleX(data[0][i] - (data[0][i]-data[0][i-1])*0.25);
								x1 = this.opts.offset.left + Xscale * (tempx - Xmin);
								// Draw a smooth curve to //cubic Bézier curve
								p = p.concat(["S",x1.toFixed(2),y]);
							}
						}
					}
					// Add the current point
					p = p.concat([x, y]);
					prevy = y;
				}
				if(tempy > max) max = tempy;
				//if(!this.chart.dots[i]) this.chart.dots.push(this.chart.holder.circle(x, y, 3).attr({fill: "#333"}));
				//else this.chart.dots[i].animate({cx: x, cy: y},100);
			}
			
			// Now we make sure we don't display any parts of the curve that are outside the plot area
			var clip = (this.opts.offset.left+0.5)+','+(this.opts.offset.top-0.5)+','+this.opts.offset.width+','+this.opts.offset.height;
			if(this.chart.line) this.chart.line.remove();
			this.chart.line = this.chart.holder.path(p).attr({stroke: "#E13F29", "stroke-width": 3, "stroke-linejoin": "round","clip-rect":clip});

		}
		
		//if(this.logging) console.log("Total for PowerSpectrum.prototype.draw(): " + (new Date() - d) + "ms");

		return this;
	}

	// Function to hide/show the power spectrum
	PowerSpectrum.prototype.toggle = function(){
		this.el.toggleClass('hidden');
		$('body').toggleClass('adv');
		this.resize();
	}

	// Will toggle as a full screen element if the browser supports it.
	PowerSpectrum.prototype.toggleFullScreen = function(){
		if(fullScreenApi.supportsFullScreen) {
			var el = document.getElementById(this.id);
			if(fullScreenApi.isFullScreen()) fullScreenApi.cancelFullScreen(el);
			else fullScreenApi.requestFullScreen(el);
		}
	}

	PowerSpectrum.prototype.updateFullScreen = function(){
			if(fullScreenApi.isFullScreen()){
				this.fullscreen = true;
				$("body").addClass('fullscreen');
			}else{
				this.fullscreen = false;
				$("body").removeClass('fullscreen');
			}

			// Re-define the options
			this.setOptions();

			// Create the new chart
			this.create();

			// Draw the data
			this.draw();
	}

	// Request the data file for the current Omega values (b,c,l) using the current Omega that has focus
	PowerSpectrum.prototype.loadData = function(id,b,c,l,fn){

		var file = "";		

		if(id=="omega_b") file = this.dir+"Ob_Oc"+c.toFixed(this.precision)+"_Ol"+l.toFixed(this.precision)+"_lin.json"
		else if(id=="omega_c") file = this.dir+"Ob"+b.toFixed(this.precision)+"_Oc_Ol"+l.toFixed(this.precision)+"_lin.json"		
		else if(id=="omega_l") file = this.dir+"Ob"+b.toFixed(this.precision)+"_Oc"+c.toFixed(this.precision)+"_Ol_lin.json"		

		if(!file || file == this.lastload){
			this.getData(id,b,c,l);
			return;
		}

		if(this.logging) console.log('Getting '+file+' for '+id)

		var _obj = this;

		// Reset data
		this.json = "";

		// Bug fix for reading local JSON file in FF3
		$.ajaxSetup({async:false,'beforeSend': function(xhr){ if (xhr.overrideMimeType) xhr.overrideMimeType("text/plain"); } });

		// Do the AJAX request for the data file
		$.ajax({
			dataType: "json", 
			url: file,
			context: _obj,
			success: function(data){
				// Keep a copy of the result
				this.json = data;
				// Process the result
				this.getData(id,b,c,l);
			},
			error: function(e){
				this.callback.context.error("We couldn't load the CMB fluctuations of this universe (&Omega;<sub>b</sub> = "+b+", &Omega;<sub>c</sub> = "+c+", &Omega;<sub>&Lambda;</sub> = "+l+"). That sucks. :-(");
				if(this.logging) console.log(file)
			},
			timeout: 4000
		});

		// We'll keep a note of the file we loaded so that we don't
		// pointlessly make multiple requests for the same one
		this.lastload = file;
	
	}
	
	// Get the data for the current Omega values (b,c,l) using the current Omega that has focus
	PowerSpectrum.prototype.getData = function(id,b,c,l){

		// If the values haven't changed we don't need to recalculate the data
		if(b==this.omega.b && c==this.omega.c && l==this.omega.l) return;

		//console.log('getData',id,b,c,l,this.omega_b,this.omega_c,this.omega_l,this.json)

		// Reset the l value for the first peak
		this.firstpeak = 0;
		
		// Store the current Omega values
		this.omega = { b:b, c:c, l:l };

		// Have we got a result from the AJAX call?
		if(this.json){

			// Check we have a well formated response
			if(this.json.extrema && this.json.extrema.length > 1){
				var i, j, data, val;
				
				val = (id=="omega_b" ? b : (id=="omega_c" ? c : l));

				// Find the row of data that is indexed by the correct Omega value
				for(i = 0 ; i < this.json.extrema.length ; i++){
					if(this.json.extrema[i][0]==val) break;
				}
				
				if(i >= this.json.extrema.length) this.callback.context.error("Oh dear. We couldn't find the CMB fluctuations for this universe (&Omega;<sub>b</sub> = "+b+", &Omega;<sub>c</sub> = "+c+", &Omega;<sub>&Lambda;</sub> = "+l+")");
				else {
					data = new Array(this.json.extrema[i].length);
					for(j = 0 ; j < this.json.extrema[i].length ; j++){
						data[j] = this.json.extrema[i][j]+0
					}
				}

				// If we found a result we need to repackage the data
				if(data){
				
					// Remove the first value from the array as it is the Omega value
					data.shift();
					
					// Restructure data
					n = data.length/2;
					x = new Array(n);
					y = new Array(n);
					for(var i = 0; i < n ; i++){
						x[i] = data[i*2];
						y[i] = data[i*2 + 1];
					}
					data = [x,y];
					this.data = data;

				}else{
					// No data so draw a horizontal line
					this.data = [[1,2500],[1,1]];
				}

				// Re-draw the data
				this.draw();
			}

		}else{
			this.callback.context.error("Something went wrong with the universe (&Omega;<sub>b</sub> = "+b+", &Omega;<sub>c</sub> = "+c+", &Omega;<sub>&Lambda;</sub> = "+l+")");
		}

		// Fire the callback
		if(typeof this.callback.updated==="function") this.callback.updated.call(this.callback.context,{firstpeak: this.firstpeak});

	}

	// An error function
	Simulator.prototype.error = function(txt){
		// Display the error message and attach the Omega values as data
		$('#error').html('<a class="close">&times;</a>'+txt).show().data('omega_b',this.omega_b.value).data('omega_c',this.omega_c.value).data('omega_l',this.omega_l.value);
		$('#error .close').on('click',function(e){ $(this).parent().hide(); });
		return;
	}

	// A warning function
	Simulator.prototype.warning = function(txt){
		// Display the error message and attach the Omega values as data
		$('#warning').html('<a class="close">&times;</a>'+txt).show();
		$('#warning .close').on('click',function(e){ $(this).parent().hide(); });
		return;
	}

	// Define the class to deal with <canvas>.
	function Canvas(i){
		if(!(typeof i=="string" || (typeof i=="object" && typeof i.id=="string"))) return;

		// Define default values
		this.id = '';
		this.canvas = '';
		this.c = '';
		this.wide = 0;
		this.tall = 0;
		this.fullscreen = false;
		this.fullwindow = false;
		this.transparent = false;
		this.color = "";
		this.background = "rgb(255,255,255)";
		this.events = {resize:""};	// Let's add some default events

		// Add options to detect for older IE
		this.ie = false;
		this.excanvas = (typeof G_vmlCanvasManager != 'undefined') ? true : false;
		/*@cc_on
		this.ie = true
		@*/

		// Overwrite defaults with variables passed to the function
		var n = "number";
		var s = "string";
		var b = "boolean";
		var o = "object";
		var f = "function";
		if(is(i.id,s)) this.id = i.id;
		if(is(i.background,s)) this.background = i.background;
		if(is(i.color,s)) this.color = i.color;
		if(is(i.width,n)) this.wide = i.width;
		if(is(i.height,n)) this.tall = i.height;
		if(is(i.fullwindow,b)) this.fullwindow = i.fullwindow;
		if(is(i.transparent,b)) this.transparent = i.transparent;

		if(!this.id) return;
		// Construct the <canvas> container
		this.container = $('#'+this.id);
		if(this.container.length == 0){
			// No appropriate container exists. So we'll make one.
			$('body').append('<div id="'+this.id+'"></div>');
			this.container = $('#'+this.id);
		}
		this.container.css('position','relative');
		//$(window).bind("resize",{me:this},function(ev){ ev.data.me.resize(); });

		if (typeof Object.extend === 'undefined') {
			this.extend = function(destination, source) {
				for (var property in source) {
					if (source.hasOwnProperty(property)) destination[property] = source[property];
				}
				return destination;
			};
		} else this.extend = Object.extend;
		
		// Add a <canvas> to it with the original ID
		this.container.html('<canvas id="'+this.id+'inner"></canvas>');

		this.containerbg = this.container.css('background');
		this.canvas = $('#'+this.id+'inner');
		this.c = document.getElementById(this.id+'inner');

		if(this.wide > 0) this.c.width = this.wide;
		if(this.tall > 0) this.c.height = this.tall;

		// For excanvas we need to initialise the newly created <canvas>
		if(this.excanvas) this.c = G_vmlCanvasManager.initElement(this.c);
	
		if(this.c && this.c.getContext){	
			this.ctx = this.c.getContext('2d');
			this.ctx.clearRect(0,0,this.wide,this.tall);
			this.ctx.beginPath();

			// Get some properties from the CSS
			var fs = parseInt(getStyle(this.id, 'font-size'));
			this.ctx.font = fs+"px "+getStyle(this.id, 'font-family');
			this.ctx.fillStyle = getStyle(this.id, 'color');
			this.ctx.lineWidth = 1.5;
			var loading = 'Loading sky...';
			this.ctx.fillText(loading,(this.wide-this.ctx.measureText(loading).width)/2,(this.tall)/2)
			this.ctx.fill();
		}

		// Bind events
		if(fullScreenApi.supportsFullScreen){
			// Bind the fullscreen function to the double-click event if the browser supports fullscreen
			this.canvas.bind('dblclick', {me:this}, function(e){ e.data.me.toggleFullScreen(); });
		}
		this.canvas.bind("mousedown",{me:this}, function(e){ e.data.me.trigger("mousedown",{event:e}); });
		this.canvas.bind("mousemove",{me:this}, function(e){ e.data.me.trigger("mousemove",{event:e}); });
		this.canvas.bind("mouseup",{me:this}, function(e){ e.data.me.trigger("mouseup",{event:e}); });
	}
	// Attach a handler to an event for the Canvas object in a style similar to that used by jQuery
	//	 .bind(eventType[,eventData],handler(eventObject));
	//	 .bind("resize",function(e){ console.log(e); });
	//	 .bind("resize",{me:this},function(e){ console.log(e.data.me); });
	Canvas.prototype.bind = function(ev,e,fn){
		if(typeof ev!="string") return this;
		if(is(fn,"undefined")){
			fn = e;
			e = {};
		}else{
			e = {data:e}
		}
		if(typeof e!="object" || typeof fn!="function") return this;
		if(this.events[ev]) this.events[ev].push({e:e,fn:fn});
		else this.events[ev] = [{e:e,fn:fn}];
		return this;
	}
	// Trigger a defined event with arguments. This is for internal-use to be 
	// sure to include the correct arguments for a particular event
	Canvas.prototype.trigger = function(ev,args){
		if(typeof ev != "string") return;
		if(typeof args != "object") args = {};
		var o = [];
		if(typeof this.events[ev]=="object"){
			for(var i = 0 ; i < this.events[ev].length ; i++){
				var e = this.extend(this.events[ev][i].e,args);
				if(typeof this.events[ev][i].fn == "function") o.push(this.events[ev][i].fn.call(this,e))
			}
		}
		if(o.length > 0) return o;
	}
	Canvas.prototype.copyToClipboard = function(){
		try{
			this.clipboard = this.ctx.getImageData(0, 0, this.wide, this.tall);
			this.clipboardData = this.clipboard.data;
		}catch(e){ this.clipboard = null; }
	}
	Canvas.prototype.pasteFromClipboard = function(){
		if(this.clipboardData && this.clipboard){
			this.clipboard.data = this.clipboardData;
			this.ctx.putImageData(this.clipboard, 0, 0);
		}
	}
	// Will toggle the <canvas> as a full screen element if the browser supports it.
	Canvas.prototype.toggleFullScreen = function(){
		if(fullScreenApi.supportsFullScreen) {
			this.elem = document.getElementById(this.id);
			if(fullScreenApi.isFullScreen()){
				fullScreenApi.cancelFullScreen(this.elem);
				this.fullscreen = false;
			}else{
				fullScreenApi.requestFullScreen(this.elem);
				this.fullscreen = true;
			}
		}
	}

	function Sky(inp){

		// Use inp to set some basic properties
		this.id = (is(inp.map,"string")) ? inp.map : "map";
		this.el = $('#'+this.id);
		this.dir = (is(inp.dir,"string")) ? inp.dir : "db/";
		this.context = (is(inp.context,"object")) ? inp.context : this;
		this.loaded = false;
		this.logging = true;
		this.sluggish = false;

		// Display options
		this.fixedscale = (is(inp.fixedscale,"boolean")) ? inp.fixedscale : true;
		this.showours = true;
		this.showscale = true;

		this.w = 256,
		this.h = 256,
		this.maxang = 10;	// angular diameter of image in degrees
		this.minang = this.maxang/this.w;
		this.dl = 360/this.maxang;

		this.re = [];
		this.im = [];
		this.src = "";

		// Load the 'our universe' image
		this.our = new Image();
		this.our.src = this.el.find('img.our').attr('src');

		// Set up the class to deal with the <canvas>
		this.canvas = new Canvas({id:this.id,width:this.w, height: this.h});

		// A place to show the FFT
		this.spectrum = {};
		this.spectrum.el = document.getElementById('spectrum');
		// Set the <canvas> width and height to a power of 2.
		// No need to worry as the CSS will stretch the canvas to the correct display size.
		this.spectrum.el.width = this.w;
		this.spectrum.el.height = this.h;
		this.spectrum.ctx = this.spectrum.el.getContext('2d');
		this.spectrum.ctx.fillStyle = '#ffffff';
		this.spectrum.ctx.fillRect(0, 0, this.w, this.h);

		// Add the labels
		this.el.append('<div class="label sim">Current universe</div><div class="label our">Our universe</div><div class="label scale"><div class="value">1&deg;</div></div>');

		FFT.init(this.w);
		FrequencyFilter.init(this.w, this.dl);
		SpectrumViewer.init(this.spectrum.ctx);

		// Add a callback for when it is loaded
		this.load();
	}
	
	// Called when the image has been loaded
	Sky.prototype.load = function(){
		this.loaded = true;
		this.setupFFT();
		this.update();
		this.resize();
		return this;
	}

	Sky.prototype.setupFFT = function(){

		if(this.logging) var d = new Date();

		// Read the blank image data into a blob
		this.src = this.spectrum.ctx.getImageData(0, 0, this.w, this.h);
		this.data = this.src.data;

		// We want the Fourier Transform of a sky with Gaussian distributed power on all scales

		// Class for making Gaussian distributed random numbers. Argument is the seed.
		var z = new Ziggurat(-1);
		var twopi = 2*Math.PI;

		var i = 0, y, x;
		for(y=0; y<this.h; y++) {
			i = y*this.w;
			for(x=0; x<this.w; x++) {
				this.re[i + x] = z.nextGaussian();
				this.im[i + x] = 0;
			}
		}

		FFT.fft2d(this.re, this.im);

		this.setColourTable('planck');
		
		if(new Date() - d > 1000) this.sluggish = true;
		if(this.logging) console.log("Total for Sky.prototype.setupFFT(): " + (new Date() - d) + "ms");

		if(this.sluggish) this.context.warning('It may take time to update the universe. Please be patient.');
		else $('#warning').hide();
		
		return this;
	}

	// Update the colour table
	Sky.prototype.setColourTable = function(ct){
		this.colours = new colourtable(ct);
	}

	// Function to resize/reposition the label div
	Sky.prototype.resize = function(){

	}
	
	// The main function to update the sky image
	Sky.prototype.update = function(){

		var d = new Date();

		try {
			
			var val = 0, p = 0, x, y, scale, re, im, mx, mn;

			// Get the pre-processed FFT data
			re = this.re.slice(0);	// We need a copy of the array, not a reference
			im = this.im.slice(0);	// We need a copy of the array, not a reference

			if(this.context.ps.data[0].length == 2){
				this.canvas.ctx.fillStyle = '#ffffff';
				this.canvas.ctx.fillRect(0, 0, this.w, this.h);
				// Hide the Our/Current labels
				$('.labels').hide();
				return;
			}else{
				// Show the Our/Current labels if necessary
				if(!$('.labels').is(':visible')) $('.labels').show();
			}

			// Filter the FFT
			FrequencyFilter.swap(re, im);
			FrequencyFilter.filter(re, im, this.context.ps.data);

			// Calculate the 2D FFT but don't bother showing it
			//SpectrumViewer.render(re, im, false);

			// FFT back into real space
			FrequencyFilter.swap(re, im);

			FFT.ifft2d(re, im);

			// Loop over the data setting the value
			// First work out a scaling function
			if(this.fixedscale){
				mx = 0.11;
				mn = -0.11;
			}else{
				mx = Math.max.apply(null,re);
				mn = Math.min.apply(null,re);
			}

			scale = 255/(mx-mn);

			for(y = 0,i = 0; y < this.h; y++, i+=this.w) {
				for(x = 0; x < this.w; x++) {
					val = Math.round((re[i + x]-mn)*scale);
					val = val > 255 ? 255 : val < 0 ? 0 : val;
					p = (i << 2) + (x << 2);
					// Set colour using pre-calculated colour table
					this.data[p] = this.colours[val][0];
					this.data[p+1] = this.colours[val][1];
					this.data[p+2] = this.colours[val][2];
				}
			}

			// Draw the final output
			this.canvas.ctx.putImageData(this.src, 0, 0);

			if(this.showours){
				// Save the canvas context before defining a clipping region
				// so we can return to the default state later
				this.canvas.ctx.save();
				// Draw a triangular region
				this.canvas.ctx.beginPath();
				this.canvas.ctx.moveTo(this.w,0);
				this.canvas.ctx.lineTo(this.w*0.4,0);
				this.canvas.ctx.lineTo(this.w,this.h*0.6);
				this.canvas.ctx.lineTo(this.w,0);
				this.canvas.ctx.clip();
	
				// Draw the image for our universe
				this.canvas.ctx.drawImage(this.our, 0, 0, this.w, this.h);
	
				// Restore the canvas context to its original state
				this.canvas.ctx.restore();
	
				// Draw a line to help distinguish universes
				this.canvas.ctx.beginPath();
				this.canvas.ctx.moveTo(this.w*0.4,0);
				this.canvas.ctx.lineTo(this.w,this.h*0.6);
				this.canvas.ctx.strokeStyle = "#fff";
				this.canvas.ctx.stroke();
			}

		} catch(e) {
			if(this.logging) console.log(e,p,val,re[i + x],i,x);
		}

		if(this.logging) console.log("Total for Sky.prototype.update():" + (new Date() - d) + "ms");
	}

	
	/**
	 * Fast Fourier Transform
	 * 1D-FFT/IFFT, 2D-FFT/IFFT (radix-2)
	 */
	var FFT = (function() {
		var _n = 0,
				_bitrev = null,
				_cstb = null,
				// public methods
				_init = function(n) {
					if(n !== 0 && (n & (n - 1)) === 0) {
						_n = n;
						_setVariables();
						_makeBitReversal();
						_makeCosSinTable();
					} else {
						throw new Error("init: radix-2 required");
					}
				},
				// 1D-FFT
				_fft1d = function(re, im) {
					_fft(re, im, 1);
				},
				// 1D-IFFT
				_ifft1d = function(re, im) {
					var n = 1/_n;
					_fft(re, im, -1);
					for(var i=0; i<_n; i++) {
						re[i] *= n;
						im[i] *= n;
					}
				},
				// 2D-FFT
				_fft2d = function(re, im) {
					var x,x1,x2,y,y1,y2;
					var tre = [],
							tim = [],
							i = 0;
					// x-axis
					for(y=0,i=0; y<_n; y++,i+=_n) {
						for(x1=0; x1<_n; x1++) {
							tre[x1] = re[x1 + i];
							tim[x1] = im[x1 + i];
						}
						_fft1d(tre, tim);
						for(x2=0; x2<_n; x2++) {
							re[x2 + i] = tre[x2];
							im[x2 + i] = tim[x2];
						}
					}
					// y-axis
					for(x=0,i=0; x<_n; x++) {
						for(y1=0; y1<_n; y1++) {
							i = x + y1*_n;
							tre[y1] = re[i];
							tim[y1] = im[i];
						}
						_fft1d(tre, tim);
						for(y2=0; y2<_n; y2++) {
							i = x + y2*_n;
							re[i] = tre[y2];
							im[i] = tim[y2];
						}
					}
				},
				// 2D-IFFT
				_ifft2d = function(re, im) {
					var tre = [],
							tim = [],
							i = 0;
					var x,x1,x2,y,y1,y2;
					// x-axis
					for(y = 0 ; y < _n ; y++, i+=_n) {
						for(x1 = 0 ; x1 <_n ; x1++) {
							tre[x1] = re[x1 + i];
							tim[x1] = im[x1 + i];
						}
						_ifft1d(tre, tim);
						for(x2 = 0 ; x2 < _n ; x2++) {
							re[x2 + i] = tre[x2];
							im[x2 + i] = tim[x2];
						}
					}
					// y-axis
					for(x = 0 ; x < _n ; x++) {
						i = x;
						for(y1=0; y1<_n; y1++, i+=_n) {
							tre[y1] = re[i];
							tim[y1] = im[i];
						}
						_ifft1d(tre, tim);
						i = x;
						for(y2=0; y2<_n; y2++,i+=_n) {
							re[i] = tre[y2];
							im[i] = tim[y2];
						}
					}
				},
				// private methods
				// core operation of FFT
				_fft = function(re, im, inv) {
					var d, h, ik, m, tmp, wr, wi, xr, xi,
							n4 = _n >> 2;
					var k, j, i;
					// bit reversal
					for(var l=0; l<_n; l++) {
						m = _bitrev[l];
						if(l < m) {
							tmp = re[l];
							re[l] = re[m];
							re[m] = tmp;
							tmp = im[l];
							im[l] = im[m];
							im[m] = tmp;
						}
					}
					// butterfly operation
					for(k=1; k<_n; k<<=1) {
						h = 0;
						d = _n/(k << 1);
						for(j=0; j<k; j++) {
							wr = _cstb[h + n4];
							wi = inv*_cstb[h];
							for(i=j; i<_n; i+=(k<<1)) {
								ik = i + k;
								xr = wr*re[ik] + wi*im[ik];
								xi = wr*im[ik] - wi*re[ik];
								re[ik] = re[i] - xr;
								re[i] += xr;
								im[ik] = im[i] - xi;
								im[i] += xi;
							}
							h += d;
						}
					}
				},
				// set variables
				_setVariables = function() {
					_bitrev = [];
					_cstb = [];
				},
				// make bit reversal table
				_makeBitReversal = function() {
					var i = 0,
							j = 0,
							k = 0;
					_bitrev[0] = 0;
					while(++i < _n) {
						k = _n >> 1;
						while(k <= j) {
							j -= k;
							k >>= 1;
						}
						j += k;
						_bitrev[i] = j;
					}
				},
				// make trigonometiric function table
				_makeCosSinTable = function() {
					var n2 = _n >> 1,
							n4 = _n >> 2,
							n8 = _n >> 3,
							n2p4 = n2 + n4,
							t = Math.sin(Math.PI/_n),
							dc = 2*t*t,
							ds = Math.sqrt(dc*(2 - dc)),
							c = _cstb[n4] = 1,
							s = _cstb[0] = 0;
					t = 2*dc;
					for(var i=1; i<n8; i++) {
						c -= dc;
						dc += t*c;
						s += ds;
						ds -= t*s;
						_cstb[i] = s;
						_cstb[n4 - i] = c;
					}
					if(n8 !== 0) {
						_cstb[n8] = Math.sqrt(0.5);
					}
					for(var j=0; j<n4; j++) {
						_cstb[n2 - j]	= _cstb[j];
					}
					for(var k=0; k<n2p4; k++) {
						_cstb[k + n2] = -_cstb[k];
					}
				};
		// public APIs
		return {
			init: _init,
			fft: _fft1d,
			ifft: _ifft1d,
			fft1d: _fft1d,
			ifft1d: _ifft1d,
			fft2d: _fft2d,
			ifft2d: _ifft2d
		};
	})();

	/**
	 * Spatial Frequency Filtering
	 * High-pass/Low-pass/Band-pass Filter
	 * Windowing using hamming window
	 */
	var FrequencyFilter = (function() {
		var _n = 0,
		_ls = [],	// The corresponding l values for each pixel
		_llpo = [],	// The corresponding l(l+1) values for each pixel
		_init = function(n, dl) {
			if(n !== 0 && (n & (n - 1)) === 0) {
				_n = n;
			} else {
				throw new Error("init: radix-2 required");
			}

			var i = 0, p;
			var n2 = _n >> 1;	// Half the value of n
			if(!dl || typeof dl!=="number") dl = 0;
			var r = 0; // The radius value
	
			for(var y=-n2; y<n2; y++) {
				i = n2 + (y + n2)*_n;
				for(var x=-n2; x<n2; x++) {
					p = x + i;
					r = Math.sqrt(((x*x) + (y*y)));
					_ls[p] = (r==0) ? dl : r*dl;
					_llpo[p] = _ls[p]*(_ls[p]+1);
				}
			}
		},
		// swap quadrant
		_swap = function(re, im) {
			var xn, yn, i, j, k, l, tmp,
					len = _n >> 1;
			for(var y=0; y<len; y++) {
				yn = y + len;
				for(var x=0; x<len; x++) {
					xn = x + len;
					i = x + y*_n;
					j = xn + yn*_n;
					k = x + yn*_n;
					l = xn + y*_n;
					tmp = re[i];
					re[i] = re[j];
					re[j] = tmp;
					tmp = re[k];
					re[k] = re[l];
					re[l] = tmp;
					tmp = im[i];
					im[i] = im[j];
					im[j] = tmp;
					tmp = im[k];
					im[k] = im[l];
					im[l] = tmp;
				}
			}
		},
		// apply custom filter
		_filter = function(re, im, data){

			var i = 0,
				v = 0;
				p = 0,
				x = 0,
				y = 0,
				z = 0,
				zlen = data[0].length,
				zlenb = zlen-1;
				n2 = _n >> 1;	// Bit operator to halve _n


			for(y=-n2; y<n2; y++) {
				i = n2 + (y + n2)*_n;
				for(x=-n2; x<n2; x++) {
					p = x + i;
					for(z = 0 ; z < zlen ; z++){
						if(_ls[p] > data[0][zlenb]){
							v = data[1][zlenb];
							break;
						}
						if(data[0][z] > _ls[p]){
							v = (z == 0) ? data[1][z] : (data[1][z-1] + (data[1][z] - data[1][z-1])*(_ls[p] - data[0][z-1])/(data[0][z] - data[0][z-1]));
							break;
						}
					}
					v /= _llpo[p];	// We need to reduce the power by a factor l(l+1) as our power spectrum is scaled by that
					v = Math.sqrt(v);
					re[p] *= v;
					im[p] *= v;
				}
			}

		},
		_setFilter = function(f){
			if(typeof f==="function") _filter = f;
		};
		// public APIs
		return {
			init: _init,
			swap: _swap,
			filter: _filter,
			setFilter: _setFilter
		};
	})();
	
	/**
	 * FFT Power Spectrum Viewer
	 */
	var SpectrumViewer = (function() {
		var _context = null,
				_n = 0,
				_img = null,
				_data = null,
				// public methods
				_init = function(context) {
					_context = context;
					_n = context.canvas.width,
					_img = context.getImageData(0, 0, _n, _n);
					_data = _img.data;
				},
				// render FFT power spectrum on the Canvas
				_render = function(re, im, islog) {
					var val = 0,
							i = 0,
							p = 0,
							spectrum = [],
							max = 1.0,
							imax = 0.0,
							n2 = _n*_n;
					for(var i=0; i<n2; i++) {
						if(islog){
							spectrum[i] = Math.log(Math.sqrt(re[i]*re[i] + im[i]*im[i]));
						} else {
							spectrum[i] = Math.sqrt(re[i]*re[i] + im[i]*im[i]);
						}
						if(spectrum[i] > max) {
							max = spectrum[i];
						}
					}
					imax = 1/max;
					for(var j=0; j<n2; j++) {
						spectrum[j] = spectrum[j]*255*imax;
					}
					for(var y=0; y<_n; y++) {
						i = y*_n;
						for(var x=0; x<_n; x++) {
							val = spectrum[i + x];
							p = (i << 2) + (x << 2);
							_data[p] = 0;
							_data[p + 1] = val;
							_data[p + 2] = val >> 1;
						}
					}
					_context.putImageData(_img, 0, 0);
				};
		// public APIs
		return {
			init: _init,
			render: _render
		};
	})();



	// The main function
	function Simulator(inp){

		// A place to cache the previous Omega values
		this.previous = { omega_b: -1, omega_c: -1, omega_l: -1 };
		this.exhibition = true;
		this.fs = parseInt($('body').css('font-size'));

		if(this.exhibition && $('body').width() > 1200){
			this.fs = parseInt(this.fs*$('body').width()/1200);
			if($('body').width() > 1000) $('body').css({'font-size':this.fs+'px'});
		}
		
		// We obviously have Javascript enabled to be here so we will remove the hiding class
		$('.scriptonly').removeClass('scriptonly');

		if(!inp) inp = {};

		// Define some callback functions
		var change = function(e){
			this.ps.getData(e.id,this.omega_b.value,this.omega_c.value,this.omega_l.value);
		},
		mouseenter = function(e){
			this.ps.loadData(e.id,this.omega_b.value,this.omega_c.value,this.omega_l.value);
		}
		
		var _obj = this;
		
		// Set up the three Omega sliders
		this.omega_b = new ParameterSlider({
			select: $("#"+((inp.omega_b && typeof inp.omega_b==="string") ? inp.omega_b : "omega_b")),
			context: _obj,
			change: change,
			mouseenter: mouseenter
		});
	
		this.omega_c = new ParameterSlider({
			select: $("#"+((inp.omega_c && typeof inp.omega_c==="string") ? inp.omega_c : "omega_c")),
			context: _obj,
			change: change,
			mouseenter: mouseenter
		});
	
		this.omega_l = new ParameterSlider({
			select: $("#"+((inp.omega_l && typeof inp.omega_l==="string") ? inp.omega_l : "omega_l")),
			context: _obj,
			change: change,
			mouseenter: mouseenter
		});

		// Replace our "inp" Omegas with the values from the sliders
		inp.omega_b = this.omega_b.value;
		inp.omega_c = this.omega_c.value;
		inp.omega_l = this.omega_l.value;

		// Keep a copy of the starting values
		this.our = { omega_b: 0.050, omega_c: 0.275, omega_l: 0.675 };

		// Hide the About section if we aren't at that anchor
		if(location.hash.substring(1) != "about"){
			$('#help').addClass('on');
			$('#about').hide();
		}


		// Make an instance of a cosmology
		this.cosmos = new Cosmos(inp.omega_b,inp.omega_c,inp.omega_l);

		// Define a callback for the PowerSpectrum
		inp.context = this;
		inp.updated = function(e){
			if(this.sky){
				_obj.update(e);
				this.sky.update();
			}
		}

		// Make an instance of a power spectrum
		this.ps = new PowerSpectrum(inp);
		
		// Make an instance of a view of part of the sky
		this.sky = new Sky(inp);

		// Make option buttons
		$('#options').append(
			$('<a class="button ouruniverse" href="#">Our universe</a>').on('click',{me:this},function(e){
				e.preventDefault();
				var sim = e.data.me;
				sim.omega_b.setValue(sim.our.omega_b);
				sim.omega_c.setValue(sim.our.omega_c);
				sim.omega_l.setValue(sim.our.omega_l);
				sim.ps.loadData('omega_b',sim.omega_b.value,sim.omega_c.value,sim.omega_l.value);
			}),
			$('<a class="button matteronly" href="#">Normal matter only</a>').on('click',{me:this},function(e){
				e.preventDefault();
				var sim = e.data.me;
				sim.omega_b.setValue(0.20);
				sim.omega_c.setValue(0.00);
				sim.omega_l.setValue(0.00);
				sim.ps.loadData('omega_b',sim.omega_b.value,sim.omega_c.value,sim.omega_l.value);
			}),
			$('<a class="button flatten" href="#">Flatten</a>').on('click',{me:this},function(e){
				e.preventDefault();
				var sim = e.data.me;
				var ob = sim.omega_b.value;
				var oc = sim.omega_c.value;
				var ol = sim.omega_l.value;
				var tot = (ob + oc + ol);
				if(tot > 1){
					// Currently open
					if(ob + oc <= 1.0){
						// Reduce dark energy
						sim.omega_l.setValue(1-oc-ob);
					}else{
						// Change Omega_c and remove dark energy
						sim.omega_c.setValue(1-ob);
						sim.omega_l.setValue(0.000);
					}
				}else if(tot < 1){
					// Currently closed
					if(ob + oc <= 1.0){
						sim.omega_b.setValue(1-oc-ol);
					}else sim.omega_c.setValue(1-ob);					
				}
				sim.ps.loadData('omega_b',sim.omega_b.value,sim.omega_c.value,sim.omega_l.value);
			})
		);

		// Set up the configuration form
		$('#config form').append('<div class="configoption"><input type="checkbox" name="showscale" /><label for="showscale">Show angular scale</label></a></div><div class="configoption"><input type="checkbox" name="showours" /><label for="showours">Show our universe</label></a></div><div class="configoption"><input type="checkbox" name="normscale" /><label for="normscale">Normalise scale</label></div><!--<div class="configoption"><label for="colourtable">Colour scheme</label>: <select name="colourtable" id="colourtable"><option value="planck">Planck</option><option value="blackbody">Heat</option><option value="A">A</option><option value="B">B</option></select></div>-->');
		$('#config form input[name=showscale]').attr('checked',this.sky.showscale).on('click',{me:this},function(e){
			var sim = e.data.me;
			sim.sky.showscale = $(this).is(':checked');
			sim.ps.toggleTicks();
			sim.update();
		});
		$('#config form input[name=showours]').attr('checked',this.sky.showours).on('click',{me:this},function(e){
			var sim = e.data.me;
			sim.sky.showours = $(this).is(':checked');
			sim.sky.update();
			sim.update();
		});
		$('#config form input[name=normscale]').attr('checked',!this.sky.fixedscale).on('click',{me:this},function(e){
			var sim = e.data.me;
			sim.sky.fixedscale = !$(this).is(':checked');
			sim.ps.fixedscale = sim.sky.fixedscale;
			sim.sky.update();
			sim.ps.draw();
			sim.update();
		})
		$('#config form select').on('change',{me:this},function(e){
			e.data.me.sky.setColourTable($(this).val());
			e.data.me.sky.update();
			e.data.me.update();
		});
		// Make labels trigger click on their inputs
		$('label').on('click',{me:this},function(e){
			var labelID = $(this).attr('for');
			$('#config form input[name='+labelID+']').trigger('click');
		});


		// Bind keyboard events
		$(document).bind('keypress',{sim:this},function(e){
			if(!e) e=window.event;
			sim = e.data.sim;
			var code = e.keyCode || e.charCode || e.which || 0;
			var c = String.fromCharCode(code).toLowerCase();
			if(c=='a') sim.ps.toggle();
			else if(c=='b') sim.omega_b.slider.find('.ui-slider-handle').focus();
			else if(c=='c') sim.omega_c.slider.find('.ui-slider-handle').focus();
			else if(c=='l') sim.omega_l.slider.find('.ui-slider-handle').focus();
			else if(c=='i') window.location.href = switchHash();
			else if(c=='f') sim.ps.toggleFullScreen();
		});
	
		// Bind window resize event for when people change the size of their browser
		$(window).bind("resize",{me:this},function(ev){
			ev.data.me.resize();
		});
		
		// Function to return the correct page anchor
		function switchHash(){
			if(location.hash.substring(1)=="about") return "#";
			else return "#about";
		}
		// Build element that will let the user toggle the About section
		var lasttoggle = new Date();
		function toggleAbout(key){
			var now = new Date();
			if(now - lasttoggle > 500){
				$('#help').toggleClass('on');
				if($('#help').hasClass('on')) $('#about').slideDown();
				else $('#about').slideUp();
			}
			lasttoggle = now;
			return true;
		}
		// As we are using the hash anchor, we need to monitor it to check for changes
		var hashstate = "";
		setInterval(function(){
			if(location.hash.substring(1)=="about" && !$('#help').hasClass('on')) toggleAbout();
			if(location.hash.substring(1)!="about" && $('#help').hasClass('on')) toggleAbout();
		},500);

		var newdiv = $('<div id="menu"><div id="help" class="toggle"><a href="#about" class="abouton">i</a><a href="#" class="aboutoff">&#8679;</a></div><div id="advancedtoggle" class="toggle"><a href="#powerspectrum"><img src="media/img/cleardot.gif" alt="Plot" title="Toggle power spectrum plot" /></a></div><div id="configtoggle" class="toggle"><a href="#config"><img src="media/img/cleardot.gif" alt="Options" title="Toggle options" /></a></div></div>');
		$('h1').before(newdiv);
		$('#help .abouton a, #help .aboutoff a').on('click',toggleAbout);
		$('#advancedtoggle a').on('click',{me:this},function(e){
			e.preventDefault();
			e.data.me.ps.toggle();
			return true;
		});
		$('#configtoggle').on('click',{me:this},function(e){
			lightbox($('#config'),$('#configtoggle'));
		});


		// Update labels, buttons etc
		this.update();

		// Temporary fixes for Royal Society Summer Exhibition
		// where there is no internet access
		if(this.exhibition){
			$('#about a').on('click',function(e){
				e.preventDefault();
			});

			// Rescale the Map to make use of the screen
			var hdiff = $(window).height() - $('body').outerHeight();
			if(hdiff > 0){
				var w = ($('#map').outerHeight() + hdiff)-(2*this.fs); // The 32 is a fudge to allow for the ell message to stop a vertical scroll bar appearing
				$('.columnspecific, #map, #fft').css({'width':w+'px','height':w+'px'});
			}
			this.ps.resize();
		}

		return this;
	}


	Simulator.prototype.resize = function(){
		this.ps.resize();
		this.sky.resize();
		this.update();
		return this;
	}
	
	Simulator.prototype.update = function(e){

		if($('#map') && this.sky){
			var v = Math.round(this.sky.canvas.canvas.outerWidth()/this.sky.maxang)+'px';
			var p = ((this.sky.canvas.container.outerWidth()-this.sky.canvas.canvas.outerWidth())/2)+'px';
			$('#map .label.scale').css({'margin-right':p,'width': v, 'height': v, 'line-height': v, 'border-radius': v });
			$('#map .label.sim').css('margin-left',p);
			$('#map .label.our').css('margin-right',p);
			if(this.sky.showscale) $('#map .label.scale').show();
			else $('#map .label.scale').hide();

			if(this.sky.showours) $('.label.our').show();
			else $('.label.our').hide();
		}
	
		if(this.previous.omega_b == this.omega_b.value && this.previous.omega_c == this.omega_c.value && this.previous.omega_l == this.omega_l.value) return this;
		else this.previous = { omega_b: this.omega_b.value, omega_c: this.omega_c.value, omega_l: this.omega_l.value };

		// Hide the error message if the omegas are different to the ones attached to the error message
		if($('#error')){
			if($('#error').data('omega_b')!=this.omega_b.value || $('#error').data('omega_c')!=this.omega_c.value || $('#error').data('omega_l')!=this.omega_l.value) $('#error').hide();
		}
		
		// Update text labels
		if($('#firstpeak')){
			// Display the first peak along with the roughly equivalent angular size
			var ang = 180/this.ps.firstpeak;
			if(this.ps.firstpeak > 0) $('#firstpeak').html('First peak at <span class="property">&#8467; = '+this.ps.firstpeak+'</span> (~'+(ang > 0.5 ? ang.toFixed(1) : ang.toFixed(2))+'&deg;)');
			else $('#firstpeak').html('No fluctuations in the CMB'+(this.omega_b.value == 0 ? ' because there<br />was no matter to interact with the photons.' : ''));
		}else{
			$('#firstpeak').html('?');
		}
		if($('#age')){
			this.cosmos.compute(this.omega_b.value, this.omega_c.value, this.omega_l.value);
			$('#age').html('<span class="age property">'+this.cosmos.age_Gyr.toFixed(1)+'</span> billion years old');
		}
		if($('#curvature')){
			var tot = this.omega_b.value + this.omega_c.value + this.omega_l.value;
			$('#curvature').html('<span class="property curvature">'+((tot > 1) ? 'closed' : (tot < 1) ? 'open' : 'flat')+'</span> universe');
			if(tot == 1) $('.button.flatten').hide();
			else $('.button.flatten').show();
		}

		$('span.omega_b').html(' = '+this.omega_b.value);
		$('span.omega_c').html(' = '+this.omega_c.value);
		$('span.omega_l').html(' = '+this.omega_l.value);

		return this;
	}


	// Inspired by Ned Wright's Cosmology Calculator
	// http://www.astro.ucla.edu/~wright/CosmoCalc.html
	function Cosmos(b,c,l){
		this.n = 1000;	// number of points in integrals
		this.nda = 1;	// number of digits in angular size distance
		this.H0 = 67;	// Hubble constant from Planck (tweaked to account for Omegas being off from the Planck values)
		this.WM = b+c;	// Omega(matter)
		this.WV = l;	// Omega(vacuum) or lambda
		this.WR = 0;	// Omega(radiation)
		this.WK = 0;	// Omega curvaturve = 1-Omega(total)
		this.z = 3.0;	// redshift of the object
		this.h = this.H0/100;	// H0/100
		this.c = 299792.458; // velocity of light in km/sec
		this.Tyr = 977.8; // coefficent for converting 1/H into Gyr
		this.DTT = 0.5;	// time from z to now in units of 1/H0
		this.DTT_Gyr = 0.0;	// value of DTT in Gyr
		this.age = 0.5;	// age of Universe in units of 1/H0
		this.age_Gyr = 0.0;	// value of age in Gyr
		this.zage = 0.1;	// age of Universe at redshift z in units of 1/H0
		this.zage_Gyr = 0.0;	// value of zage in Gyr
		this.DCMR = 0.0;	// comoving radial distance in units of c/H0
		this.DCMR_Mpc = 0.0;
		this.DCMR_Gyr = 0.0;
		this.a = 1.0;	// 1/(1+z), the scale factor of the Universe
		this.az = 0.5;	// 1/(1+z(object));
		
		this.compute(b,c,l);

		return this;
	}

	// Compute the universe given the Omega_baryons, Omega_cdm and Omega_lambda
	Cosmos.prototype.compute = function(b,c,l){

		this.WM = b+c;
		this.WV = l;

		this.h = this.H0/100;
		this.WR = 4.165E-5/(this.h*this.h);	// includes 3 massless neutrino species, T0 = 2.72528
		this.WK = 1-this.WM-this.WR-this.WV;	// Ned Wright's version
		this.az = 1.0/(1+1.0*this.z);
		this.age = 0;
		for (i = 0; i != this.n; i++) {
			this.a = this.az*(i+0.5)/this.n;
			this.adot = Math.sqrt(this.WK+(this.WM/this.a)+(this.WR/(this.a*this.a))+(this.WV*this.a*this.a));
			this.age = this.age + 1/this.adot;
		};
		this.zage = this.az*this.age/this.n;
	
		// correction for annihilations of particles not present now like e+/e-
		// added 13-Aug-03 based on T_vs_t.f
		var lpz = Math.log((1+1.0*this.z))/Math.log(10.0);
		var dzage = 0;
		if (lpz >	7.500) dzage = 0.002 * (lpz -	7.500);
		if (lpz >	8.000) dzage = 0.014 * (lpz -	8.000) +	0.001;
		if (lpz >	8.500) dzage = 0.040 * (lpz -	8.500) +	0.008;
		if (lpz >	9.000) dzage = 0.020 * (lpz -	9.000) +	0.028;
		if (lpz >	9.500) dzage = 0.019 * (lpz -	9.500) +	0.039;
		if (lpz > 10.000) dzage = 0.048;
		if (lpz > 10.775) dzage = 0.035 * (lpz - 10.775) +	0.048;
		if (lpz > 11.851) dzage = 0.069 * (lpz - 11.851) +	0.086;
		if (lpz > 12.258) dzage = 0.461 * (lpz - 12.258) +	0.114;
		if (lpz > 12.382) dzage = 0.024 * (lpz - 12.382) +	0.171;
		if (lpz > 13.055) dzage = 0.013 * (lpz - 13.055) +	0.188;
		if (lpz > 14.081) dzage = 0.013 * (lpz - 14.081) +	0.201;
		if (lpz > 15.107) dzage = 0.214;
		this.zage = this.zage*Math.pow(10.0,dzage);
		this.zage_Gyr = (this.Tyr/this.H0)*this.zage;
		this.DTT = 0.0;
		this.DCMR = 0.0;
		// do integral over a=1/(1+z) from az to 1 in n steps, midpoint rule
		for (i = 0; i != this.n; i++) {
			this.a = this.az+(1-this.az)*(i+0.5)/this.n;
			this.adot = Math.sqrt(this.WK+(this.WM/this.a)+(this.WR/(this.a*this.a))+(this.WV*this.a*this.a));
			this.DTT = this.DTT + 1/this.adot;
			this.DCMR = this.DCMR + 1/(this.a*this.adot);
		};
		this.DTT = (1-this.az)*this.DTT/this.n;
		this.DCMR = (1-this.az)*this.DCMR/this.n;
		this.age = this.DTT+this.zage;
		this.age_Gyr = this.age*(this.Tyr/this.H0);
		this.DTT_Gyr = (this.Tyr/this.H0)*this.DTT;
		this.DCMR_Gyr = (this.Tyr/this.H0)*this.DCMR;
		this.DCMR_Mpc = (this.c/this.H0)*this.DCMR;
	}
	
	


	// HELPER FUNCTIONS


	// Create a colour table with 256 values
	function colourtable(type){
		var table = new Array(256);
		for(var i = 0; i < table.length ; i++){
			table[i] = colour(i,type);
		}
		return table;
	}

	// Given an input in the range 0-255 return the RGB
	function colour(v,type){

		// Colour scales defined by SAOImage
		if(type=="blackbody" || type=="heat") return [((v<=127.5) ? v*2 : 255), ((v>63.75) ? ((v<191.25) ? (v-63.75)*2 : 255) : 0), ((v>127.5) ? (v-127.5)*2 : 0)];
		else if(type=="A") return [((v<=63.75) ? 0 : ((v<=127.5) ? (v-63.75)*4 : 255)), ((v<=63.75) ? v*4 : ((v<=127.5) ? (127.5-v)*4 : ((v<191.25) ? 0: (v-191.25)*4))), ((v<31.875) ? 0 : ((v<127.5) ? (v-31.875)*8/3 : ((v < 191.25) ? (191.25-v)*4 : 0)))];
		else if(type=="B") return [((v<=63.75) ? 0 : ((v<=127.5) ? (v-63.75)*4 : 255)), ((v<=127.5) ? 0 : ((v<=191.25) ? (v-127.5)*4 : 255)), ((v<63.75) ? v*4 : ((v<127.5) ? (127.5-v)*4 : ((v<191.25) ? 0 : (v-191.25)*4 ))) ];
		else{
			// The Planck colour scheme
			var dv,dr,dg,db,rgb;
			
			if(v < 42){
				dv = v/42;
				rgb = [0,0,255];
				dr = 0;
				dg = 112;
				db = 0;
			}else if(v >= 42 && v < 85){
				dv = (v - 42)/43;
				rgb = [0,112,255];
				dr = 0;
				dg = 109;
				db = 0;
			}else if(v >= 85 && v < 127){
				dv = (v - 85)/42;
				rgb = [0,221,255];
				dr = 255;
				dg = 16;
				db = -38;
			}else if(v >= 127 && v < 170){
				dv = (v - 127)/43;
				rgb = [255,237,217];
				dr = 0;
				dg = -57;
				db = -217;
			}else if(v >= 170 && v < 212){
				dv = (v-170)/42;
				rgb = [255,180,0];
				dr = 0;
				dg = -105;
				db = 0;
			}else if(v >= 212){
				dv = (v-212)/43;
				rgb = [255,75,0];
				dr = -155;
				dg = -75;
				db = 0;
			}
			return [Math.round(rgb[0] + dv*dr), Math.round(rgb[1] + dv*dg), Math.round(rgb[2] + dv*db)];
		}
	}
	
	// Define a shortcut for checking variable types
	function is(a,b){ return (typeof a == b) ? true : false; }


	// A non-jQuery dependent function to get a style
	function getStyle(el, styleProp) {
		if (typeof window === 'undefined') return;
		var style;
		var el = document.getElementById(el);
		if (el && el.currentStyle) style = el.currentStyle[styleProp];
		else if (window.getComputedStyle) style = document.defaultView.getComputedStyle(el, null).getPropertyValue(styleProp);
		if (style && style.length === 0) style = null;
		return style;
	}


	// Full Screen API - http://johndyer.name/native-fullscreen-javascript-api-plus-jquery-plugin/
	var fullScreenApi = {
		supportsFullScreen: false,
		isFullScreen: function() { return false; },
		requestFullScreen: function() {},
		cancelFullScreen: function() {},
		fullScreenEventName: '',
		prefix: ''
	},
	browserPrefixes = 'webkit moz o ms khtml'.split(' ');
	// check for native support
	if (typeof document.cancelFullScreen != 'undefined') {
		fullScreenApi.supportsFullScreen = true;
	} else {
		// check for fullscreen support by vendor prefix
		for (var i = 0, il = browserPrefixes.length; i < il; i++ ) {
			fullScreenApi.prefix = browserPrefixes[i];
			if (typeof document[fullScreenApi.prefix + 'CancelFullScreen' ] != 'undefined' ) {
				fullScreenApi.supportsFullScreen = true;
				break;
			}
		}
	}
	// update methods to do something useful
	if (fullScreenApi.supportsFullScreen) {
		fullScreenApi.fullScreenEventName = fullScreenApi.prefix + 'fullscreenchange';
		fullScreenApi.isFullScreen = function() {
			switch (this.prefix) {
				case '':
					return document.fullScreen;
				case 'webkit':
					return document.webkitIsFullScreen;
				default:
					return document[this.prefix + 'FullScreen'];
			}
		}
		fullScreenApi.requestFullScreen = function(el) {
			return (this.prefix === '') ? el.requestFullScreen() : el[this.prefix + 'RequestFullScreen']();
		}
		fullScreenApi.cancelFullScreen = function(el) {
			return (this.prefix === '') ? document.cancelFullScreen() : document[this.prefix + 'CancelFullScreen']();
		}
	}
	// jQuery plugin
	if (typeof jQuery != 'undefined') {
		jQuery.fn.requestFullScreen = function() {
			return this.each(function() {
				if (fullScreenApi.supportsFullScreen) {
					fullScreenApi.requestFullScreen(this);
				}
			});
		};
	}
	// export api
	window.fullScreenApi = fullScreenApi;
	// End of Full Screen API

	/*
	 * jQuery UI Touch Punch 0.2.2
	 *
	 * Copyright 2011, Dave Furfero
	 * Dual licensed under the MIT or GPL Version 2 licenses.
	 * From https://github.com/furf/jquery-ui-touch-punch
	 *
	 * Depends:
	 *  jquery.ui.widget.js
	 *  jquery.ui.mouse.js
	 */
	(function(b){b.support.touch="ontouchend" in document;if(!b.support.touch){return;}var c=b.ui.mouse.prototype,e=c._mouseInit,a;function d(g,h){if(g.originalEvent.touches.length>1){return;}g.preventDefault();var i=g.originalEvent.changedTouches[0],f=document.createEvent("MouseEvents");f.initMouseEvent(h,true,true,window,1,i.screenX,i.screenY,i.clientX,i.clientY,false,false,false,false,0,null);g.target.dispatchEvent(f);}c._touchStart=function(g){var f=this;if(a||!f._mouseCapture(g.originalEvent.changedTouches[0])){return;}a=true;f._touchMoved=false;d(g,"mouseover");d(g,"mousemove");d(g,"mousedown");};c._touchMove=function(f){if(!a){return;}this._touchMoved=true;d(f,"mousemove");};c._touchEnd=function(f){if(!a){return;}d(f,"mouseup");d(f,"mouseout");if(!this._touchMoved){d(f,"click");}a=false;};c._mouseInit=function(){var f=this;f.element.bind("touchstart",b.proxy(f,"_touchStart")).bind("touchmove",b.proxy(f,"_touchMove")).bind("touchend",b.proxy(f,"_touchEnd"));e.call(f);};})(jQuery);

	// From http://www.filosophy.org/post/35/normaldistributed_random_values_in_javascript_using_the_ziggurat_algorithm/
	function Ziggurat(v) {
	
		var jsr = 123456789;
		
		var wn = Array(128);
		var fn = Array(128);
		var kn = Array(128);
		
		function RNOR(){
			var hz = SHR3();
			var iz = hz & 127;
			return (Math.abs(hz) < kn[iz]) ? hz * wn[iz] : nfix(hz, iz);
		}
		
		this.nextGaussian = function(){
			return RNOR();
		}
		
		function nfix(hz, iz){
			var r = 3.442619855899;
			var r1 = 1.0 / r;
			var x;
			var y;
			while(true){
				x = hz * wn[iz];
				if( iz == 0 ){
					x = (-Math.log(UNI()) * r1); 
					y = -Math.log(UNI());
					while( y + y < x * x){
						x = (-Math.log(UNI()) * r1); 
						y = -Math.log(UNI());
					}
					return ( hz > 0 ) ? r+x : -r-x;
				}
			
				if( fn[iz] + UNI() * (fn[iz-1] - fn[iz]) < Math.exp(-0.5 * x * x) ){
					return x;
				}
				hz = SHR3();
				iz = hz & 127;
				
					if( Math.abs(hz) < kn[iz]){
					return (hz * wn[iz]);
				}
			}
		}
		
		function SHR3(){
			var jz = jsr;
			var jzr = jsr;
			jzr ^= (jzr << 13);
			jzr ^= (jzr >>> 17);
			jzr ^= (jzr << 5);
			jsr = jzr;
			return (jz+jzr) | 0;
		}
		
		function UNI(){
			return 0.5 * (1 + SHR3() / -Math.pow(2,31));
		}
		
		function zigset(v){
			// seed generator based on current time
			jsr ^= (typeof v==="number") ? v : new Date().getTime();
			
			var m1 = 2147483648.0;
			var dn = 3.442619855899;
			var tn = dn;
			var vn = 9.91256303526217e-3;
			
			var q = vn / Math.exp(-0.5 * dn * dn);
			kn[0] = Math.floor((dn/q)*m1);
			kn[1] = 0;
			
			wn[0] = q / m1;
			wn[127] = dn / m1;
			
			fn[0] = 1.0;
			fn[127] = Math.exp(-0.5 * dn * dn);
		
			for(var i = 126; i >= 1; i--){
				dn = Math.sqrt(-2.0 * Math.log( vn / dn + Math.exp( -0.5 * dn * dn)));
				kn[i+1] = Math.floor((dn/tn)*m1);
				tn = dn;
				fn[i] = Math.exp(-0.5 * dn * dn);
				wn[i] = dn / m1;
			}
		}
		zigset(v);
	}

	// Re-cycled from LCOGT's Odin		
	function lightbox(lb,revert,callback){
		if(!lb.length) return;
		var l = lb.position().left;
		var t = lb.position().top;
		var h = $(document).height();
		var parent = lb.parent();
		var me = lb.detach();
		$("body").append('<div class="lightbox_bg"></div>')
		me.appendTo('body');
		lb.addClass('lightbox_top').show().attr('role','dialog');
	
		if(lb.find('.close').length==0) lb.prepend('<a href="#" class="close">&times;</a>');
	
		$('.lightbox_top form').on('submit',{lb:lb,revert:revert},function(e){
			if(e.data.revert && e.data.revert.length > 0){
				if(e.data.revert.get(0).nodeName!="A") e.data.revert = e.data.revert.find('a').eq(0);
				e.data.revert.focus();
			}
			closeLightbox(e.data.lb);
		});
	
		$('.lightbox_top .close').show().on('click',{lb:lb,revert:revert,callback:callback},function(e){
			//e.preventDefault();
			closeLightbox(e.data.lb);
			e.data.revert.focus();
			if(typeof e.data.callback==="function") e.data.callback.call();
		});
	
		$('.lightbox_bg').css({'height':''});
		centre(lb);
	
		$('.lightbox_bg').on('click',{lb:lb,revert:revert,callback:callback},function(e){
			location.hash = "#";
			closeLightbox(e.data.lb);
			e.data.revert.focus();
			if(typeof e.data.callback==="function") e.data.callback.call();
		}).css({'height':h+'px'});
	
		$(window).resize(function(){
			if($(window).height() > $('.lightbox_top').height()) centre(lb);
			else $('.lightbox_top').css('top',0)
			$('.lightbox_bg').css({'height':$(document).height()+'px'});
		});
	
		$('.lightbox_top form input:visible:first').focus();
	
		return;
	}
	
	function closeLightbox(lb){
		speed = 500;
		if($('.lightbox_bg').length > 0) $('.lightbox_bg').fadeOut(speed,function() { $(this).remove(); });
		if(lb.length > 0){
			lb.attr('role','');
			var parent = lb.parent();
			lb.fadeOut(speed,function(){
				$(this).removeClass('lightbox_top');
				me = $(this).detach();
				me.appendTo(parent);
			});
		}
		$('body').css('overflow-y','auto');
		if(typeof fn=="function") fn.call();
	}
	
	function centre(lb){
		var wide = $(window).width();
		var tall = $(window).height();
		var l = 0;
		var t = 0;
		if(lb.css('max-width').indexOf('px') > 0){
			l = ((wide-lb.outerWidth())/2);
			lb.css({left:((wide-lb.outerWidth())/2)+'px'});
			if($(window).height() > lb.height()){
				//t = (window.scrollY+(tall-lb.outerHeight())/2);
				t = ((tall-lb.outerHeight())/2 + $(window).scrollTop());
				$('body').css('overflow-y','hidden');
			}
		}
		lb.css({left:l+"px",top:t+'px'});
	}

	// END HELPER FUNCTIONS

	$.simulator = function(placeholder,input) {

		if(typeof input=="object") input.container = placeholder;
		else {
			if(typeof placeholder=="string") input = { container: placeholder };
			else input = placeholder;
		}
		input.plugins = $.simulator.plugins;
		return new Simulator(input);

	};

	$.simulator.plugins = [];

})(jQuery);
