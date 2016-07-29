var gpgpu = require(__dirname + '/deps/gpgpu.js');

function gpu(funct) {
  var config = this.getConfig();
  var stages = this.getStages();
  var stage = stages.length - 1;
  var pageSize = config.tileWidth * config.tileHeight;

  while (stage-- > -1) {
    if (stages[stage].precision === undefined) {
      continue;
    }
    var x = Math.pow(10, stages[stage].precision);
    pageSize = Math.floor(config.tileWidth / x) * Math.floor(config.tileHeight / x);
    break;
  }

  var unit = new gpgpu.Parallel(pageSize, ['vis', 'vnir', 'swir'], funct.toString());

  this.createStage({action: 'gpu', unit: unit});

  return this;
}

function worker(pipeline, stage, data, cb) {
  console.log('gpu', {});

  var unit = stage.unit;
  var frame = pipeline._frame;

  if (frame === undefined) {

    pipeline._frame = unit.execute();

  console.log('_frame', pipeline._frame[0], pipeline._frame[1], pipeline._frame[2], pipeline._frame[3]);

    pipeline.createJob('high', data);

    return cb();

  }

  var page = unit.detach('frame');

  for (var i = 0, ii = page.length; i < ii; i++) {
    page[i] = frame[i];
  }

  pipeline._frame = unit.execute();

  console.log('_frame', pipeline._frame[0], pipeline._frame[1], pipeline._frame[2], pipeline._frame[3]);

  pipeline.createJob('high', data);

  return cb();
}

module.exports = {
  action: 'gpu',
  worker: worker,
  call: gpu
};
