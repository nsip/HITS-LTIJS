(function(root) {
    'use strict';

    /**
       % bilby.js

       ![](http://brianmckenna.org/files/bilby.png)

       [![Build Status](https://secure.travis-ci.org/pufuwozu/bilby.js.png)](http://travis-ci.org/pufuwozu/bilby.js)

       # Description

       bilby.js is a serious functional programming library. Serious,
       meaning it applies category theory to enable highly abstract
       and generalised code. Functional, meaning that it enables
       referentially transparent programs.

       Some features include:

       * Immutable multimethods for ad-hoc polymorphism
       * Functional data structures
       * Operator overloading for functional syntax
       * Automated specification testing (ScalaCheck, QuickCheck)

       # Usage

       node.js:

           var bilby = require('bilby');

       Browser:

           <script src="bilby-min.js"></script>

       # Development

       Download the code with git:

           git clone https://github.com/pufuwozu/bilby.js.git

       Install the development dependencies with npm:

           npm install

       Run the tests with grunt:

           npm test

       Build the concatenated scripts with grunt:

           $(npm bin)/grunt

       Generate the documentation with emu:

           $(npm bin)/emu < bilby.js
    **/

    /* bilby's environment means `this` is special */
    /*jshint validthis: true*/

    /* bilby uses the !(this instanceof c) trick to remove `new` */
    /*jshint newcap: false*/

    var bilby;

    /**
       # Environment
    
       Environments are very important in bilby. The library itself is
       implemented as a single environment.
    
       An environment holds methods and properties.
    
       Methods are implemented as multimethods, which allow a form of
       *ad-hoc polymorphism*. Duck typing is another example of ad-hoc
       polymorphism but only allows a single implementation at a time, via
       prototype mutation.
    
       A method instance is a product of a name, a predicate and an
       implementation:
    
           var env = bilby.environment()
               .method(
                   // Name
                   'negate',
                   // Predicate
                   function(n) {
                       return typeof n == 'number';
                   },
                   // Implementation
                   function(n) {
                       return -n;
                   }
               );
    
           env.negate(100) == -100;
    
       We can now override the environment with some more implementations:
    
           var env2 = env
               .method(
                   'negate',
                   function(b) {
                       return typeof b == 'boolean';
                   },
                   function(b) {
                       return !b;
                   }
               );
    
           env2.negate(100) == -100;
           env2.negate(true) == false;
    
       The environments are immutable; references to `env` won't see an
       implementation for boolean. The `env2` environment could have
       overwritten the implementation for number and code relying on `env`
       would still work.
    
       Properties can be accessed without dispatching on arguments. They
       can almost be thought of as methods with predicates that always
       return true:
    
           var env = bilby.environment()
               .property('name', 'Brian');
    
           env.name == 'Brian';
    
       This means that bilby's methods can be extended:
    
           function MyData(data) {
               this.data = data;
           }
    
           var _ = bilby.method(
               'equal',
               bilby.isInstanceOf(MyData),
               function(a, b) {
                   return this.equal(a.data, b.data);
               }
           );
    
           _.equal(
               new MyData(1),
               new MyData(1)
           ) == true;
    
           _.equal(
               new MyData(1),
               new MyData(2)
           ) == false;
    **/
    
    function findRegistered(registrations, args) {
        var i;
    
        for(i = 0; i < registrations.length; i++) {
            if(registrations[i].predicate.apply(this, args))
                return registrations[i].f;
        }
    
        throw new Error("Method not implemented for this input");
    }
    
    function makeMethod(registrations) {
        return function() {
            var args = [].slice.call(arguments);
            return findRegistered(registrations, args).apply(this, args);
        };
    }
    
    /**
       ## environment(methods = {}, properties = {})
    
       * method(name, predicate, f) - adds an multimethod implementation
       * property(name, value) - sets a property to value
       * envConcat(extraMethods, extraProperties) - adds methods + properties
       * envAppend(e) - combines two environemts, biased to `e`
    **/
    function environment(methods, properties) {
        var i;
    
        if(!(this instanceof environment) || (typeof this.method != 'undefined' && typeof this.property != 'undefined'))
            return new environment(methods, properties);
    
        methods = methods || {};
        properties = properties || {};
    
        this.method = curry(function(name, predicate, f) {
            var newMethods = extend(methods, singleton(name, (methods[name] || []).concat({
                predicate: predicate,
                f: f
            })));
            return environment(newMethods, properties);
        });
    
        this.property = curry(function(name, value) {
            var newProperties = extend(properties, singleton(name, value));
            return environment(methods, newProperties);
        });
    
        this.envConcat = function(extraMethods, extraProperties) {
            var newMethods = {},
                newProperties = {},
                i;
    
            for(i in methods) {
                newMethods[i] = methods[i].concat(extraMethods[i]);
            }
            for(i in extraMethods) {
                if(i in newMethods) continue;
                newMethods[i] = extraMethods[i];
            }
    
            return environment(
                newMethods,
                extend(properties, extraProperties)
            );
        };
    
        this.envAppend = function(e) {
            return e.envConcat(methods, properties);
        };
    
        for(i in methods) {
            if(this[i]) throw new Error("Method " + i + " already in environment.");
            this[i] = makeMethod(methods[i]);
        }
    
        for(i in properties) {
            if(this[i]) throw new Error("Property " + i + " already in environment.");
            this[i] = properties[i];
        }
    }
    

    bilby = environment();
    bilby = bilby.property('environment', environment);

    /**
       # Helpers
    
       The helpers module is a collection of functions used often inside
       of bilby.js or are generally useful for programs.
    **/
    
    /**
        ## functionName(f)
    
        Returns the name of function `f`.
    **/
    function functionName(f) {
        return f._name || f.name;
    }
    
    /**
        ## functionLength(f)
    
        Returns the arity of function `f`.
    **/
    function functionLength(f) {
        return f._length || f.length;
    }
    
    /**
       ## bind(f)(o)
    
       Makes `this` inside of `f` equal to `o`:
    
           bilby.bind(function() { return this; })(a)() == a
    
       Also partially applies arguments:
    
           bilby.bind(bilby.add)(null, 10)(32) == 42
    **/
    function bind(f) {
        function curriedBind(o) {
            var args = [].slice.call(arguments, 1),
                g;
    
            if(f.bind) {
                g = f.bind.apply(f, [o].concat(args));
            } else {
                g = function() {
                    return f.apply(o, args.concat([].slice.call(arguments)));
                };
            }
    
            // Can't override length but can set _length for currying
            g._length = Math.max(functionLength(f) - args.length, 0);
    
            return g;
        }
        // Manual currying since `curry` relies in bind.
        if(arguments.length > 1) return curriedBind.apply(this, [].slice.call(arguments, 1));
        return curriedBind;
    }
    
    /**
       ## curry(f)
    
       Takes a normal function `f` and allows partial application of its
       named arguments:
    
           var add = bilby.curry(function(a, b) {
                   return a + b;
               }),
               add15 = add(15);
    
           add15(27) == 42;
    
       Retains ability of complete application by calling the function
       when enough arguments are filled:
    
           add(15, 27) == 42;
    **/
    function curry(f) {
        return function() {
            var g = bind(f).apply(f, [this].concat([].slice.call(arguments))),
                length = functionLength(g);
    
            if(!length)
                return g();
    
            return curry(g);
        };
    }
    
    /**
       ## flip(f)
    
       Flips the order of arguments to `f`:
    
           var append = bilby.curry(function(a, b) {
                   return a + b;
               }),
               prepend = flip(concat);
    **/
    function flip(f) {
        return function(a) {
            return function(b) {
                return f(b, a);
            };
        };
    }
    
    /**
       ## identity(o)
    
       Identity function. Returns `o`:
    
           forall a. identity(a) == a
    **/
    function identity(o) {
        return o;
    }
    
    /**
       ## constant(c)
    
       Constant function. Creates a function that always returns `c`, no
       matter the argument:
    
           forall a b. constant(a)(b) == a
    **/
    function constant(c) {
        return function() {
            return c;
        };
    }
    
    /**
       ## compose(f, g)
    
       Creates a new function that applies `f` to the result of `g` of the
       input argument:
    
           forall f g x. compose(f, g)(x) == f(g(x))
    **/
    function compose(f, g) {
        return function() {
            return f(g.apply(this, [].slice.call(arguments)));
        };
    }
    
    /**
       ## create(proto)
    
       Partial polyfill for Object.create - creates a new instance of the
       given prototype.
    **/
    
    function create(proto) {
        function Ctor() {}
        Ctor.prototype = proto;
        return new Ctor();
    }
    
    /**
       ## tagged(name, fields)
    
       Creates a simple constructor for a tagged object.
    
           var Tuple = tagged('Tuple', ['a', 'b']);
           var x = Tuple(1, 2);
           var y = new Tuple(3, 4);
           x instanceof Tuple && y instanceof Tuple;
    **/
    function tagged(name, fields) {
        function wrapped() {
            var instance, i;
            if(!(this instanceof wrapped)) {
                instance = create(wrapped.prototype);
                wrapped.apply(instance, arguments);
                return instance;
            }
            if(arguments.length != fields.length) {
                throw new TypeError("Expected " + fields.length + " arguments, got " + arguments.length);
            }
            for(i = 0; i < fields.length; i++) {
                this[fields[i]] = arguments[i];
            }
        }
        wrapped._name = name;
        wrapped._length = fields.length;
        return wrapped;
    }
    
    /**
        ## taggedSum(constructors)
    
        Creates a disjoint union of constructors, with a catamorphism.
    
            var List = taggedSum({
                Cons: ['car', 'cdr'],
                Nil: []
            });
            function listLength(l) {
                return l.cata({
                    Cons: function(car, cdr) {
                        return 1 + listLength(cdr);
                    },
                    Nil: function() {
                        return 0;
                    }
                });
            }
            listLength(List.Cons(1, new List.Cons(2, List.Nil()))) == 2;
    **/
    function taggedSum(constructors) {
        var defined = 0, definitions = {}, key;
    
        function makeCata(fields, field) {
            return function(dispatches) {
                var args = [], length = 0, key, i;
                for(key in constructors) {
                    if(dispatches[key]) continue;
                    throw new TypeError("Constructors define " + key + " but not supplied to cata");
                }
                for(key in dispatches) {
                    if(constructors[key]) continue;
                    throw new TypeError("Found extra constructor supplied to cata: " + key);
                }
                for(i = 0; i < fields.length; i++) {
                    args.push(this[fields[i]]);
                }
                return dispatches[field].apply(this, args);
            };
        }
    
        for(key in constructors) {
            definitions[key] = tagged(key, constructors[key]);
            definitions[key].prototype.cata = makeCata(constructors[key], key);
            defined++;
        }
    
        return definitions;
    }
    
    /**
       ## error(s)
    
       Turns the `throw new Error(s)` statement into an expression.
    **/
    function error(s) {
        return function() {
            throw new Error(s);
        };
    }
    
    /**
       ## zip(a, b)
    
       Takes two lists and pairs their values together into a "tuple" (2
       length list):
    
           zip([1, 2, 3], [4, 5, 6]) == [[1, 4], [2, 5], [3, 6]]
    **/
    function zip(a, b) {
        var accum = [],
            i;
    
        for(i = 0; i < Math.min(a.length, b.length); i++) {
            accum.push([a[i], b[i]]);
        }
    
        return accum;
    }
    
    /**
       ## singleton(k, v)
    
       Creates a new single object using `k` as the key and `v` as the
       value. Useful for creating arbitrary keyed objects without
       mutation:
    
           singleton(['Hello', 'world'].join(' '), 42) == {'Hello world': 42}
    **/
    function singleton(k, v) {
        var o = {};
        o[k] = v;
        return o;
    }
    
    /**
       ## extend(a, b)
    
       Right-biased key-value append of objects `a` and `b`:
    
           bilby.extend({a: 1, b: 2}, {b: true, c: false}) == {a: 1, b: true, c: false}
    **/
    // TODO: Make into an Object semigroup#append
    function extend(a, b) {
        var o = {},
            i;
    
        for(i in a) {
            o[i] = a[i];
        }
        for(i in b) {
            o[i] = b[i];
        }
    
        return o;
    }
    
    /**
       ## isTypeOf(s)(o)
    
       Returns `true` iff `o` has `typeof s`.
    **/
    var isTypeOf = curry(function(s, o) {
        return typeof o == s;
    });
    /**
       ## isFunction(a)
    
       Returns `true` iff `a` is a `Function`.
    **/
    var isFunction = isTypeOf('function');
    /**
       ## isBoolean(a)
    
       Returns `true` iff `a` is a `Boolean`.
    **/
    var isBoolean = isTypeOf('boolean');
    /**
       ## isNumber(a)
    
       Returns `true` iff `a` is a `Number`.
    **/
    var isNumber = isTypeOf('number');
    /**
       ## isString(a)
    
       Returns `true` iff `a` is a `String`.
    **/
    var isString = isTypeOf('string');
    /**
       ## isArray(a)
    
       Returns `true` iff `a` is an `Array`.
    **/
    function isArray(a) {
        if(Array.isArray) return Array.isArray(a);
        return Object.prototype.toString.call(a) === "[object Array]";
    }
    /**
       ## isInstanceOf(c)(o)
    
       Returns `true` iff `o` is an instance of `c`.
    **/
    var isInstanceOf = curry(function(c, o) {
        return o instanceof c;
    });
    
    /**
       ## AnyVal
    
       Sentinal value for when any type of primitive value is needed.
    **/
    var AnyVal = {};
    /**
       ## Char
    
       Sentinal value for when a single character string is needed.
    **/
    var Char = {};
    /**
       ## arrayOf(type)
    
       Sentinal value for when an array of a particular type is needed:
    
           arrayOf(Number)
    **/
    function arrayOf(type) {
        if(!(this instanceof arrayOf))
            return new arrayOf(type);
    
        this.type = type;
    }
    /**
       ## isArrayOf(a)
    
       Returns `true` iff `a` is an instance of `arrayOf`.
    **/
    var isArrayOf = isInstanceOf(arrayOf);
    /**
       ## objectLike(props)
    
       Sentinal value for when an object with specified properties is
       needed:
    
           objectLike({
               age: Number,
               name: String
           })
    **/
    function objectLike(props) {
        if(!(this instanceof objectLike))
            return new objectLike(props);
    
        this.props = props;
    }
    /**
       ## isObjectLike(a)
    
       Returns `true` iff `a` is an instance of `objectLike`.
    **/
    var isObjectLike = isInstanceOf(objectLike);
    
    /**
       ## or(a)(b)
    
       Curried function for `||`.
    **/
    var or = curry(function(a, b) {
        return a || b;
    });
    /**
       ## and(a)(b)
    
       Curried function for `&&`.
    **/
    var and = curry(function(a, b) {
        return a && b;
    });
    /**
       ## add(a)(b)
    
       Curried function for `+`.
    **/
    var add = curry(function(a, b) {
        return a + b;
    });
    /**
       ## strictEquals(a)(b)
    
       Curried function for `===`.
    **/
    var strictEquals = curry(function(a, b) {
        return a === b;
    });
    
    /**
       ## liftA2(f, a, b)
    
       Lifts a curried, binary function `f` into the applicative passes
       `a` and `b` as parameters.
    **/
    function liftA2(f, a, b) {
        return this.ap(this.map(a, f), b);
    }
    
    /**
       ## sequence(m, a)
    
       Sequences an array, `a`, of values belonging to the `m` monad:
    
            bilby.sequence(Array, [
                [1, 2],
                [3],
                [4, 5]
            ]) == [
                [1, 3, 4],
                [1, 3, 5],
                [2, 3, 4],
                [2, 3, 5]
            ]
    **/
    function sequence(m, a) {
        var env = this;
    
        if(!a.length)
            return env.pure(m, []);
    
        return env.flatMap(a[0], function(x) {
            return env.flatMap(env.sequence(m, a.slice(1)), function(y) {
                return env.pure(m, [x].concat(y));
            });
        });
    }
    
    bilby = bilby
        .property('functionName', functionName)
        .property('functionLength', functionLength)
        .property('bind', bind)
        .property('curry', curry)
        .property('flip', flip)
        .property('identity', identity)
        .property('constant', constant)
        .property('compose', compose)
        .property('create', create)
        .property('tagged', tagged)
        .property('taggedSum', taggedSum)
        .property('error', error)
        .property('zip', zip)
        .property('extend', extend)
        .property('singleton', singleton)
        .property('isTypeOf',  isTypeOf)
        .property('isArray', isArray)
        .property('isBoolean', isBoolean)
        .property('isFunction', isFunction)
        .property('isNumber', isNumber)
        .property('isString', isString)
        .property('isInstanceOf', isInstanceOf)
        .property('AnyVal', AnyVal)
        .property('Char', Char)
        .property('arrayOf', arrayOf)
        .property('isArrayOf', isArrayOf)
        .property('objectLike', objectLike)
        .property('isObjectLike', isObjectLike)
        .property('or', or)
        .property('and', and)
        .property('add', add)
        .property('strictEquals', strictEquals)
        .property('liftA2', liftA2)
        .property('sequence', sequence);
    

    /**
       # Trampoline
    
       Reifies continutations onto the heap, rather than the stack. Allows
       efficient tail calls.
    
       Example usage:
    
           function loop(n) {
               function inner(i) {
                   if(i == n) return bilby.done(n);
                   return bilby.cont(function() {
                       return inner(i + 1);
                   });
               }
    
               return bilby.trampoline(inner(0));
           }
    
       Where `loop` is the identity function for positive numbers. Without
       trampolining, this function would take `n` stack frames.
    **/
    
    /**
       ## done(result)
    
       Result constructor for a continuation.
    **/
    function done(result) {
        if(!(this instanceof done)) return new done(result);
    
        this.isDone = true;
        this.result = result;
    }
    
    /**
       ## cont(thunk)
    
       Continuation constructor. `thunk` is a nullary closure, resulting
       in a `done` or a `cont`.
    **/
    function cont(thunk) {
        if(!(this instanceof cont)) return new cont(thunk);
    
        this.isDone = false;
        this.thunk = thunk;
    }
    
    
    /**
       ## trampoline(bounce)
    
       The beginning of the continuation to call. Will repeatedly evaluate
       `cont` thunks until it gets to a `done` value.
    **/
    function trampoline(bounce) {
        while(!bounce.isDone) {
            bounce = bounce.thunk();
        }
        return bounce.result;
    }
    
    bilby = bilby
        .property('done', done)
        .property('cont', cont)
        .property('trampoline', trampoline);
    

    /**
       # Do (operator overloading)
    
       Adds operator overloading for functional syntax:
    
         * `>=` - monad flatMap/bind:
    
               bilby.Do()(
                   bilby.some(1) >= function(x) {
                       return x < 0 ? bilby.none : bilby.some(x + 2);
                   }
               ).getOrElse(0) == 3;
    
         * `>>` - kleisli:
    
               bilby.Do()(
                   function(x) {
                       return x < 0 ? bilby.none : bilby.some(x + 1);
                   } >> function(x) {
                       return x % 2 != 0 ? bilby.none : bilby.some(x + 1);
                   }
               )(1).getOrElse(0) == 3;
    
         * `<` - functor map:
    
               bilby.Do()(
                   bilby.some(1) < add(2)
               ).getOrElse(0) == 3;
    
         * `*` - applicative ap(ply):
    
               bilby.Do()(
                   bilby.some(add) * bilby.some(1) * bilby.some(2)
               ).getOrElse(0) == 3;
    
         * `+` - semigroup append:
    
               bilby.Do()(
                   bilby.some(1) + bilby.some(2)
               ).getOrElse(0) == 3;
    **/
    
    // Gross mutable global
    var doQueue;
    
    /**
       ## Do()(a)
    
       Creates a new syntax scope. The `a` expression is allowed multiple
       usages of a single operator per `Do` call:
    
       * `>=` - flatMap
       * `>>` - kleisli
       * `<` - map
       * `*` - ap
       * `+` - append
    
       The associated name will be called on the bilby environment with
       the operands. For example:
    
           bilby.Do()(bilby.some(1) + bilby.some(2))
    
       Desugars into:
    
           bilby.append(bilby.some(1), bilby.some(2))
    **/
    function Do() {
        if(arguments.length)
            throw new TypeError("Arguments given to Do. Proper usage: Do()(arguments)");
    
        var env = this,
            oldDoQueue = doQueue;
    
        doQueue = [];
        return function(n) {
            var op, x, i;
            if(!doQueue.length) {
                doQueue = oldDoQueue;
                return n;
            }
    
            if(n === true) op = 'flatMap'; // >=
            if(n === false) op = 'map'; // <
            if(n === 0) op = 'kleisli'; // >>
            if(n === 1) op = 'ap'; // *
            if(n === doQueue.length) op = 'append'; // +
    
            if(!op) {
                doQueue = oldDoQueue;
                throw new Error("Couldn't determine Do operation. Could be ambiguous.");
            }
    
            x = doQueue[0];
            for(i = 1; i < doQueue.length; i++) {
                x = env[op](x, doQueue[i]);
            }
    
            doQueue = oldDoQueue;
            return x;
        };
    }
    
    /**
       ## Do.setValueOf(proto)
    
       Used to mutate the `valueOf` property on `proto`. Necessary to do
       the `Do` block's operator overloading. Uses the object's existing
       `valueOf` if not in a `Do` block.
    
       *Warning:* this mutates `proto`. May not be safe, even though it
       tries to default back to the normal behaviour when not in a `Do`
       block.
    **/
    Do.setValueOf = function(proto) {
        var oldValueOf = proto.valueOf;
        proto.valueOf = function() {
            if(doQueue === undefined)
                return oldValueOf.call(this);
    
            doQueue.push(this);
            return 1;
        };
    };
    
    bilby = bilby.property('Do', Do);
    

    bilby = bilby
        .method('map', isFunction, function(a, b) {
            return compose(b, a);
        })
        .method('ap', isFunction, function(a, b) {
            return function(x) {
                return a(x)(b(x));
            };
        });
    
    bilby = bilby
        .method('kleisli', isFunction, function(a, b) {
            var env = this;
            return function(x) {
                return env.flatMap(a(x), b);
            };
        })
    
        .method('equal', isBoolean, strictEquals)
        .method('equal', isNumber, strictEquals)
        .method('equal', isString, strictEquals)
        .method('equal', isArray, function(a, b) {
            var env = this;
            return env.fold(zip(a, b), true, function(a, t) {
                return a && env.equal(t[0], t[1]);
            });
        })
    
        .method('fold', isArray, function(a, b, c) {
            var i;
            for(i = 0; i < a.length; i++) {
                b = c(b, a[i]);
            }
            return b;
        })
    
        .method('flatMap', isArray, function(a, b) {
            var accum = [],
                i;
    
            for(i = 0; i < a.length; i++) {
                accum = accum.concat(b(a[i]));
            }
    
            return accum;
        })
        .method('map', isArray, function(a, b) {
            var accum = [],
                i;
    
            for(i = 0; i < a.length; i++) {
                accum[i] = b(a[i]);
            }
    
            return accum;
        })
        .method('ap', isArray, function(a, b) {
            var accum = [],
                i,
                j;
    
            for(i = 0; i < a.length; i++) {
                for(j = 0; j < b.length; j++) {
                    accum.push(a[i](b[j]));
                }
            }
    
            return accum;
        })
        .method('append', isArray, function(a, b) {
            return a.concat(b);
        })
        .method('pure', strictEquals(Array), function(m, a) {
            return [a];
        })
    
        .method('append', bilby.liftA2(or, isNumber, isString), function(a, b) {
            return a + b;
        })
    
        .property('oneOf', function(a) {
            return a[Math.floor(this.randomRange(0, a.length))];
        })
        .property('randomRange', function(a, b) {
            return Math.random() * (b - a) + a;
        })
    
        .method('arb', isArrayOf, function(a, s) {
            var accum = [],
                length = this.randomRange(0, s),
                i;
    
            for(i = 0; i < length; i++) {
                accum.push(this.arb(a.type, s - 1));
            }
    
            return accum;
        })
        .method('arb', isObjectLike, function(a, s) {
            var o = {},
                i;
    
            for(i in a.props) {
                o[i] = this.arb(a.props[i]);
            }
    
            return o;
        })
        .method('arb', strictEquals(AnyVal), function(a, s) {
            var types = [Boolean, Number, String];
            return this.arb(this.oneOf(types), s - 1);
        })
        .method('arb', strictEquals(Array), function(a, s) {
            return this.arb(arrayOf(AnyVal), s - 1);
        })
        .method('arb', strictEquals(Boolean), function(a, s) {
            return Math.random() < 0.5;
        })
        .method('arb', strictEquals(Char), function(a, s) {
            return String.fromCharCode(Math.floor(this.randomRange(32, 127)));
        })
        .method('arb', strictEquals(Number), function(a, s) {
            // Half the number of bits to represent Number.MAX_VALUE
            var bits = 511,
                variance = Math.pow(2, (s * bits) / this.goal);
            return this.randomRange(-variance, variance);
        })
        .method('arb', strictEquals(Object), function(a, s) {
            var o = {},
                length = this.randomRange(0, s),
                i;
    
            for(i = 0; i < length; i++) {
                o[this.arb(String, s - 1)] = this.arb(arrayOf(AnyVal), s - 1);
            }
    
            return o;
        })
        .method('arb', strictEquals(String), function(a, s) {
            return this.arb(arrayOf(Char), s - 1).join('');
        })
    
        .method('shrink', isBoolean, function() {
            return function(b) {
                return b ? [False] : [];
            };
        })
        .method('shrink', isNumber, function(n) {
            var accum = [0],
                x = n;
    
            if(n < 0)
                accum.push(-n);
    
            while(x) {
                x = x / 2;
                x = x < 0 ? Math.ceil(x) : Math.floor(x);
                if(x) {
                    accum.push(n - x);
                }
            }
    
            return accum;
        })
        .method('shrink', isString, function(s) {
            var accum = [''],
                x = s.length;
    
            while(x) {
                x = Math.floor(x / 2);
                if(x) {
                    accum.push(s.substring(0, s.length - x));
                }
            }
    
            return accum;
        })
        .method('shrink', isArray, function(a) {
            var accum = [[]],
            x = a.length;
    
            while(x) {
                x = Math.floor(x / 2);
                if(x) {
                    accum.push(a.slice(a.length - x));
                }
            }
    
            return accum;
        });
    
    Do.setValueOf(Array.prototype);
    Do.setValueOf(Function.prototype);
    

    /**
       # Data structures
    
       Church-encoded versions of common functional data
       structures. Disjunction is enoded by multiple constructors with
       different implementations of common functions.
    **/
    
    /**
       ## Option
    
           Option a = Some a + None
    
       The option type encodes the presence and absence of a value. The
       `some` constructor represents a value and `none` represents the
       absence.
    
       * fold(a, b) - applies `a` to value if `some` or defaults to `b`
       * getOrElse(a) - default value for `none`
       * isSome - `true` iff `this` is `some`
       * isNone - `true` iff `this` is `none`
       * toLeft(r) - `left(x)` if `some(x)`, `right(r)` if none
       * toRight(l) - `right(x)` if `some(x)`, `left(l)` if none
       * flatMap(f) - monadic flatMap/bind
       * map(f) - functor map
       * ap(s) - applicative ap(ply)
       * append(s, plus) - semigroup append
    **/
    
    /**
       ### some(x)
    
       Constructor to represent the existance of a value, `x`.
    **/
    function some(x) {
        if(!(this instanceof some)) return new some(x);
        this.fold = function(a) {
            return a(x);
        };
        this.getOrElse = function() {
            return x;
        };
        this.isSome = true;
        this.isNone = false;
        this.toLeft = function() {
            return left(x);
        };
        this.toRight = function() {
            return right(x);
        };
    
        this.flatMap = function(f) {
            return f(x);
        };
        this.map = function(f) {
            return some(f(x));
        };
        this.ap = function(s) {
            return s.map(x);
        };
        this.append = function(s, plus) {
            return s.map(function(y) {
                return plus(x, y);
            });
        };
        Do.setValueOf(this);
    }
    
    /**
       ### none
    
       Represents the absence of a value.
    **/
    var none = {
        fold: function(a, b) {
            return b;
        },
        getOrElse: function(x) {
            return x;
        },
        isSome: false,
        isNone: true,
        toLeft: function(r) {
            return right(r);
        },
        toRight: function(l) {
            return left(l);
        },
    
        flatMap: function() {
            return this;
        },
        map: function() {
            return this;
        },
        ap: function() {
            return this;
        },
        append: function() {
            return this;
        }
    };
    Do.setValueOf(none);
    
    /**
       ## isOption(a)
    
       Returns `true` iff `a` is a `some` or `none`.
    **/
    var isOption = bilby.liftA2(or, isInstanceOf(some), strictEquals(none));
    
    
    /**
       ## Either
    
           Either a b = Left a + Right b
    
       Represents a tagged disjunction between two sets of values; `a` or
       `b`. Methods are right-biased.
    
       * fold(a, b) - `a` applied to value if `left`, `b` if `right`
       * swap() - turns `left` into `right` and vice-versa
       * isLeft - `true` iff `this` is `left`
       * isRight - `true` iff `this` is `right`
       * toOption() - `none` if `left`, `some` value of `right`
       * toArray() - `[]` if `left`, singleton value if `right`
       * flatMap(f) - monadic flatMap/bind
       * map(f) - functor map
       * ap(s) - applicative ap(ply)
       * append(s, plus) - semigroup append
    **/
    
    /**
       ### left(x)
    
       Constructor to represent the left case.
    **/
    function left(x) {
        if(!(this instanceof left)) return new left(x);
        this.fold = function(a, b) {
            return a(x);
        };
        this.swap = function() {
            return right(x);
        };
        this.isLeft = true;
        this.isRight = false;
        this.toOption = function() {
            return none;
        };
        this.toArray = function() {
            return [];
        };
    
        this.flatMap = function() {
            return this;
        };
        this.map = function() {
            return this;
        };
        this.ap = function(e) {
            return this;
        };
        this.append = function(l, plus) {
            var t = this;
            return l.fold(function(y) {
                return left(plus(x, y));
            }, function() {
                return t;
            });
        };
    }
    
    /**
       ### right(x)
    
       Constructor to represent the (biased) right case.
    **/
    function right(x) {
        if(!(this instanceof right)) return new right(x);
        this.fold = function(a, b) {
            return b(x);
        };
        this.swap = function() {
            return left(x);
        };
        this.isLeft = false;
        this.isRight = true;
        this.toOption = function() {
            return some(x);
        };
        this.toArray = function() {
            return [x];
        };
    
        this.flatMap = function(f) {
            return f(x);
        };
        this.map = function(f) {
            return right(f(x));
        };
        this.ap = function(e) {
            return e.map(x);
        };
        this.append = function(r, plus) {
            return r.fold(function(x) {
                return left(x);
            }, function(y) {
                return right(plus(x, y));
            });
        };
    }
    
    /**
       ## isEither(a)
    
       Returns `true` iff `a` is a `left` or a `right`.
    **/
    var isEither = bilby.liftA2(or, isInstanceOf(left), isInstanceOf(right));
    
    
    bilby = bilby
        .property('some', some)
        .property('none', none)
        .property('isOption', isOption)
        .method('fold', isOption, function(a, b, c) {
            return a.fold(b, c);
        })
        .method('flatMap', isOption, function(a, b) {
            return a.flatMap(b);
        })
        .method('map', isOption, function(a, b) {
            return a.map(b);
        })
        .method('ap', isOption, function(a, b) {
            return a.ap(b);
        })
        .method('append', isOption, function(a, b) {
            return a.append(b, this.append);
        })
    
        .property('left', left)
        .property('right', right)
        .property('isEither', isEither)
        .method('flatMap', isEither, function(a, b) {
            return a.flatMap(b);
        })
        .method('map', isEither, function(a, b) {
            return a.map(b);
        })
        .method('ap', isEither, function(a, b) {
            return a.ap(b);
        })
        .method('append', isEither, function(a, b) {
            return a.append(b, this.append);
        });
    

    /**
       # Validation
    
           Validation e v = Failure e + Success v
    
       The Validation data type represents a "success" value or a
       semigroup of "failure" values. Validation has an applicative
       functor which collects failures' errors or creates a new success
       value.
    
       Here's an example function which validates a String:
    
           function nonEmpty(field, string) {
               return string
                   ? λ.success(string)
                   : λ.failure([field + " must be non-empty"]);
           }
    
       We might want to give back a full-name from a first-name and
       last-name if both given were non-empty:
    
           function getWholeName(firstName) {
               return function(lastName) {
                   return firstName + " " + lastName;
               }
           }
           λ.ap(
               λ.map(nonEmpty("First-name", firstName), getWholeName),
               nonEmpty("Last-name", lastName)
           );
    
       When given a non-empty `firstName` ("Brian") and `lastName`
       ("McKenna"):
    
           λ.success("Brian McKenna");
    
       If given only an invalid `firstname`:
    
           λ.failure(['First-name must be non-empty']);
    
       If both values are invalid:
    
           λ.failure([
               'First-name must be non-empty',
               'Last-name must be non-empty'
           ]);
    
       * map(f) - functor map
       * ap(b, append) - applicative ap(ply)
    
       ## success(value)
    
       Represents a successful `value`.
    
       ## failure(errors)
    
       Represents a failure.
    
       `errors` **must** be a semigroup (i.e. have an `append`
       implementation in the environment).
    **/
    
    var Validation = taggedSum({
        success: ['value'],
        failure: ['errors']
    });
    
    Validation.success.prototype.map = function(f) {
        return Validation.success(f(this.value));
    };
    Validation.success.prototype.ap = function(v) {
        return v.map(this.value);
    };
    Do.setValueOf(Validation.success.prototype);
    
    Validation.failure.prototype.map = function() {
        return this;
    };
    Validation.failure.prototype.ap = function(b, append) {
        var a = this;
        return b.cata({
            success: function(value) {
                return a;
            },
            failure: function(errors) {
                return Validation.failure(append(a.errors, errors));
            }
        });
    };
    Do.setValueOf(Validation.failure.prototype);
    
    /**
       ## isValidation(a)
    
       Returns `true` iff `a` is a `success` or a `failure`.
    **/
    var isValidation = bilby.liftA2(or, isInstanceOf(Validation.success), isInstanceOf(Validation.failure));
    
    bilby = bilby
        .property('success', Validation.success)
        .property('failure', Validation.failure)
    
        .method('map', isValidation, function(v, f) {
            return v.map(f);
        })
        .method('ap', isValidation, function(vf, v) {
            return vf.ap(v, this.append);
        });
    

    /**
       # Lenses
    
       Lenses allow immutable updating of nested data structures.
    **/
    
    /**
       ## store(setter, getter)
    
       A `store` is a combined getter and setter that can be composed with
       other stores.
    **/
    function store(setter, getter) {
        if(!(this instanceof store))
            return new store(setter, getter);
    
        this.setter = setter;
        this.getter = getter;
    
        this.map = function(f) {
            return store(compose(f, setter), getter);
        };
    }
    /**
       ## isStore(a)
    
       Returns `true` iff `a` is a `store`.
    **/
    var isStore = isInstanceOf(store);
    
    /**
       ## lens(f)
    
       A total `lens` takes a function, `f`, which itself takes a value
       and returns a `store`.
    
       * run(x) - gets the lens' `store` from `x`
       * compose(l) - lens composition
    **/
    function lens(f) {
        if(!(this instanceof lens))
            return new lens(f);
    
        this.run = function(x) {
            return f(x);
        };
    
        this.compose = function(l) {
            var t = this;
            return lens(function(x) {
                var ls = l.run(x),
                    ts = t.run(ls.getter);
    
                return store(
                    compose(ls.setter, ts.setter),
                    ts.getter
                );
            });
        };
    }
    /**
       ## isLens(a)
    
       Returns `true` iff `a` is a `lens`.
    **/
    var isLens = isInstanceOf(lens);
    
    /**
       ## objectLens(k)
    
       Creates a total `lens` over an object for the `k` key.
    **/
    function objectLens(k) {
        return lens(function(o) {
            return store(function(v) {
                return extend(
                    o,
                    singleton(k, v)
                );
            }, o[k]);
        });
    }
    
    bilby = bilby
        .property('store', store)
        .property('isStore', isStore)
        .method('map', isStore, function(a, b) {
            return a.map(b);
        })
    
        .property('lens', lens)
        .property('isLens', isLens)
        .property('objectLens', objectLens);
    

    /**
       # Input/output
    
       Purely functional IO wrapper.
    **/
    
    /**
       ## io(f)
    
       Pure wrapper around a side-effecting `f` function.
    
       * perform() - action to be called a single time per program
       * flatMap(f) - monadic flatMap/bind
    **/
    function io(f) {
        if(!(this instanceof io))
            return new io(f);
    
        this.perform = function() {
            return f();
        };
    
        this.flatMap = function(g) {
            return io(function() {
                return g(f()).perform();
            });
        };
        Do.setValueOf(this);
    }
    
    /**
       ## isIO(a)
    
       Returns `true` iff `a` is an `io`.
    **/
    var isIO = isInstanceOf(io);
    
    bilby = bilby
        .property('io', io)
        .property('isIO', isIO)
        .method('pure', strictEquals(io), function(m, a) {
            return io(function() {
                return a;
            });
        })
        .method('flatMap', isIO, function(a, b) {
            return a.flatMap(b);
        });
    

    /**
       # QuickCheck
    
       QuickCheck is a form of *automated specification testing*. Instead
       of manually writing tests cases like so:
    
           assert(0 + 1 == 1);
           assert(1 + 1 == 2);
           assert(3 + 3 == 6);
    
       We can just write the assertion algebraicly and tell QuickCheck to
       automaticaly generate lots of inputs:
    
           bilby.forAll(
               function(n) {
                   return n + n == 2 * n;
               },
               [Number]
           ).fold(
               function(fail) {
                   return "Failed after " + fail.tries + " tries: " + fail.inputs.toString();
               },
               "All tests passed!",
           )
    **/
    
    function generateInputs(env, args, size) {
        return env.map(args, function(arg) {
            return env.arb(arg, size);
        });
    }
    
    /**
       ### failureReporter
    
       * inputs - the arguments to the property that failed
       * tries - number of times inputs were tested before failure
    **/
    function failureReporter(inputs, tries) {
        if(!(this instanceof failureReporter))
            return new failureReporter(inputs, tries);
    
        this.inputs = inputs;
        this.tries = tries;
    }
    
    function findSmallest(env, property, inputs) {
        var shrunken = env.map(inputs, env.shrink),
            smallest = [].concat(inputs),
            args,
            i,
            j;
    
        for(i = 0; i < shrunken.length; i++) {
            args = [].concat(smallest);
            for(j = 0; j < shrunken[i].length; j++) {
                args[i] = shrunken[i][j];
                if(property.apply(this, args))
                    break;
                smallest[i] = shrunken[i][j];
            }
        }
    
        return smallest;
    }
    
    /**
       ## forAll(property, args)
    
       Generates values for each type in `args` using `bilby.arb` and
       then passes them to `property`, a function returning a
       `Boolean`. Tries `goal` number of times or until failure.
    
       Returns an `Option` of a `failureReporter`:
    
           var reporter = bilby.forAll(
               function(s) {
                   return isPalindrome(s + s.split('').reverse().join(''));
               },
               [String]
           );
    **/
    function forAll(property, args) {
        var inputs,
            i;
    
        for(i = 0; i < this.goal; i++) {
            inputs = generateInputs(this, args, i);
            if(!property.apply(this, inputs))
                return some(failureReporter(
                    findSmallest(this, property, inputs),
                    i
                ));
        }
    
        return none;
    }
    
    /**
       ## goal
    
       The number of successful inputs necessary to declare the whole
       property a success:
    
           var _ = bilby.property('goal', 1000);
    
       Default is `100`.
    **/
    var goal = 100;
    
    bilby = bilby
        .property('failureReporter', failureReporter)
        .property('forAll', forAll)
        .property('goal', goal);
    

    if(typeof exports != 'undefined') {
        /*jshint node: true*/
        exports = module.exports = bilby;
    } else {
        root.bilby = bilby;
    }
})(this);