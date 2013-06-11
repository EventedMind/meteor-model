Package.describe('Simple models');

Package.on_use(function (api) {
  var where = ['client', 'server'];
  api.use(['reactive-dict', 'mongo-livedata', 'underscore'], where);
  api.add_files(['model.js'], where);
});
