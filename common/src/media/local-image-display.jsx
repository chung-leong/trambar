var Promise = require('bluebird');
var React = require('react'), PropTypes = React.PropTypes;
var JpegAnalyser = require('media/jpeg-analyser');

var Database = require('data/database');

module.exports = React.createClass({
    displayName: 'RouteManager',
    propTypes: {
        file: PropTypes.instanceOf(Blob),
        clippingRect: PropTypes.object,
        onLoad: PropTypes.func,
    },

    componentDidMount: function() {
        if (this.props.file) {
            this.load(this.props.file);
        }
    },

    componentWillReceiveProps: function(nextProps) {
        if (this.props.file !== nextProps.file) {
            if (nextProps.file) {
                this.load(nextProps.file);
            } else {
                this.clear();
            }
        }
    },

    render: function() {
        var props = _.omit(this.props, 'onLoad', 'file', 'clippingRect');
        return <canvas ref="canvas" {...props} />
    },

    triggerLoadEvent: function() {
        if (this.props.onLoad) {
            this.props.onLoad({
                type: 'load',
                target: this,
            });
        }
    },

    load: function(file) {
        var imageP = this.loadImage(file);
        var orientationP = this.getOrientation(file);
        return Promise.join(imageP, orientationP, (image, orientation) => {
            this.drawImage(image, orientation || 1, this.props.clippingRect);
            this.triggerLoadEvent();
        });
    },

    loadImage: function(blob) {
        return new Promise((resolve, reject) => {
            var url = URL.createObjectURL(blob);
            var image = document.createElement('IMG');
            image.src = url;
            image.onload = function(evt) {
                resolve(image);
            };
            image.onerror = function(evt) {
                reject(new Error(`Unable to load ${url}`));
            };
        });
    },

    getOrientation: function(blob) {
        return new Promise((resolve, reject) => {
            var reader = new FileReader();
            reader.onload = function(evt) {
                console.log('reader.onload');
                var bytes = new Uint8Array(reader.result);
                var orientation = JpegAnalyser.getOrientation(bytes);
                resolve(orientation);
            };
            reader.onerror = function(evt) {
                reject(new Error(`Unable to load blob`));
            };
            reader.readAsArrayBuffer(this.props.file);
        });
    },

    drawImage: function(image, orientation, rect) {
        var imageWidth = image.naturalWidth;
    	var imageHeight = image.naturalHeight;
        if (!rect) {
            rect = {
                left: 0,
                top: 0,
                width: (orientation < 5) ? imageWidth : imageHeight,
                height: (orientation < 5) ? imageHeight : imageWidth,
            };
        }
        var canvas = this.refs.canvas;
        canvas.width = rect.width;
    	canvas.height = rect.height;
        var context = canvas.getContext('2d');
    	var matrix;
    	switch (orientation) {
    		case 1:
    			// normal
    			matrix = [1, 0, 0, 1, 0, 0];
    			break;
    		case 2:
    			// flip horizontally
    			matrix = [-1, 0, 0, 1, imageWidth, 0];
    			break;
    		case 3:
    			// rotate 180
    			matrix = [-1, 0, 0, -1, imageWidth, imageHeight];
    			break;
    		case 4:
    			// flip vertically
    			matrix = [1, 0, 0, -1, 0, imageHeight];
    			break;
    		case 5:
    			// transpose
    			matrix = [0, 1, 1, 0, 0, 0];
    			break;
    		case 6:
    			// rotate 90
    			matrix = [0, 1, -1, 0, imageHeight, 0];
    			break;
    		case 7:
    			// transverse
    			matrix = [0, -1, -1, 0, imageHeight, imageWidth]
    			break;
    		case 8:
    			// rotate 270
    			matrix = [0, -1, 1, 0, 0, imageWidth];
    			break;
    	}
        // clipping rect has coordinates in post-transform space
        // need to map them to the pre-transform space
    	var inverse = invert(matrix);
    	var corner1 = [ rect.left, rect.top ];
    	var corner2 = [ rect.left + rect.width, rect.top + rect.height ];
    	var srcCorner1 = transform(inverse, corner1);
    	var srcCorner2 = transform(inverse, corner2);
    	var [x1, y1] = srcCorner1;
    	var [x2, y2] = srcCorner2;
    	var width = Math.abs(x2 - x1);
    	var height = Math.abs(y2 - y1);
    	var left = Math.min(x1, x2);
    	var top = Math.min(y1, y2);
        // set transform matrix of context and draw image on canvas
    	context.transform.apply(context, matrix);
        context.drawImage(image, left, top, width, height, left, top, width, height);

        this.width = rect.width;
        this.height = rect.height;
        this.orientation = orientation;
    }
});

/**
 * Calculate inverse of affine matrix
 *
 * @param  {Array<Number>} m
 *
 * @return {Array<Number>}
 */
function invert(m) {
	var [a, b, c, d, e, f] = m;
	var dt = (a * d - b * c);
	return [
		d / dt,
		-b / dt,
		-c / dt,
		a / dt,
		(c * f - d * e) / dt,
		-(a * f - b * e) / dt,
	];
}

/**
 * Transform a point using affine matrix
 *
 * @param  {Array<Number>} m
 * @param  {Array<Number>} p
 *
 * @return {Array<Number>}
 */
function transform(m, p) {
	var [a, b, c, d, e, f] = m;
	var [x, y] = p;
	return [
		a * x + c * y + e,
		b * x + d * y + f,
	];
}
