import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AutomaticCounter} from '../src/automatic.ts';
import {top,bottom} from './fixtures.ts';
test('starts on first visible arms without face or calibration',()=>{const a=new AutomaticCounter();assert.equal(a.update(top(),1000).started,true);assert.ok(a.counter);});
test('cannot start from shoulders without an elbow measurement',()=>{const a=new AutomaticCounter();a.update({...top(),elbowAngle:undefined},1000);assert.equal(a.counter,null);});
test('actual screenshot poses count after initialization in another position',()=>{const a=new AutomaticCounter();let t=1000;for(const o of [{...top(),y:.1},top(),bottom(),top()])for(let i=0;i<8;i++,t+=85)a.update(o,t);assert.equal(a.counter?.count,1);});
