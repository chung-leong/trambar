var _ = require('lodash');

var emptyObject = {};

_.mixin({
    /**
     * Clone objects along a path
     *
     * @param  {Object} srcObj
     * @param  {String|Array<String>} path
     * @param  {Object} defaultValue
     *
     * @return {Object}
     */
    decouple: function(srcObj, path, defaultValue) {
        if (typeof(path) === 'string') {
            path = _.split(path, '.');
        } else if (!(path instanceof Array)) {
            path = [ path ];
        }
        if (!defaultValue) {
            defaultValue = emptyObject;
        }
        var dstObj = _.clone(srcObj);
        var defaultValueHere = (0 < path.length) ? emptyObject : defaultValue;
        if (!(dstObj instanceof defaultValueHere.constructor)) {
            dstObj = defaultValueHere;
        }
        var dstParent = dstObj;
        var srcParent = srcObj;
        for (var i = 0; i < path.length; i++) {
            var key = path[i];
            var srcChild = srcParent ? srcParent[key] : undefined;
            var dstChild = _.clone(srcChild);
            var defaultValueHere = (i < path.length - 1) ? emptyObject : defaultValue;
            if (!(dstChild instanceof defaultValueHere.constructor)) {
                dstChild = defaultValue;
            }
            dstParent[key] = dstChild;
            dstParent = dstChild;
            srcParent = srcChild;
        }
        return dstObj;
    },

    /**
     * Clone objects along path to parent, then set property
     *
     * @param  {Object} srcObj
     * @param  {String|Array<String>} path
     * @param  {*} value
     *
     * @return {Object}
     */
    decoupleSet: function(srcObj, path, value) {
        if (typeof(path) === 'string') {
            path = _.split(path, '.');
        } else if (!(path instanceof Array)) {
            path = [ path ];
        }
        if (path.length < 0) {
            throw new Error('Empty path');
        }
        var parentPath = _.slice(path, 0, -1);
        var dstObj = _.decouple(srcObj, parentPath, {});
        _.set(dstObj, path, value);
        return dstObj;
    },

    /**
     * Clone objects along path, then push value into targetted array
     *
     * @param  {Object} srcObj
     * @param  {String|Array<String>} path
     * @param  {*} value
     *
     * @return {Object}
     */
    decouplePush: function(srcObj, path, value) {
        var dstObj = _.decouple(srcObj, path, []);
        var array = _.get(dstObj, path);
        array.push(value);
        return dstObj;
    },

    /**
     * Return properties in objA that are different in objB
     *
     * @param  {Object} objA
     * @param  {Object} objB
     *
     * @return {Object}
     */
    shallowDiff: function(objA, objB) {
        return _.pickBy(objA, (value, name) => {
            return objB[name] !== value;
        });
    }
});
