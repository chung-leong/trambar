import { matchSearchCriteria, limitSearchResults } from './local-search.js';
import { sortedIndexBy } from '../utils/array-utils.js';
import { get, set, unset, cloneDeep } from '../utils/object-utils.js';

const defaultOptions = {
  databaseName: 'database'
};

class LocalStorageCache {
  static isAvailable() {
    return !!window.localStorage;
  }

  constructor(options) {
    this.options = Object.assign({ ...defaultOptions }, options);
    this.localData = {};
    this.remoteData = {};
  }

  initialize() {
    const { databaseName } = this.options;
    const json = localStorage.getItem(databaseName);
    const localData = decodeJSON(json);
    if (localData instanceof Object) {
      this.localData = localData;
    }
  }

  shutdown() {
  }

  getRows(server, schema, table) {
    const store = (schema === 'local') ? this.localData : this.remoteData;
    const path = [ server, schema, table ];
    let rows = get(store, path);
    if (!rows) {
      rows = [];
      set(store, path, rows);
    }
    return rows;
  }

  getKeyName(schema) {
    return (schema === 'local') ? 'key' : 'id';
  }

  saveRows(server, schema, table) {
    if (schema !== 'local') {
      // don't save remote data
      return;
    }
    const { databaseName } = this.options;
    const json = JSON.stringify(this.localData);
    localStorage.setItem(databaseName, json);
  }

  /**
   * Look for objects in cache
   *
   * Query object contains the name of the origin server, schema, and table
   *
   * @param  {Object} query
   *
   * @return {Promise<Array<Object>>}
   */
  async find(query) {
    const { server = 'localhost', schema, table, criteria } = query;
    const rows = this.getRows(server, schema, table);
    const keyName = this.getKeyName(schema);
    let objects;
    if (criteria && criteria.id !== undefined && Object.values(criteria).length === 1) {
      // look up by id
      let ids = criteria.id;
      if (!(ids instanceof Array)) {
        ids = [ ids ];
      }
      objects = ids.map(id => findByKey(rows, id, keyName)).filter(Boolean);
    } else {
      objects = rows.filter((row) => {
        return matchSearchCriteria(table, row, criteria);
      });
    }
    limitSearchResults(table, objects, criteria);
    return objects;
  }

  /**
   * Save objects originating from specified location into cache
   *
   * @param  {Object} location
   * @param  {Array<Object>} objects
   *
   * @return {Promise<Array<Object>>}
   */
  async save(location, objects) {
    const { server = 'localhost', schema, table } = location;
    const rows = this.getRows(server, schema, table);
    const keyName = this.getKeyName(schema);
    for (let object of objects) {
      replaceByKey(rows, cloneDeep(object), keyName);
    }
    this.saveRows(server, schema, table);
    return objects;
  }

  /**
   * Remove objects from cache that originated from specified location
   *
   * @param  {Object} location
   * @param  {Array<Object>} objects
   *
   * @return {Promise<Array<Object>>}
   */
  async remove(location, objects) {
    const { server = 'localhost', schema, table } = location;
    const rows = this.getRows(server, schema, table);
    const keyName = this.getKeyName(schema);
    for (let object of objects) {
      removeByKey(rows, object, keyName);
    }
    this.saveRows(server, schema, table);
    return objects;
  }

  /**
   * Remove objects by one of three criteria:
   *
   * server - remove all objects from specified server
   * count - remove certain number of objects, starting from those least recent
   * before - remove objects with retrieval time (rtime) earlier than given value
   *
   * Return value is the number of objects removed
   *
   * @param  {Object} criteria
   *
   * @return {Promise<Number>}
   */
  async clean(criteria) {
    const store = this.remoteData;
    let count = 0;
    if (criteria.server !== undefined) {
      const schemas = store[criteria.server];
      for (let schema of Object.values(schemas)) {
        for (let table of Object.values(schema)) {
          count += table.length;
        }
      }
      delete store[criteria.server];
    } else if (criteria.count !== undefined) {
      // push all objects into a list
      const candidates = [];
      for (let schemas of Object.values(store)) {
        for (let schema of Object.values(schemas)) {
          for (let table of Object.values(schema)) {
            for (let row of table) {
              candidates.push(row);
            }
          }
        }
      }
      // sort by rtime
      candidates.sort(function(a, b) {
        if (a.rtime < b.rtime) {
          return -1;
        } else if (a.rtime > b.rtime) {
          return +1;
        } else {
          return 0;
        }
      });
      // leave only the least recent
      candidates.splice(criteria.count);
      // remove objects on the list
      for (let schemas of Object.values(store)) {
        for (let schema of Object.values(schemas)) {
          for (let table of Object.values(schema)) {
            for (let i = table.length - 1; i >= 0; i--) {
              if (candidates.includes(table[i])) {
                table.splice(i, 1);
                count++;
              }
            }
          }
        }
      }
    } else if (criteria.before !== undefined) {
      // go through every table
      for (let schemas of Object.values(store)) {
        for (let schema of Object.values(schemas)) {
          for (let table of Object.values(schema)) {
            for (let i = table.length - 1; i >= 0; i--) {
              if (table[i].rtime < criteria.before) {
                table.splice(i, 1);
                count++;
              }
            }
          }
        }
      }
    }
    return count;
  }

  /**
   * Clear objects cached in memory
   *
   * @param  {String|undefined} address
   * @param  {String|undefined} schema
   */
  reset(address, schema) {
    if (schema !== 'local') {
      const path = [];
      if (address) {
        path.push(address);
        if (schema) {
          path.push(schema);
        }
      }
      unset(this.remoteData, path);
    }
  }
}

function decodeJSON(s) {
  try {
    return JSON.parse(s);
  } catch(err) {
    return null;
  }
}

function findByKey(rows, key, keyName) {
  const criteria = {};
  criteria[keyName] = key;
  const index = sortedIndexBy(rows, criteria, keyName);
  const target = rows[index];
  if (target && target[keyName] === key) {
    return target;
  }
}

function replaceByKey(rows, object, keyName) {
  const index = sortedIndexBy(rows, object, keyName);
  const target = rows[index];
  if (target && target[keyName] === object[keyName]) {
    rows[index] = object;
  } else {
    rows.splice(index, 0, object);
  }
}

function removeByKey(rows, object, keyName) {
  const index = sortedIndexBy(rows, object, keyName);
  const target = rows[index];
  if (target && target[keyName] === object[keyName]) {
    rows.splice(index, 1);
  }
}

export {
  LocalStorageCache as default,
  LocalStorageCache,
};
