var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var session = require('express-session');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser')
var uuid = require('node-uuid');
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

var currentSessions = {};

// var testId = '9bf083ac-975e-41be-ac18-3d3d2e4913f4';
// currentSessions[testId] = true;

// http://www.9bitstudios.com/2013/09/express-js-authentication/
function restrict(req, res, next) {
  // console.log('req:', req);
  if (currentSessions[req.session.sessionId]) {
    // console.log('Already logged in :)');
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }
}

app.get('/', restrict,
function(req, res) {
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
  // console.log('Logging in:', username);
  // console.log('  password:', password);

  // 1. Authenticate username and password
  // 2. Get sessionId.
  new User().authenticate(username, password, function(correctPassword) {
  // 3. Redirect to home page.
    if (correctPassword) {
      console.log("Good password:", password);
      var sessionId = uuid.v4();
      console.log('sessionId', sessionId);
      currentSessions[sessionId] = true;
      req.session.regenerate(function(){
        req.session.user = username;
        req.session.sessionId = sessionId;
        res.redirect('/');
      });
    } else {
      console.log("Bad password:", password);
      req.session.regenerate(function(){
        req.session.user = username;
        res.redirect('/login');
      });
    }
  });
});

app.post('/signup',
function(req, res) {
  // 1. Get the username and password.
  var username = req.body.username;
  var password = req.body.password;
  // console.log('Signing up:', username);
  // console.log('  password:', password);

  // 2. Save in the database.
  new User().save(username, password);

  var sessionId = uuid.v4();
  currentSessions[sessionId] = true;

  // 3. Redirect to the login page.
  req.session.regenerate(function(){
    req.session.user = username;
    req.session.sessionId = sessionId;
    // res.redirect('/login');
    res.redirect('/');
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
