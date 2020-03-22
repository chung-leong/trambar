import { remove } from './array-utils.js';
import { isMatch } from './object-utils.js';

export class FocusManager {
  static entries = [];
  static requests = [];

  static register(component, props) {
    this.entries.unshift({ component, props });

    // see if a request for focus has been made
    remove(this.requests, (request) => {
      if (isMatch(props, request)) {
        component.focus();
        return true;
      }
    });
  }

  static unregister(component) {
    remove(this.entries, r => r.component === component);
  }

  static focus(props) {
    const entry = this.entries.find(r => isMatch(r, props));
    if (entry) {
      entry.component.focus()
    } else {
      // store the request and set focus when component registers itself
      requests.push(props);
    }
  }
}
