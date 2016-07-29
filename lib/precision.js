function precision(precision) {
  var i = 0;
  var ii = 0;

  var vis = this.getVisibleBands();
  var vnir = this.getVNIRBands();
  var swir = this.getSWIRBands();

  for (i = 0, ii = vis.length; i < ii; i++) {
    this.createStage({
      action: 'crop',
      subtitle: 'crop visible band ' + vis[i],
      precision: precision,
      band: vis[i]
    });
  }

  for (i = 0, ii = vnir.length; i < ii; i++) {
    this.createStage({
      action: 'crop',
      subtitle: 'crop vnir band ' + vnir[i],
      precision: precision,
      band: vnir[i]
    });
  }

  for (i = 0, ii = swir.length; i < ii; i++) {
    this.createStage({
      action: 'crop',
      subtitle: 'crop swir band ' + swir[i],
      precision: precision,
      band: swir[i]
    });
  }

  this.createStage({
    action: 'divide',
    subtitle: 'divide',
    precision: precision,
    type: this.getConfig().tileWorkingType
  });

  return this;
}

module.exports = {
  action: 'precision',
  call: precision
};
