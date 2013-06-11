// XXX Limitation: You can only extend Model, not subclasses.

var warn = function (msg) {
  if (console && console.warn)
    console.warn(msg);
};

var runCallbacks = function (when, method) {
  var callbacks;
  var self = this;

  if (this[when] && this[when][method]) {
    callbacks = this[when][method];
    callbacks = _.isArray(callbacks) ? callbacks : [callbacks];

    _.each(callbacks, function (cb) {
      cb.call(self);
    });
  }
};

Model = function (document, options) {
  this.fields = [];
  this.options = {};
  this.configure(options);
  this.set(document);
};

Model.extend = function (prototype) {
  var typeName;
  var ModelInstance;

  ModelInstance = function (document) {
    Model.prototype.constructor.call(this, document);
  };

  ModelInstance.newModel = function (document) {
    return new ModelInstance(document);
  };

  ModelInstance.fromJSONValue = function (value) {
    return ModelInstance.newModel(EJSON.fromJSONValue(value));
  };

  ModelInstance.proxyToCollection = function () {
    var args = _.toArray(arguments);
    var method;
    var methodArgs;

    if (!ModelInstance.collection)
      throw new Error('No collection specified on this model.');

    if (args.length == 0) return;

    method = args[0];
    methodArgs = args.splice(1);

    var thisArg = ModelInstance.collection;
    return ModelInstance.collection[method].apply(thisArg, methodArgs);
  };

  var addProxyMethod = function (method) {
    ModelInstance[method] = function () {
      var args = [method].concat(_.toArray(arguments));
      return ModelInstance.proxyToCollection.apply(this, args);
    };
  };

  _.each(['insert', 'update', 'remove', 'find', 'findOne'], addProxyMethod);

  if (Object.create)
    ModelInstance.prototype = Object.create(Model.prototype);
  else {
    var Proto = function () {};
    Proto.prototype = Model.prototype;
    ModelInstance.prototype = new Proto();
  }

  if (prototype.collection) {
    ModelInstance.collection = new Meteor.Collection(prototype.collection, {
      transform: ModelInstance.newModel
    });

    delete prototype.collection;
  }

  if (prototype.name) {
    typeName = prototype.name;
    delete prototype.name;
  }

  _.extend(ModelInstance.prototype, prototype, {
    constructor: ModelInstance,

    clone: function () {
      return new ModelInstance(this.toObject());
    },

    typeName: function () {
      return typeName;
    }
  });

  if (typeName)
    EJSON.addType(typeName, ModelInstance.fromJSONValue);
  else
    warn("If you want an EJSON type added you need to have a 'name' property");

  return ModelInstance;
};

Model.prototype = {
  constructor: Model,

  configure: function (options) {
    options = options || {};
    _.extend(this.options, options);
    return this;
  },

  toJSONValue: function () {
    return EJSON.toJSONValue( this.toObject () );
  },

  toObject: function () {
    return _.pick(this, this.fields);
  },

  equals: function (other) {
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

  insert: function () {
    var _id;
    
    runCallbacks.call(this, "before", "insert");
    _id = this.constructor.insert(this.toObject());
    runCallbacks.call(this, "after", "insert");
    this.set("_id", _id);
    return _id;
  },

  update: function (modifier) {
    var doc;
    var retVal;

    // XXX id hasn't been set on the client for some reason so on the
    // server we don't have it. need to figure out why.
    if (!this._id)
      throw new Error('Model has not been inserted yet');


    runCallbacks.call(this, "before", "update");

    if (!modifier) {
      doc = this.toObject();
      delete doc._id;
      modifier = { "$set": doc };
    }

    retVal = this.constructor.update(this._id, modifier);
    runCallbacks.call(this, "after", "update");
  },

  remove: function () {
    var retVal;

    if (!this._id)
      throw new Error('Model has not been inserted yet');

    runCallbacks.call(this, "before", "remove");
    retVal = this.constructor.remove(this._id);
    runCallbacks.call(this, "after", "remove");
  },

  sync: function () {
    if (!this._id)
      throw new Error('Model has not been inserted yet');

    var updatedModel = this.constructor.findOne(this._id);
    this.set(updatedModel.toJSONValue());
    return this;
  }
};

