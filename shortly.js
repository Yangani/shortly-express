var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var session = require('express-session');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser')
var uuid = require('node-uuid');
var passport = require('passport');
var GitHubStrategy = require('passport-github2').Strategy;

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
app.use(passport.initialize());
app.use(passport.session());

var currentSessions = {};

// var testId = '9bf083ac-975e-41be-ac18-3d3d2e4913f4';
// currentSessions[testId] = true;
//////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////GITHUB AUTHENTICATION///////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////

var GITHUB_CLIENT_ID = 'd8cad26f2411c47c03ca';
var GITHUB_CLIENT_SECRET = 'd9d168bc91322829b3d7830f85dc2026668c372c';

// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the complete GitHub profile is serialized
//   and deserialized.
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

// Use the GitHubStrategy within Passport.
//   Strategies in Passport require a `verify` function, which accept
//   credentials (in this case, an accessToken, refreshToken, and GitHub
//   profile), and invoke a callback with a user object.
passport.use(new GitHubStrategy({
    clientID: GITHUB_CLIENT_ID,
    clientSecret: GITHUB_CLIENT_SECRET,
    callbackURL: "http://127.0.0.1:4568/auth/github/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    // asynchronous verification, for effect...
    process.nextTick(function () {

      // To keep the example simple, the user's GitHub profile is returned to
      // represent the logged-in user.  In a typical application, you would want
      // to associate the GitHub account with a user record in your database,
      // and return that user instead.
      // profile: { id: '********',
      //   displayName: 'Festus Kiprop',
      //   username: 'Yangani',
      //   profileUrl: 'https://github.com/Yangani',
      //   emails: [ { value: '******' } ],
      //   provider: 'github'}
      new User().save(profile.username, profile.id);
      return done(null, profile);
    });
  }
));

// GET /auth/github
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in GitHub authentication will involve redirecting
//   the user to github.com.  After authorization, GitHub will redirect the user
//   back to this application at /auth/github/callback
app.get('/auth/github',
  passport.authenticate('github', { scope: [ 'user:email' ] }),
  function(req, res){
    // The request will be redirected to GitHub for authentication, so this
    // function will not be called.
  });

// GET /auth/github/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function will be called,
//   which, in this example, will redirect the user to the home page.
app.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/login' }),
  function(req, res) {
    addCookie(res);
    res.redirect('/');
  });

// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login')
}

// http://www.9bitstudios.com/2013/09/express-js-authentication/
function restrict(req, res, next) {
  if (req.cookies.remember && currentSessions[req.cookies.remember.sessionId]) {
    // console.log('Already logged in :)');
    next();
  // } else if () {
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
  // res.status(200);
  res.render('login');
    // res.redirect('/auth/github');
});

app.get('/logout',
function(req, res) {
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

app.listen(4568);
