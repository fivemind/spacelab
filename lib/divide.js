function worker(pipeline, stage, data, cb) {
  console.log('divide', stage);

  if (stage.precision === data.precision) {
      pipeline.createJob('normal', data);
      return cb();
  }

  var x = Math.pow(10, stage.precision);

  x *= x;

  for(var i = 0; i < x; i++) {

    pipeline.createJob('normal', {
      stage: data.stage,
      tile: data.tile,
      type: stage.type,
      precision: stage.precision,
      index: i
    });

  }

  return cb();
}

module.exports = {
  action: 'divide',
  worker: worker
};
