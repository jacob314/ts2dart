/// <reference path="../typings/mocha/mocha.d.ts"/>
import t = require('./test_support');

describe('types', () => {
  it('supports qualified names',
     () => { t.expectTranslate('var x: foo.Bar;').to.equal(' foo . Bar x ;'); });
  it('drops type literals',
     () => { t.expectTranslate('var x: {x: string, y: number};').to.equal(' dynamic x ;'); });
  it('substitutes Dart-ism', () => {
    t.expectTranslate('import {Promise} from "./somewhere"; var p: Promise<Date>;')
        .to.equal(' import "somewhere.dart" show Future ; Future < DateTime > p ;');
    t.expectTranslate('import Promise = require("./somewhere");')
        .to.equal(' import "somewhere.dart" as Future ;');
  });
});

describe('type arguments', () => {
  it('should support declaration', () => {
    t.expectTranslate('class X<A, B> { a: A; }').to.equal(' class X < A , B > { A a ; }');
  });
  it('should support nested extends', () => {
    t.expectTranslate('class X<A extends B<C>> { }').to.equal(' class X < A extends B < C > > { }');
  });
  it('should multiple extends', () => {
    t.expectTranslate('class X<A extends A1, B extends B1> { }')
        .to.equal(' class X < A extends A1 , B extends B1 > { }');
  });
  it('should support use', () => {
    t.expectTranslate('class X extends Y<A, B> { }').to.equal(' class X extends Y < A , B > { }');
  });
});
