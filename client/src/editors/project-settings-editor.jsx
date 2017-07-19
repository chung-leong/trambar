var _ = require('lodash');
var Promise = require('bluebird');
var React = require('react'), PropTypes = React.PropTypes;

var Database = require('data/database');
var Route = require('routing/route');
var Locale = require('locale/locale');
var Theme = require('theme/theme');

// mixins
var UpdateCheck = require('mixins/update-check');

// widgets
var SettingsSection = require('widgets/settings-section');
var PushButton = require('widgets/push-button');

require('./project-settings-editor.scss');

module.exports = React.createClass({
    displayName: 'ProjectSettingsEditor',
    mixins: [ UpdateCheck ],
    propTypes: {
        projects: PropTypes.arrayOf(PropTypes.object).isRequired,

        database: PropTypes.instanceOf(Database).isRequired,
        route: PropTypes.instanceOf(Route).isRequired,
        locale: PropTypes.instanceOf(Locale).isRequired,
        theme: PropTypes.instanceOf(Theme).isRequired,
    },

    render: function() {
        var t = this.props.locale.translate;
        return (
            <SettingsSection>
                <header>
                    <i className="fa fa-database" /> {t('settings-projects')}
                </header>
                <footer>
                    {this.renderButtons()}
                </footer>
            </SettingsSection>
        );
    },

    renderButtons: function() {
        var addProps = {
            label: 'Add...',
        };
        var removeProps = {
            label: 'Remove',
        };
        return (
            <div>
                <PushButton {...addProps} />
                <PushButton {...removeProps} />
            </div>
        );
    },
});
