import _ from 'lodash';
import Promise from 'bluebird';
import React, { PureComponent } from 'react';
import { AsyncComponent } from 'relaks';
import SystemFinder from 'objects/finders/system-finder';

import './start-page.scss';

class StartPage extends AsyncComponent {
    static displayName = 'StartPage';

    /**
     * Render the component asynchronously
     *
     * @param  {Meanwhile} meanwhile
     *
     * @return {Promise<ReactElement>}
     */
    renderAsync(meanwhile) {
        let { database, env } = this.props;
        let db = database.use({ by: this });
        let props = {
            env,
        };
        return db.start().then((currentUserID) => {
            return SystemFinder.findSystem(db).then((system) => {
                if (_.isEmpty(system)) {
                    if (!this.redirectTimeout) {
                        this.redirectTimeout = setTimeout(() => {
                            this.props.route.replace('settings-page', { edit: true });
                        }, 2500);
                    }
                } else {
                    return this.props.route.replace('project-list-page');
                }
            });
        }).then((system) => {
            return <StartPageSync {...props} />;
        }).catch((err) => {
            return null;
        });
    }
}

class StartPageSync extends PureComponent {
    static displayName = 'StartPage.Sync';

    /**
     * Render component
     *
     * @return {ReactElement}
     */
    render() {
        let { env } = this.props;
        let { t } = env.locale;
        return (
            <div className={`start-page ${this.props.stage}`}>
                <h2>{t('welcome')}</h2>
            </div>
        );
    }
}

import Database from 'data/database';
import Route from 'routing/route';
import Environment from 'env/environment';

if (process.env.NODE_ENV !== 'production') {
    const PropTypes = require('prop-types');

    StartPage.propTypes = {
        database: PropTypes.instanceOf(Database).isRequired,
        route: PropTypes.instanceOf(Route).isRequired,
        env: PropTypes.instanceOf(Environment).isRequired,
        theme: PropTypes.instanceOf(Theme).isRequired,
    };
    StartPage.propType = {
        env: PropTypes.instanceOf(Environment).isRequired,
    };
}

export {
    StartPage as default,
    StartPage,
    StartPageSync,
};
