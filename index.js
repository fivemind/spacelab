var LIBPATH = __dirname + '/lib/';
var CACHEPATH = '~/sentinel-s2-l1c/';

var kue = require('kue');
var mgrs = require('mgrs');

kue.app.listen(3000);

var lib = [

  require(LIBPATH + 'dummy')

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

Pipeline.prototype.resolveTile = function(tile, type, percision, band, index) {
  return tile
    .replace('%p', percision)
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
  this.createJob('normal', {stage: 0, tile: tile, type: this._tileType, percision: 0, index: null});
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
    visibleBands: ['01', '02', '03', '04'],
    vnirBands: ['05', '06', '07', '08'],
    swirBands: ['09', '10', '11', '12'],
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

var pipeline = spacelab.pipeline(config)
  .title('dummy')
  .dummy()
  .title('end')
  .end()
  ;

pipeline.push( CACHEPATH + spacelab.wgs84(pipeline, [138.83697509765625, -34.34456994717239]) );
