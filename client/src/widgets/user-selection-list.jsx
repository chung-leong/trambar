var React = require('react'), PropTypes = React.PropTypes;
var Relaks = require('relaks');
var MemoizeWeak = require('memoizee/weak');

var Database = require('data/database');
var Route = require('routing/route');
var Locale = require('locale/locale');
var Theme = require('theme/theme');

require('./user-selection-list.scss');

module.exports = Relaks.createClass({
    displayName: 'UserSelectionList',
    propTypes: {
        selection: PropTypes.arrayOf(PropTypes.number),
        disabled: PropTypes.arrayOf(PropTypes.number),

        database: PropTypes.instanceOf(Database).isRequired,
        route: PropTypes.instanceOf(Route).isRequired,
        locale: PropTypes.instanceOf(Locale).isRequired,
        theme: PropTypes.instanceOf(Theme).isRequired,

        onSelect: PropTypes.func,
    },

    renderAsync: function(meanwhile) {
        var route = this.props.route;
        var server = route.parameters.server;
        var schema = route.parameters.schema;
        var db = this.props.database.use({ server, schema, by: this });
        var props = {
            users: null,

            selection: this.props.selection,
            disabled: this.props.disabled,
            locale: this.props.locale,
            theme: this.props.theme,
            onSelect: this.props.onSelect,
            loading: true,
        };
        meanwhile.show(<UserSelectionListSync {...props} />);
        return db.start().then((userId) => {
            // load all users
            var criteria = {};
            return db.find({ schema: 'global', table: 'user', criteria });
        }).then((users) => {
            props.users = users;
            props.loading = false;
            return <UserSelectionListSync {...props} />
        });
    }
});

var UserSelectionListSync = module.exports.Sync = React.createClass({
    displayName: 'UserSelectionList.Sync',
    propTypes: {
        users: PropTypes.arrayOf(PropTypes.object),
        selection: PropTypes.arrayOf(PropTypes.number),
        disabled: PropTypes.arrayOf(PropTypes.number),

        locale: PropTypes.instanceOf(Locale).isRequired,
        theme: PropTypes.instanceOf(Theme).isRequired,

        onSelect: PropTypes.func,
    },

    render: function() {
        var users = this.props.users ? sortUsers(this.props.users) : null;
        return (
            <div className="user-selection-list">
                {_.map(users, this.renderUser)}
            </div>
        );
    },

    renderUser: function(user) {
        var props = {
            user,
            selected: _.includes(this.props.selection, user.id),
            disabled: _.includes(this.props.disabled, user.id),
            locale: this.props.locale,
            theme: this.props.theme,
            onClick: this.handleUserClick,
            key: user.id,
        };
        return <User {...props} />
    },

    triggerSelectEvent: function(selection) {
        if (this.props.onSelect) {
            this.props.onSelect({
                type: 'select',
                target: this,
                selection,
            });
        }
    },

    handleUserClick: function(evt) {
        var userId = parseInt(evt.currentTarget.getAttribute('data-user-id'));
        var selection = this.props.selection;
        if (_.includes(selection, userId)) {
            selection = _.difference(selection, [ userId ]);
        } else {
            selection = _.union(selection, [ userId ]);
        }
        this.triggerSelectEvent(selection);
    }
});

function User(props) {
    var classNames = [ 'user' ];
    if (props.selected) {
        classNames.push('selected');
    }
    if (props.disabled) {
        classNames.push('disabled');
    }
    var profileImage = _.get(props.user, 'details.profile_image');
    var imageUrl = props.theme.getImageUrl(profileImage, 24, 24);
    var name = _.get(props.user, 'details.name');
    var containerProps = {
        className: classNames.join(' '),
        'data-user-id': props.user.id,
        onClick: !props.disabled ? props.onClick : null,
    }
    return (
        <div {...containerProps}>
            <img className="profile-image" src={imageUrl} />
            <span className="name">{name}</span>
        </div>
    );
}

var sortUsers = MemoizeWeak(function(users) {
    return _.orderBy(users, [ 'details.name' ], [ 'asc' ]);
});
