var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var session = require('express-session');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser')
var uuid = require('node-uuid');

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
app.use(cookieParser('The secret of Festus'));
app.use(session());

var currentSessions = {};

// var testId = '9bf083ac-975e-41be-ac18-3d3d2e4913f4';
// currentSessions[testId] = true;

// http://www.9bitstudios.com/2013/09/express-js-authentication/
function restrict(req, res, next) {
  if (req.cookies.remember && currentSessions[req.cookies.remember.sessionId]) {
    // console.log('Already logged in :)');
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }
}

function addCookie(res) {
  var sessionId = uuid.v4();
  currentSessions[sessionId] = true;

  res.cookie('remember', {
    sessionId: sessionId
  }, {
    maxAge: 10 * 1000
  });
  setTimeout(function() { delete currentSessions[sessionId] }, 10 * 1000);
}

app.get('/', restrict,
function(req, res) {
  res.render('index');
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

app.get('/login',
function(req, res) {
  res.status(200);
  res.render('login');
});

app.get('/logout',
function(req, res) {
  console.log('Logging out')
  delete currentSessions[req.session.sessionId];
  req.session.sessionId = null;
  req.session.user = null;
  res.clearCookie('remember');
  req.session.regenerate(function(){
    res.redirect('/login');
  });
});

// http://www.9bitstudios.com/2013/09/express-js-authentication/
app.post('/login',
function(req, res) {
  var username = req.body.username;
  var password = req.body.password;

  // 1. Authenticate username and password
  new User().authenticate(username, password, function(correctPassword) {
    if (correctPassword) {
      req.session.regenerate(function(){
        // 2. Add cookie with session id
        addCookie(res);
        // 3. Redirect to home page.
        res.redirect('/');
      });
    } else {
      req.session.regenerate(function(){
        req.session.user = username;
        // Could try using passport
        // http://stackoverflow.com/questions/15711127/express-passport-node-js-error-handling
        res.status(401, 'Invalid email and/or password');
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


  // 2. Save in the database.
  new User().save(username, password);

  // 3. Redirect to the login page (or homepage for the test spec).
  req.session.regenerate(function(){
    addCookie(res);
    // res.redirect('/login');
    res.redirect('/'); // For the test spec
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
  console.log('req.params[0]', req.params[0]);
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
