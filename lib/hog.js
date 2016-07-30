var homograph = require(__dirname + '/Homograph');

function hog() {
  this.createStage({
    action: 'hog',
    cellSize: 4,
    blockSize: 2,
    blockStride: 1,
    bins: 4,
    norm: 'L1'
  });
  return this;
}

function worker(pipeline, stage, data, cb) {
  console.log('hog', data);

  var x = Math.pow(10, data.precision);
  var config = pipeline.getConfig();

  var homographA = new homograph.HOGHomograph(
    Math.floor(config.tileWidth / x),
    Math.floor(config.tileHeight / x),
    pipeline._frame,
    config
  );

  var windowA = homographA.extractWindow();

  console.log('desc', windowA[0], windowA[1], windowA[2]);

  pipeline.createJob('high', data);

  return cb();
}

module.exports = {
  action: 'hog',
  worker: worker,
  call: hog
};
