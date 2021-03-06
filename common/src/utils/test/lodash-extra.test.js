import _ from 'lodash';
import { expect } from 'chai';

import '../lodash-extra';

describe('LodashExtra', function() {
    describe('#decouple()', function() {
        it('should clone an object shallowly, and clone the object at the specified path', function() {
            let before = {
                a: 1,
                b: {
                    c: {
                        value: 5
                    }
                }
            };
            let after = _.decouple(before, 'b.c');
            after.b.c = 6;
            expect(before.b.c.value).to.equal(5);
        })
        it('should create sub-object as necessary', function() {
            let before = {
                a: 1,
            };
            let after = _.decouple(before, 'b.c');
            expect(after.b.c).to.be.an('object');
        })
        it('should use default value when object at path is missing', function() {
            let before = {
                a: 1,
            };
            let after = _.decouple(before, 'b.c', []);
            expect(after.b.c).to.be.an('array');
        })
    })
    describe('#decoupleSet()', function() {
        it('should decouple objects along a given path then set the property', function() {
            let before = {
                a: 1,
                b: {
                    c: {
                        value: 5
                    }
                }
            };
            let after = _.decoupleSet(before, 'b.c.value', 6);
            expect(before.b.c.value).to.equal(5);
            expect(after.b.c.value).to.equal(6);
        })
    })
    describe('#decouplePush()', function() {
        it('should decouple objects along a given path then push a value', function() {
            let before = {
                a: 1,
                b: {
                    c: {
                        array: []
                    }
                }
            };
            let after = _.decouplePush(before, 'b.c.array', 6, 7, 8);
            expect(before.b.c.array).to.have.lengthOf(0);
            expect(after.b.c.array).to.have.lengthOf(3);
        })
    })
    describe('#shallowDiff()', function() {
        it('should return differences of two objects, comparing shallowly', function() {
            let cat = { name: 'Garfield' }
            let a = {
                hello: 'world',
                george: 'T-bone',
                cat,
                dog: {
                    name: 'Max'
                },
                turtle: {
                    name: 'Glen'
                }
            };
            let b = {
                hello: 'world',
                george: 'Coco',
                cat,
                dog: {
                    name: 'Wolfie'
                },
                turtle: {
                    name: 'Glen'
                }
            };
            let expected = {
                george: 'T-bone',
                dog: {
                    name: 'Max'
                },
                turtle: {
                    name: 'Glen'
                }
            };
            let diff = _.shallowDiff(a, b);
            expect(diff).to.deep.equal(expected);
        })
    })
    describe('#obscure()', function() {
        it('should change numbers to zero', function() {
            let before = {
                a: 1,
                b: { c: 2 },
                d: [1, 2, 3],
            };
            let expected = {
                a: 0,
                b: { c: 0 },
                d: [0, 0, 0],
            };
            let after = _.obscure(before, [ 'a', 'b.c', 'd' ]);
            expect(after).to.deep.equal(expected);
        })
        it('should change booleans to false', function() {
            let before = {
                a: true,
                b: { c: true },
                d: [ true, true, true ],
            };
            let expected = {
                a: false,
                b: { c: false },
                d: [ false, false, false ],
            };
            let after = _.obscure(before, [ 'a', 'b.c', 'd' ]);
            expect(after).to.deep.equal(expected);
        })
        it('should replace all characters in text with x', function() {
            let before = {
                a: 'Hello',
                b: { c: 'World' },
                d: [ 'apple', 'orange', 'lemon' ],
            };
            let expected = {
                a: 'xxxxx',
                b: { c: 'xxxxx' },
                d: [ 'xxxxx', 'xxxxxx', 'xxxxx' ],
            };
            let after = _.obscure(before, [ 'a', 'b.c', 'd' ]);
            expect(after).to.deep.equal(expected);
        })
        it('should leave unspecified properties alone', function() {
            let before = {
                a: 'Hello',
                b: { c: 'World', number: 123 },
                d: [ 'apple', 'orange', 'lemon' ],
            };
            let expected = {
                a: 'xxxxx',
                b: { c: 'World', number: 0 },
                d: [ 'apple', 'orange', 'lemon' ],
            };
            let after = _.obscure(before, [ 'a', 'b.number' ]);
            expect(after).to.deep.equal(expected);
        })
    })
})
