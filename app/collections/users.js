var bcrypt = require('bcrypt-nodejs');

var db = require('../config');
var User = require('../models/user');

var Users = new db.Collection();

Users.model = User;
// users: [ { id: 1,
//   username: 'me',
//   password: '$2a$10$5ivEOE2SL5X3HavS5Pv3s.X7qeDhfNSmUNwWb/Tm3hcO7MRR6j8nm',
//   created_at: null,
//   updated_at: null },
// { id: 2,
//   username: 'me',
//   password: '$2a$10$AU0RPly5iKNc6H3Jc6K7tOfJ6IMaewSS/lxdrSLNSww9J9pqY1nD6',
//   created_at: null,
//   updated_at: null },
// { id: 3,
//   username: 'me',
//   password: '$2a$10$s5jayouw7ePh72xTKAV0WuaUMcuyvj8zFc4sLZInSvX2h7dFYtNwe',
//   created_at: null,
//   updated_at: null },
// { id: 4,
//   username: 'me',
//   password: '$2a$10$d5sgDb/jxtlGM3Rc/4MhUeq2nrYjzF16trwSnKqHCXFl1FeKm3TQu',
//   created_at: null,
//   updated_at: null } ]

// data: [ { username: 'ewre' } ]

Users.authenticate = function(username, password) {
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
      } else {
        console.log("Good username:", username);
        var user = data.pop();
        var savedPassword = user.password;

        var salt = bcrypt.genSaltSync(10);
        var hash = bcrypt.hashSync(password, salt);
        console.log('Authenticating hash:', hash)

        if (hash === savedPassword) {
          // Login
          console.log("Good password:", password);
        } else {
          console.log("Bad password:", password);
        }
      }

      // return res.redirect(link.get('url'));
    });
};

module.exports = Users;
