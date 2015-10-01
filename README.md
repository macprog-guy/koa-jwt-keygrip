# Introduction

koa-jwt-keygrip is Koa middleware for JWT based authentication with optional scope based authorization. 
The implementation does not use keygrip.

# Installation

	$ npm install koa-jwt-keygrip


# Usage

```js

var koa     = require('koa'),
	AuthJWT = require('koa-jwt-keygrip')

app = koa()
app.keys = process.env.JWT_SIGNING_KEYS

var auth = jwt(app.keys, {header:true, cookie:'credentials'}),
	authAdmin = auth('admin'),
	authAPI   = auth({cookie:false}),
	authProject = auth('project:{projectId}', {scope:function*(credentials){
		// Dynamically computed scope and credential scopes
		ids = yield /* Select all projectIds from database for which this user has access */
		return ids.map(function(id){ return 'project:'+id })
	}})

app.get('/authenticted', auth(), function*(){
	this.body = 'Authenticated'
})

app.get('/admin', authAdmin, function*(){
	this.body = 'Admin Only'
})

app.get('/api', authAPI, function*(){
	this.body = {api:true}
})

app.get('/projects/:projectId', authProject, function*(){
	this.body = 'Has access to this project'
})


```


# API

##### `constructor(String|Array<String> keys [, String algorithm] [, Object options])`

Returns a middleware returning function whose default options are those specified in the constructor.

- `keys`: If a string should be a comma delimited list of signing keys (keys can't contain commas) otherwise keys is just an array of strings. When encoding tokens only the first (and freshest) key will be used. This is passed directly to jwt-keygrip.

- `algorithm`: should be one of the encoding algorithms that jws supports. Defaults to 'HS512'. Passed directly to jwt-keygrip.

- `options`: default options to use for the middleware is an object with any of the following keys (other keys are kept but ignored): 

	- `{String|false} cookie`: if a string then look for JWT in cookies using this value as the key. If false then don't allow authentication using cookies. Default is false. If true use in conjunction with CSRF and XSS protection.

	- `{Boolean} header`: indicates to look for the JWT in the HTTP Authorization header. Default is true.

	- `{String|Function} key`: the state key where the decoded credentials are stored. If a function then it is called bound to koa context with the credentials as only parameter and it's the functions responsibility to set the state. Defaults to 'credentials'.


	- `{Boolean} optional`: If true then an error is not returned when authentication or authorization fails. If authenticated, the state key will be set. It's up to the handler to handler the condition.

	- `{String} passthrough`: Alias for `optional`.

	- `{URL|false} redirect`: When a URL string, the redirects the user to that URL when 401 unauthorized would otherwise be returned. The URL may contain `{path}`, which will be substituted for the requested path in the redirect URL and be used to forward the user to the requested page after authentication. Defaults to false.

	- `{String|Function*} scopes`: If authorization is wanted then this is the credential key to use to get the users allowed scopes. If a generator function or a regular function then it's bound to the koa context and yielded or called with the credentials as parameter and should return a string or an array of strings. Using a generator function is useful when a user may have too many scopes to store in the token or when they need to be computed based on some database query. Defaults to 'scope'.

	- `{String|false} session`: if a string then look for JWT in the session using this value as the key. If false then don't allow authentication using the session. Default is false. If true use in conjunction with CSRF and XSS protection.


##### `middleware([String scope...] [,Object options])`


```js
var jwt = require('jwt-keygrip')('12345,54321,xxoxx,ooxoo')
```



<hr>
