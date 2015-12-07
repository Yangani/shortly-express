var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');

var User = db.Model.extend({
  tableName: 'users',
  hasTimestamps: true,
  // defaults: {
  //   visits: 0
  // },
  save: function(username, password) {
    var salt = bcrypt.genSaltSync(10);
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
      })
  },
  initialize: function(username, password){
    this.save(username, password);
  }
});

module.exports = User;
