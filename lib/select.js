var fs = require('fs');
var png = require('pngjs').PNG;

function select() {
  this.createStage({action: 'select'});
  return this;
}

function worker(pipeline, stage, data, cb) {
  console.log('select', data);

  var i = 0;
  var ii = 0;

  var tilePath = data.tilePath;

  var visBands = pipeline.getVisibleBands();
  var vnirBands = pipeline.getVNIRBands();
  var swirBands = pipeline.getSWIRBands();

  var images = [];

  for (i = 0, ii = visBands.length; i < ii; i++) {
    images.push(loadImage(
      pipeline.resolveTile(data.tile, data.type, data.precision, visBands[i], data.index)
    ));
  }

  if (images.length) {
    loadPage(pipeline, 'vis', images);
  }

  images = [];

  for (i = 0, ii = vnirBands.length; i < ii; i++) {
    images.push(loadImage(
      pipeline.resolveTile(data.tile, data.type, data.precision, vnirBands[i], data.index)
    ));
  }

  if (images.length) {
    loadPage(pipeline, 'vnir', images);
  }

  images = [];

  for (i = 0, ii = swirBands.length; i < ii; i++) {
    images.push(loadImage(
      pipeline.resolveTile(data.tile, data.type, data.precision, swirBands[i], data.index)
    ));
  }

  if (images.length) {
    loadPage(pipeline, 'swir', images);
  }

  images = null;

  pipeline.createJob('high', data);

  return cb();
}

function loadImage(path) {
  return png.sync.read(fs.readFileSync(path));
}

function loadPage(pipeline, pageName, images) {
  var x = 0;
  var y = 0;
  var i = 0;
  var j = 0;
  var k = 0;
  var jj = 0;
  var ii = 0;
  var off = 0;

  var pages = [];
  var stages = pipeline.getStages();

  for (i = 0, ii = stages.length; i < ii; i++) {
    if (stages[i].action !== 'gpu') {
      continue;
    }
    pages.push(stages[i].unit.detach(pageName));
  }

  var image0 = images[0];
  var image1 = images[1];
  var image2 = images[2];
  var image3 = images[3];

  var width = image0.width;
  var height = image0.height;

  var data0 = image0 ? image0.data : null;
  var data1 = image1 ? image1.data : null;
  var data2 = image2 ? image2.data : null;
  var data3 = image3 ? image3.data : null;

  for (y = 0; y < height; y++) {
    for (x = 0; x < width; x++) {

      off = (width * y + x) << 2;

      for (j = 0, jj = pages.length; j < jj; j++) {
        pages[j][k] = data0 ? data0[off] : 0;
        pages[j][k + 1] = data1 ? data1[off] : 0;
        pages[j][k + 2] = data2 ? data2[off] : 0;
        pages[j][k + 3] = data3 ? data3[off] : 0;
      }

      k += 4;

    }
  }

}

module.exports = {
  action: 'select',
  worker: worker,
  call: select
};
