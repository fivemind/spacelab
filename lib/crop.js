var path = require('path');
var mkdirp = require('mkdirp');
var im = require('imagemagick');

function worker(pipeline, stage, data, cb) {
  console.log('crop', stage);

  if (stage.precision === data.precision) {
      pipeline.createJob('normal', data);
      return cb();
  }

  var x = Math.pow(10, stage.precision);
  var config = pipeline.getConfig();
  var width = Math.floor(config.tileWidth / x);
  var height = Math.floor(config.tileHeight / x);
  var destPath = pipeline.resolveTile(
    data.tile, config.tileWorkingType, stage.precision, stage.band, '%d'
  );

  mkdirp.sync(path.dirname(destPath));

  im.convert([
      pipeline.resolveTile(data.tile, data.type, data.precision, stage.band, data.index),
      '-crop', (width + 'x' + height),
      destPath
    ],
    function(err, stdout) {
      if (err) throw err;
      pipeline.createJob('normal', data);
      return cb();
    }
  );

}

module.exports = {
  action: 'crop',
  worker: worker
};
