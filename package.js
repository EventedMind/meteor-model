Package.describe({
  summary: 'Lightweight models for collection documents'
});

Package.on_use(function (api) {
  var where = ['client', 'server'];

  api.use([
    'ejson',
    'reactive-dict',
    'mongo-livedata',
    'underscore',
    'posture',
    'collection-hooks'
  ], where);
  
  api.add_files(['model.js'], where);

  if (api.export) {
    api.export('Model', where);
  }
});
