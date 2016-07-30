var hog = require('hog-descriptor');

function HOGHomograph(imageWidth, imageHeight, imageData, config) {
  var cfg = this.config = config || {};

  if (imageData) {

    this.histograms = hog.extractHistograms(
      { width: imageWidth, height: imageHeight, data: imageData }, cfg
    );

  }
  else {

    this.histograms = cfg.histograms;

  }

  if (!this.histograms) {
    throw new Error('Missing Histograms');
  }

  var histograms = this.histograms;

  this.blocksHigh = histograms.length - cfg.blockSize + 1;
  this.blocksWide = histograms[0].length - cfg.blockSize + 1;

  this.blockTotalSize = cfg.blockSize * cfg.blockSize * cfg.bins;

}

HOGHomograph.prototype.extractWindow = function() {
  return hog.extractHOGFromHistograms(this.histograms, this.config);
};

HOGHomograph.prototype.scaleRay = function(a, b, x) {
  if (b[0] === a[0]) {
    b[0]++;
  }
  var slope = (b[1] - a[1]) / (b[0] - a[0]);
  return [x, Math.ceil(a[1] + (x - a[0]) * slope)];
};

HOGHomograph.prototype.createRandomRay = function(window) {
  var a = [Math.floor(Math.random() * this.blocksWide), Math.floor(Math.random() * this.blocksHigh)];
  var b = [Math.floor(Math.random() * this.blocksWide), Math.floor(Math.random() * this.blocksHigh)];

  var p1 = this.scaleRay(a, b, 0);
  var p2 = this.scaleRay(a, b, this.blocksWide);

  return this.createRay(window, p1, p2);
};

HOGHomograph.prototype.createRay = function(window, p1, p2) {
  var i = 0;
  var off = 0;
  var err2 = 0;

  var block;
  var blocks = [];

  var x1 = p1[0];
  var y1 = p1[1];
  var x2 = p2[0];
  var y2 = p2[1];

  var dx = Math.abs(x2 - x1);
  var dy = Math.abs(y2 - y1);

  var sx = (x1 < x2) ? 1 : -1;
  var sy = (y1 < y2) ? 1 : -1;

  var err = dx - dy;

  var blocksWide = this.blocksWide;
  var blocksHigh = this.blocksHigh;
  var blockTotalSize = this.blockTotalSize;

  while(true) {

    if (x1 > -1 && y1 > -1 && x1 < blocksWide && y1 < blocksHigh) {

      off = (blocksWide - 1) * y1 + x1;

      block = new Array(blockTotalSize);

      for (i = 0; i < blockTotalSize; i++) {
        block[i] = window[(off + i) * blockTotalSize];
      }

      blocks.push(block);

    }

    if ((x1 >= x2) && (y1 >= y2)) {
      break;
    }

    err2 = 2 * err;

    if (err2 > -dy) {
      err -= dy;
      x1 += sx;
    }

    if (err2 < dx) {
      err += dx;
      y1 += sy;
    }

  }

  return blocks;
};

HOGHomograph.prototype.countInliers = function(a, b, threshold) {
  var j = 0;
  var sum = 0;
  var count = 0;

  var blockTotalSize = this.blockTotalSize;

  var c = new Array(blockTotalSize);

  for (var i = 0, ii = Math.min(a.length, b.length); i < ii; i++) {

    sum = 0;

    for (j = 0; j < blockTotalSize; j++) {

      c[j] = a[i][j] - b[i][j];

      c[j] *= c[j];

      sum += Math.sqrt(c[j]);

    }

    if (sum < threshold) {
      count++;
    }

  }

  return count;
};

HOGHomograph.prototype.countRandomRadialInliers = function(window1, window2, radius, numberOfRays, threshold) {
  var count = 0;

  var dx = this.blocksWide - radius * 2;
  var dy = this.blocksHigh - radius * 2;

  var c1 = [
    Math.floor(Math.random() * dx + radius),
    Math.floor(Math.random() * dy + radius)
  ];

  var c2 = [
    Math.floor(Math.random() * dx + radius),
    Math.floor(Math.random() * dy + radius)
  ];

  for (var i = 0; i < numberOfRays; i++) {

    var angle = Math.random() * Math.PI * 2;

    var a = this.createRay(window1, c1, [
      Math.floor(c1[0] + Math.cos(angle) * radius),
      Math.floor(c1[1] + Math.sin(angle) * radius)
    ]);

    var b = this.createRay(window2, c2, [
      Math.floor(c2[0] + Math.cos(angle) * radius),
      Math.floor(c2[1] + Math.sin(angle) * radius)
    ]);

    count += this.countInliers(a, b, threshold);

  }

  return {
    x: c1[0],
    y: c1[1],
    count: count
  };
};

module.exports = {
  HOGHomograph: HOGHomograph
};
