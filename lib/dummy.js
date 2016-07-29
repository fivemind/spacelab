function worker(pipeline, stage, data, cb) {
  console.log('doing nothing', stage);
  pipeline.createJob('normal', data);
  return cb();
}

function dummy() {
  this.createStage({action: 'dummy'});
  return this;
}

module.exports = {
  action: 'dummy',
  worker: worker,
  call: dummy
};
