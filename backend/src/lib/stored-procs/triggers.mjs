function indicateDataChange(OLD, NEW) {
  const omit = [ 'id', 'gn', 'ctime', 'mtime' ];
  const changes = findChanges(OLD, NEW, omit);
  if (changes) {
    NEW.gn += 1;
    NEW.mtime = new Date;
  }
  return NEW;
}
indicateDataChange.args = '';
indicateDataChange.ret = 'trigger';

function indicateDataChangeEx(OLD, NEW) {
  const omit = [ 'id', 'gn', 'ctime', 'mtime', 'itime', 'etime' ];
  const changes = findChanges(OLD, NEW, omit);
  if (changes) {
    const date = new Date;
    NEW.gn += 1;
    NEW.mtime = date;

    // make sure export time and import time has the current time as
    // reported by the database server
    if (NEW.itime) {
      if (!OLD.itime || NEW.itime > OLD.itime) {
        NEW.itime = date
      }
    } else if (NEW.etime) {
      if (!OLD.etime || NEW.etime > OLD.etime) {
        NEW.etime = date
      }
    }
  }
  return NEW;
}
indicateDataChangeEx.args = '';
indicateDataChangeEx.ret = 'trigger';

function notifyDataChange(OLD, NEW, TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_ARGV) {
  const omit = [ 'id', 'gn', 'ctime', 'mtime' ];
  const changes = findChanges(OLD, NEW, omit);
  if (changes) {
    sendChangeNotification(TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME, OLD, NEW, changes, TG_ARGV);
  }
}
notifyDataChange.args = '';
notifyDataChange.ret = 'trigger';

function notifyDataChangeEx(OLD, NEW, TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_ARGV) {
  const omit = [ 'id', 'gn', 'ctime', 'mtime', 'itime', 'etime' ];
  const changes = findChanges(OLD, NEW, omit);
  if (changes) {
    sendChangeNotification(TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME, OLD, NEW, changes, TG_ARGV);
  }
}
notifyDataChangeEx.args = '';
notifyDataChangeEx.ret = 'trigger';

function indicateLiveDataChange(OLD, NEW) {
  const omit = [ 'id', 'gn', 'ctime', 'mtime', 'dirty', 'ltime', 'atime' ];
  const changes = findChanges(OLD, NEW, omit);
  if (changes) {
    NEW.gn += 1;
    NEW.mtime = new Date;
  }
  return NEW;
}
indicateLiveDataChange.args = '';
indicateLiveDataChange.ret = 'trigger';

function notifyLiveDataChange(OLD, NEW, TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_ARGV) {
  const omit = [ 'id', 'gn', 'ctime', 'mtime', 'dirty', 'ltime', 'atime' ];
  const changes = findChanges(OLD, NEW, omit);
  if (changes) {
    sendChangeNotification(TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME, OLD, NEW, changes, TG_ARGV);
  }

  // if the roll is dirty, we might need to do something to expedite its update
  if (NEW && NEW.dirty) {
    // if lock time isn't null, then the row will soon be updated
    if (!NEW.ltime) {
      var requestCleaning = false;
      if (!OLD || !OLD.dirty) {
        // the row has just become dirty
        requestCleaning = true;
      } else if (OLD.atime != NEW.atime) {
        // the row has just been accessed--ask for cleaning again
        // recipient(s) will understand the urgency by looking at the
        // atime
        requestCleaning = true;
      }
      if (requestCleaning) {
        sendCleanNotification(TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME, NEW);
      }
    }
  }
}
notifyLiveDataChange.args = '';
notifyLiveDataChange.ret = 'trigger';

/**
 * Take results from Task table and move them into item in details.resources
 * with matching payload id
 */
function updateResource(OLD, NEW, TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_ARGV) {
  const payload = {
    token: NEW.token,
    details: NEW.details,
    completion: NEW.completion,
    etime: NEW.etime,
  };
  const params = [];
  const sql = `
    UPDATE "${TG_TABLE_SCHEMA}"."${TG_ARGV[0]}"
    SET details = "updatePayload"(details, $${params.push(payload)})
    WHERE "payloadTokens"(details) @> $${params.push([ payload.token ])}
  `;
  plv8.execute(sql, params);
}
updateResource.args = '';
updateResource.ret = 'trigger';
updateResource.flags = 'SECURITY DEFINER';

/**
 * Ensure that information inserted on into details.resources by updateResource()
 * doesn't get overridden by stale data
 */
function coalesceResources(OLD, NEW, TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_ARGV) {
  const resources = NEW.details.resources;
  if (!resources) {
    // a single resource is stored in the details column
    if (NEW.details.payload_token) {
      resources = [ NEW.details ];
    }
  }

  let allReady = true;
  if (resources instanceof Array) {
    // look for payload tokens
    const tokens = [];
    for (let res of resources) {
      if (res.payload_token) {
        tokens.push(res.payload_token);
      }
    }
    if (tokens.length > 0) {
      // load tasks
      const params = [];
      const sql = `
        SELECT * FROM "${TG_TABLE_SCHEMA}"."task"
        WHERE token = ANY($${params.push(tokens)})
        AND deleted = false
      `;
      const rows = plv8.execute(sql, params);

      // remove payload token if it's been uploaded
      for (let res of resources) {
        if (res.payload_token) {
          const row = rows.find((row) => {
            return row.token === res.payload_token;
          });
          if (row) {
            // copy media metadata into resource
            transferProps(row.details, res);
            if (row.completion === 100 && row.etime !== null) {
              delete res.payload_token;
            } else {
              allReady = false;
            }
          } else {
            transferProps({ error: `Missing task: ${res.payload_token}` }, res);
            delete res.payload_token;
          }
        }
      }
    }
  }

  // set ready column when all resources are ready
  const readyColumn = TG_ARGV[0];
  if (readyColumn) {
    NEW[readyColumn] = allReady;
  }
  // update the publication time
  const ptimeColumn = TG_ARGV[1];
  if (ptimeColumn && OLD) {
    if (NEW[readyColumn] && !OLD[readyColumn]) {
      if (NEW[ptimeColumn]) {
        NEW[ptimeColumn] = new Date;
      }
    }
  }
  return NEW;
}
coalesceResources.args = '';
coalesceResources.ret = 'trigger';
coalesceResources.flags = 'SECURITY DEFINER';

export {
  indicateDataChange,
  indicateDataChangeEx,
  notifyDataChange,
  notifyDataChangeEx,
  indicateLiveDataChange,
  notifyLiveDataChange,
  updateResource,
  coalesceResources,
};
