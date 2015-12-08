var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');

var salt = bcrypt.genSaltSync(10);

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
        console.log('data:', data)
        // data: [ { username: 'ewre' } ]
        // If blank array, then return bad username.
        if (data.length === 0) {
          console.log("Bad username:", username);
          fn(false);
        } else {
          console.log("Good username:", username);
          var user = data.pop();
          var savedPassword = user.password;

          var hash = bcrypt.hashSync(password, salt);

          var correctPassword = (hash === savedPassword);
          fn(correctPassword);

        }
      });
  },
  save: function(username, password) {
    var hash = bcrypt.hashSync(password, salt);
    console.log('hash:', hash);

    // INSERT INTO users (username, password)
    //   VALUES (username, password);
    db.knex('users')
      .insert({
        'username': username,
        'password': hash
      }).then(function() {
        console.log('Added user:', username);
      });
  },
  initialize: function(){
    //
  }
});

module.exports = User;
