var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var session = require('express-session');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser')
// Maybe use this later.
// var bcrypt = require('bcrypt');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

// http://www.9bitstudios.com/2013/09/express-js-authentication/
app.use(cookieParser('shhhh, very secret'));
app.use(session());

// http://www.9bitstudios.com/2013/09/express-js-authentication/
function restrict(req, res, next) {
  // console.log('req:', req);
  if (req.session.user) {
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }
}

app.get('/', restrict,
function(req, res) {

// http://www.9bitstudios.com/2013/09/express-js-authentication/
  res.render('index');
});

app.get('/login',
function(req, res) {
  res.status(200);
  res.render('login');
});

app.get('/create', restrict,
function(req, res) {
  res.render('index');
});

app.get('/links', restrict,
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.get('/signup',
function(req, res) {
  res.status(200);
  res.render('signup');
});

// http://www.9bitstudios.com/2013/09/express-js-authentication/
app.post('/login',
function(req, res) {
  var username = req.body.username;
  var password = req.body.password;
  console.log('Logging in:', username);
  console.log('  username:', username);
  console.log('  password:', password);

  //1. Authenticate username
  // Users.hasUser('me');
  Users.authenticate(username, password);
  db.knex('users').then(function(data) {console.log('one more time:', data)})


  //2. ..Password

  if(username == 'demo' && password == 'demo'){
      req.session.regenerate(function(){
      req.session.user = username;
      res.redirect('/restricted');
      });
  }
  else {
     res.redirect('login');
  }
});

app.post('/signup',
function(req, res) {
  // 1. Get the username and password.
  var username = req.body.username;
  var password = req.body.password;
  console.log('Signing up:', username);
  console.log('  username:', username);
  console.log('  password:', password);

  // 2. Save in the database.
 new User(username, password);

  // 3. Redirect to the login page.
  req.session.regenerate(function(){
    req.session.user = username;
    res.redirect('/login');
  });
});

app.post('/links',
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/



/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
