var JWT    = require('.'),
	chai   = require('chai'),
	should = chai.should(),
	co     = require('co')

function test(generatorFunc) {
	return function(done) {
		co(generatorFunc)
		.then(
			function()   { done()    },
			function(err){ done(err) }
		)
	}
}

function throwTest(status, generatorFunc) {
	return function(done) {
		co(generatorFunc)
		.then(
			function()    { 
				done(new Error('Expecting status ' + status))
			},
			function(err) { 
				err.status.should.equal(status) 
				done()
			}
		)
	}
}



function mockContext(options) {

	var redirectedTo

	if (typeof options === 'string')
		options = {headers:{authorization:options}}
	else 
		options = options || {}

	return {
		path: '/some/app/path',
		headers: options.headers || {},
		params: options.params || {},
		query: options.query || {},
		body: options.body || {},
		cookies: {
			get: function(key) { return options.cookies && options.cookies[key] }
		},
		session: options.session || {},
		state: {},

		redirect: function(path) {
			if (path === undefined)
				return redirectedTo
			redirectedTo = path
		},
		throw: function(status, message) {
			var err = new Error(message)
			err.status = status
			throw err
		}
	}
}

function* shouldNotYieldNext() {
	throw new Error('Should not have "yield next"')
}


describe('koa-jwt-keygrip', function(){

	var auth  = JWT('abcdefgh12345678'),
		token = auth.encode({scope:['root']})


	it('should yield next when valid token is provided in HTTP Authorization header', test(function*(){

		var middleware = auth(),
			ctx = mockContext('Bearer ' + token),
			yielded = false

		yield middleware.call(ctx, function*(){ yielded = true })
		yielded.should.equal(true)
	}))

	it('should yield next when valid token is provided in cookie', test(function*(){

		var middleware = auth({cookie:'token'}),
			ctx = mockContext({cookies:{token}}),
			yielded = false

		yield middleware.call(ctx, function*(){ yielded = true })
		yielded.should.equal(true)
	}))

	it('should yield next when valid token is provided in session', test(function*(){

		var middleware = auth({session:'token'}),
			ctx = mockContext({session:{token}}),
			yielded = false

		yield middleware.call(ctx, function*(){ yielded = true })
		yielded.should.equal(true)
	}))

	it('should raise 401 Unauthorized when no token is provided', throwTest(401, function*(){
		var middleware = auth(),
			ctx = mockContext()

		yield middleware.call(ctx, shouldNotYieldNext)
	}))

	it('should raise 401 Unauthorized if token not the correct location', throwTest(401, function*(){

		var middleware = auth(),
			ctx = mockContext({cookie:{token}, session:{token}})

		yield middleware.call(ctx, shouldNotYieldNext)
	}))

	it('should raise 401 Unauthoried if HTTP Header badly formed', throwTest(401, function*(){

		var middleware = auth(),
			ctx = mockContext('bearer')

		yield middleware.call(ctx, shouldNotYieldNext)
	}))

	it('should raise 401 Unauthoried if token is invalid', throwTest(401, function*(){

		var middleware = auth(),
			ctx = mockContext('bearer invalid-token')

		yield middleware.call(ctx, shouldNotYieldNext)
	}))

	it('should raise 403 Forbidden if token authenticated but not authorized', throwTest(403, function*(){

		var middleware = auth('admin'),
			ctx = mockContext('bearer ' + token)

		yield middleware.call(ctx, shouldNotYieldNext)
	}))

	it('should yield next with valid token and proper scope', test(function*(){

		var middleware = auth('root'),
			ctx = mockContext('Bearer ' + token),
			yielded = false

		yield middleware.call(ctx, function*(){ yielded = true })
		yielded.should.equal(true)
	}))

	it('should raise 403 Forbidden if dynamic token is not in scope', throwTest(403, function*(){

		var middleware = auth('{projectId}:admin'),
			ctx = mockContext({headers:{authorization:'bearer ' + token}, params:{projectId:1234}})

		yield middleware.call(ctx, shouldNotYieldNext)
	}))


	it('should yield next with valid token and acceptable dynamic scope', test(function*(){

		var middleware = auth('{projectId}:admin'),
			token = auth.encode({scope:['1234:admin']})
			ctx = mockContext({headers:{authorization:'bearer ' + token}, params:{projectId:1234}})
			yielded = false

		yield middleware.call(ctx, function*(){ yielded = true })
		yielded.should.equal(true)
	}))

	it('should support function computed credential scopes', test(function*(){

		var middleware = auth('admin', {scope:function(creds){ return 'admin' }}),
			ctx = mockContext('bearer ' + token)
			yielded = false

		yield middleware.call(ctx, function*(){ yielded = true })
		yielded.should.equal(true)
	}))

	it('should support generator computed credential scopes', test(function*(){

		var middleware = auth('admin', {scope:function*(creds){ return 'admin' }}),
			ctx = mockContext('bearer ' + token)
			yielded = false

		yield middleware.call(ctx, function*(){ yielded = true })
		yielded.should.equal(true)
	}))

	it('should raise 403 Forbidden when computed credential scopes are not in scope', throwTest(403, function*(){

		var middleware = auth('admin', {scope:function*(creds){ return 'user' }}),
			ctx = mockContext('bearer ' + token)
			yielded = false

		yield middleware.call(ctx, shouldNotYieldNext)
	}))

	it('should redirect to /login?redirect=/some/app/path', test(function*(){

		var middleware = auth({redirect:'/login?redirect={path}'}),
			ctx = mockContext()

		yield middleware.call(ctx, shouldNotYieldNext)

		ctx.redirect().should.equal('/login?redirect=/some/app/path')
	}))
})