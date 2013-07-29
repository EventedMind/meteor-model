Package.describe('Simple models');

Package.on_use(function (api) {
  var where = ['client', 'server'];
  api.use(['ejson', 'reactive-dict', 'mongo-livedata', 'underscore'], where);
  api.add_files(['model.js'], where);
  api.export('Model', where);
});
