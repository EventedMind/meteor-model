var capitalize = function (string) {
  return string.charAt(0).toUpperCase() + string.substring(1).toLowerCase();
};

var global = function () {
  if (typeof window !== 'undefined')
    return window;
  else if (typeof global !== 'undefined')
    return global;
  else 
    return null;
};

var warn = function (msg) {
  if (console && console.warn)
    console.warn(msg);
};

Model = Class.inherit({
  constructor: function (doc, options) {
    this.fields = [];
    this.options = {};
    this.configure(options);
    this.set(doc);
  },

  configure: function (options) {
    options = options || {};
    this.options = this.options || {};
    _.extend(this.options, options);
    return this;
  },

  typeName: function () {
    return this.class.typeName();
  },

  toJSONValue: function () {
    return EJSON.toJSONValue(this.toDocument());
  },

  clone: function () {
    return this.class.newModel(this.toDocument());
  },

  toDocument: function () {
    return _.pick(this, this.fields);
  },
  
  equals: function (other) {
    //XXX this assumes ordering
    return EJSON.stringify(this) == EJSON.stringify(other);
  },

  set: function (key, value) {
    var attributes;

    if (_.isObject(key)) {
      attributes = key;
    } else if (_.isString(key)) {
      attributes = {};
      attributes[key] = value;
    } else {
      attributes = {};
    }

    this.fields = _.uniq(this.fields.concat(_.keys(attributes)));
    _.extend(this, attributes);
    return this;
  },

  sync: function () {
    var self = this;
    if (!self._id)
      throw new Error('No _id set on model');

    Deps.nonreactive(function () {
      var doc = self.collection.findOne({_id: self._id});
      self.set(doc);
    });
  },

  insert: function () {
    var self = this
      , args = _.toArray(arguments)
      , wrappedCallback;

    wrappedCallback = function (err, id) {
      if (id)
        self._id = id;

      self.sync();
      if (typeof args[args.length-1] === 'function')
        args[args.length-1](err, id);
    };

    return this.class.insert.call(this.class,
      this.toDocument(),
      wrappedCallback
    );
  },

  update: function (/* [mutator, cb] */) {
    var self = this
      , doc = self.toDocument()
      , mutator
      , wrappedCallback
      , args = _.toArray(arguments);

    delete doc._id;

    if (Object.prototype.toString.call(args[0]) === '[object Object]')
      mutator = args[0];
    else
      mutator = { '$set': doc };

    wrappedCallback = function (err) {
      if (err)
        throw err;

      self.sync();

      if (typeof args[args.length-1] === 'function')
        args[args.length-1](err);
    };

    return this.class.update.call(this.class,
      {_id: this._id},
      mutator,
      wrappedCallback
    );
  },

  remove: function () {
    var args = _.toArray(arguments);

    return this.class.remove.apply(this.class,
      [{_id: this._id}].concat(args)
    );
  },

  save: function (mutator) {
    var method = this._id ? 'update' : 'insert';
    return this[method].apply(this, arguments);
  }
});

Model.onBeforeInherit = function (definition) {
  var self = this 
    , collection
    , before
    , after
    , root = global();

  Class.onBeforeInherit.apply(this, arguments);

  if (collection = definition.collection) {
    if (collection instanceof Meteor.Collection) {
      collection._transform = this.newModel;
    } else {
      collection = new Meteor.Collection(collection, {
        transform: _.bind(this.newModel, this)
      });
    }

    this.collection = collection;

    // so instances get the property too
    this.include({
      collection: collection
    });

    delete definition.collection;
  }

  if (this.typeName && this.typeName() !== 'Model')
    EJSON.addType(this.typeName(), this.fromJSONValue);
  else {
    warn(
      'If you want an EJSON type added you need to have a typeName property'
    );
  }

  if (before = definition.before) {
    _.each(before, function (fn, mutatorKey) {
      self.collection['before' + capitalize(mutatorKey)](fn);
    });

    delete definition.before;
  }

  if (after = definition.after) {
    _.each(after, function (fn, mutatorKey) {
      self.collection['after' + capitalize(mutatorKey)](fn);
    });

    delete definition.after;
  }
};

Model.extend({
  newModel: function (doc, options) {
    return new this(doc, options);
  },

  fromJSONValue: function (value) {
    return this.newModel(EJSON.fromJSONValue(value));
  },

  proxyToCollection: function (method, args) {
    if (!this.collection)
      throw new Error('No collection specified on this model.');

    if (!method)
      throw new Error('What method should I proxy on the collection?');

    args = _.toArray(args);
    var thisArg = this.collection;

    return this.collection[method].apply(thisArg, args);
  },

  insert: function (/* args */) {
    return this.proxyToCollection('insert', arguments);
  },

  update: function (/* args */) {
    return this.proxyToCollection('update', arguments);
  },

  remove: function (/* args */) {
    return this.proxyToCollection('remove', arguments);
  },

  find: function (/* args */) {
    return this.proxyToCollection('find', arguments);
  },

  findOne: function (/* args */) {
    return this.proxyToCollection('findOne', arguments);
  }
});
