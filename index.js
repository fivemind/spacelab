var LIBPATH = __dirname + '/lib/';
var CACHEPATH = process.env.HOME + '/sentinel-s2-l1c/';

var kue = require('kue');
var mgrs = require('mgrs');

kue.app.listen(3000);

var lib = [

  require(LIBPATH + 'crop'),
  require(LIBPATH + 'divide'),
  require(LIBPATH + 'precision')

]
.forEach(function(item) {
  if (item.call !== undefined) {
    Pipeline.prototype[item.action] = item.call;
  }
  if (item.worker !== undefined) {
    Pipeline.prototype['__' + item.action] = item.worker;
  }
});

function Pipeline(config) {

  this._config = config;

  this._name = config.name;

  this._visibleBands = config.visibleBands;
  this._vnirBands = config.vnirBands;
  this._swirBands = config.swirBands;

  this._tileType = config.tileType;
  this._tileWorkingType = config.tileWorkingType;
  this._tileWidth = config.tileWidth;
  this._tileHeight = config.tileHeight;

  this._title = '';
  this._stages = [];
  this._queue = kue.createQueue();
  this._worker = this._worker.bind(this);
  this._queue.process(this._name, this._worker);

}

Pipeline.prototype.getConfig = function() {
  return this._config;
};

Pipeline.prototype.getStages = function() {
  return this._stages;
};

Pipeline.prototype.getVisibleBands = function() {
  return this._visibleBands;
};

Pipeline.prototype.getVNIRBands = function() {
  return this._vnirBands;
};

Pipeline.prototype.getSWIRBands = function() {
  return this._swirBands;
};

Pipeline.prototype.createStage = function(stage) {
  stage.title = this._title;
  this._stages.push(stage);
};

Pipeline.prototype.createJob = function(priority, job) {
  var stage = this._stages[job.stage];
  job.title = stage.title;
  job.title += stage.subtitle ? ': ' + stage.subtitle : '';

  this._queue.create(this._name, job).priority(priority).save();

};

Pipeline.prototype.resolveTile = function(tile, type, precision, band, index) {
  return tile
    .replace('%p', precision)
    .replace('%b', band)
    .replace('%d', index === null ? '' : index)
    .replace('%t', type)
    ;
};

Pipeline.prototype._worker = function(job, cb) {
  var data = job.data;

  if (data.stage >= this._stages.length) {
    return cb();
  }

  var stage = this._stages[data.stage];

  data.stage += 1;

  if (stage.action === 'end') {
    return cb();
  }

  return this['__' + stage.action](this, stage, data, cb);
};

Pipeline.prototype.push = function(tile) {
  this.createJob('normal', {stage: 0, tile: tile, type: this._tileType, precision: 0, index: null});
  return this;
};

Pipeline.prototype.title = function(title) {
  this._title = title;
  return this;
};

Pipeline.prototype.end = function() {
  this.createStage({action: 'end'});
  return this;
};

function wgs84(pipeline, lonLat) {
  var string = mgrs.forward(lonLat, 1);
  return '%p/tiles/' +
    string.substr(0, 2) + '/' +
    string.substr(2, 1) + '/' +
    string.substr(3, 2) + '/' +
    '%d%b.%t'
    ;
}

function sentinel2() {
  return {
    name: 'sentinel2',
    visibleBands: ['B01', 'B02', 'B03', 'B04'],
    vnirBands: ['B05', 'B06', 'B07', 'B08'],
    swirBands: ['B09', 'B10', 'B11', 'B12'],
    tileType: 'jp2',
    tileWorkingType: 'png',
    tileWidth: 10980,
    tileHeight: 10980
  };
}

var spacelab = {
  wgs84: wgs84,
  sentinel2: sentinel2,
  pipeline: function(config) {
    return new Pipeline(config || sentinel2());
  }
};


var config = spacelab.sentinel2();

config.visibleBands = ['B04', 'B03', 'B02'];
config.vnirBands = ['B08'];
config.swirBands = [];

var pipeline = spacelab.pipeline(config)
  .title('precision')
  .precision(1)
  .title('end')
  .end()
  ;

pipeline.push( CACHEPATH + spacelab.wgs84(pipeline, [138.83697509765625, -34.34456994717239]) );
