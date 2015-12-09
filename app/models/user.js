var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');

var User = db.Model.extend({
  tableName: 'users',
  hasTimestamps: true,
  authenticate: function(username, password, fn) {
    // Read from the database
    //   on usernames only
    db.knex('users')
      .select('*')
      .where('username', '=', username)
      .then(function(data) {
        // If blank array, then return bad username.
        if (data.length === 0) {
          fn(false);
        } else {
          var user = data.pop();
          var savedPassword = user.password;

          var correctPassword = (bcrypt.compareSync(password, user.password));
          fn(correctPassword);
        }
      });
  },
  save: function(username, password) {
    var salt = bcrypt.genSaltSync(10);
    var hash = bcrypt.hashSync(password, salt);

    // INSERT INTO users (username, password)
    //   VALUES (username, password);
    db.knex('users')
      .insert({
        'username': username,
        'password': hash
      }).then(function() {
        // console.log('Added user:', username);
      });
  }
});

module.exports = User;
