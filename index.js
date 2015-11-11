'use strict'

var JWT = require('jwt-keygrip')

module.exports = KoaJWTKeygrip

var DEFAULT_OPTIONS = {
	header:      true,
	cookie:      false,
	session:     false,
	passthrough: false, // Alias for optional
	optional:    false,
	redirect:    false,
	scope:       'scope',
	key:         'user'
}


function KoaJWTKeygrip(keys, algorithm, defaultOptions) {

	// Handle optional arguments
	if (algorithm && typeof algorithm !== 'string') {
		defaultOptions = algorithm
		algorithm = undefined
	}

	// Initialize jwt-keygrip
	var jwt = JWT(keys, algorithm)

	// Combine user defaults with global defaults
	defaultOptions = defaults(defaultOptions, DEFAULT_OPTIONS)

	// Return a middleware returning function
	var factory = function() {

		// Get arguments in the form of an array
		var scopes  = Array.prototype.slice.call(arguments, 0),
			options = {}

		// Handle options argument
		if (scopes.length && typeof scopes[scopes.length-1] === 'object')
			options = scopes.pop()

		// Combine options with defaults
		options = defaults(options || {}, defaultOptions)

		// Sanity check on the options
		if (typeof options.header !== 'boolean')
			throw new Error('options.header must be true or false')

		if (typeof options.cookie !== 'string' && options.cookie !== false)
			throw new Error('options.cookie must be a string or false')

		if (typeof options.session !== 'string' && options.session !== false)
			throw new Error('options.session must be a string or false')

		if (typeof options.passthrough !== 'boolean')
			throw new Error('options.passthrough must be true of false')

		if (typeof options.optional !== 'boolean')
			throw new Error('options.optional must be true of false')

		if (typeof options.key !== 'string' && typeof options.key !== 'function')
			throw new Error('options.key must be a string or a function')

		if (typeof options.redirect !== 'string' && options.redirect !== false)
			throw new Error('options.redirect must be a string or false')

		// Return a middleware function
		return function*(next) {

			var token, parts, scheme, credentials, credScopes, i, authorized, str, ctx=this

			try {

				// Then look in the cookies
				if (options.cookie)
					token = this.cookies.get(options.cookie)
				
				// THen look in the session
				if (!token && options.session)
					token = this.session[options.session]

				// Look for the token in the HTTP Authorization header
				if (!token && options.header) {
					
					if (!this.headers.authorization)
						throw new Error('missingAuthorizationHeader')

					// Get the token from the request header
					parts = this.headers.authorization.split(' ')

					if (parts.length != 2)
						throw new Error('badHeaderFormat')

					scheme = parts[0]
					token  = parts[1]
				}

				if (!token)
					throw new Error('unauthorized')

				// Decode the token
				credentials = jwt.decode(token)

				if (!credentials)
					throw new Error('invalidToken')


				// Set the state key or call the function to do so
				if (typeof options.key === 'string')
					this.state[options.key]
				else
					options.key.call(this, credentials, token)


				// Validate the scopes
				if (scopes.length) {

					// Get users scopes as an array
					if (typeof options.scope === 'function') {
						if (options.scope.constructor && options.scope.constructor.name === 'GeneratorFunction')	
							credScopes = yield options.scope.call(this, credentials) || []
						else 
							credScopes = options.scope.call(this, credentials) || []
					}
					else {
						credScopes = credentials[options.scope] || []
					}

					if (typeof credScopes === 'string')
						credScopes = [credScopes]

					for (i in scopes) {

						str = scopes[i].replace(/\{(\w+)\}/, function(match, key){
							return ctx.query[key] || 
								   ctx.params && typeof ctx.params === 'object' && ctx.params[key] || 
								   ctx.body   && typeof ctx.body   === 'object' && ctx.body[key] ||
								   match
						})

						if (credScopes.indexOf(str) >= 0) {
							authorized = true
							break;
						}
					}

					if (!authorized)
						throw new Error('forbidden')
				}

				// Yield to the downstream middleware
				yield next
			}
			catch(err) {

				var status, message

				switch(err.message) {

					case 'missingAuthorizationHeader':
						status  = 401
						message = 'No Authorization header found'
						break;

					case 'badHeaderFormat':
						status  = 401
						message = 'Bad Authorization header format. Format is "Authorization: Bearer <token>"\n'
						break;

					case 'unauthorized':
						status  = 401
						message = 'Unauthorized'
						break;

					case 'invalidToken':
						status  = 401
						message = 'Invalid Token'  
						break;

					case 'forbidden':
						status  = 403
						message = 'Forbidden'
						break;

					default:
						status  = 500
						message = 'Internal Error'
						console.error(err.stack)
				}

				if (options.redirect) 
					this.redirect(options.redirect.replace('{path}', this.path))
				else if (options.passthrough || options.optional)
					yield next
				else 
					this.throw(status, message)
			}
		}
	}


	factory.encode = jwt.encode.bind(jwt)
	factory.decode = jwt.decode.bind(jwt)

	return factory
}


function defaults() {

	var objects = Array.prototype.slice.call(arguments, 0),
    	results = {},
    	i,k,o

    for (i in objects) {
    	var o = objects[i]
    	for (k in o) {
    		if (results[k] === undefined)
    			results[k] = o[k]
    	}
    }
    return results;
}