var fs  = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');

var im = require('imagemagick');
var pngext = require('png-ext');

function png(relPath, color) {
  var profile = [];
  var gamma = color ? color.gamma : null;
  var sigmoid = color ? color.sigmoid : null;

  if (gamma) {
    if (gamma.red) {
      profile.push('-channel', 'R', '-gamma', '' + gamma.red);
    }
    if (gamma.green) {
      profile.push('-channel', 'G', '-gamma', '' + gamma.green);
    }
    if (gamma.blue) {
      profile.push('-channel', 'B', '-gamma', '' + gamma.blue);
    }
  }

  if (sigmoid) {
    profile.push(
      '-channel',
      'RGB',
      '-sigmoidal-contrast',
      sigmoid.contrast + 'x' + sigmoid.midpoint + '%'
    );
  }

  profile.push('');
  profile.push('');

  this.createStage({action: 'png', relPath: relPath, profile: profile});

  return this;
}

function worker(pipeline, stage, data, cb) {
  console.log('png', data);

  var x = Math.pow(10, data.precision);
  var config = pipeline.getConfig();
  var width = Math.floor(config.tileWidth / x);
  var height = Math.floor(config.tileHeight / x);
  var destPath = pipeline.resolveTile(data.tile, data.type, stage.relPath, '', data.index);
  var image = new pngext.Png(pipeline._frame, width, height, 'rgba').encodeSync();

  mkdirp.sync(path.dirname(destPath));

  fs.writeFileSync(destPath, image.toString('binary'), 'binary');

  var profile = stage.profile;

  profile[profile.length - 2] = profile[profile.length - 1] = destPath;

  im.convert(profile, function(err, stdout) {
    if (err) throw err;
    pipeline.createJob('high', data);
    return cb();
  });

}

module.exports = {
  action: 'png',
  worker: worker,
  call: png
};
