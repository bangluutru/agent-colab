import assert from 'node:assert';
import { StateMachine } from '../orchestrator/state-machine.js';

console.log('--- Testing State Machine ---');

// Test 1: Normal path
const sm = new StateMachine();
assert.strictEqual(sm.getState(), 'IDLE');

sm.transition('REQUEST_RECEIVED');
assert.strictEqual(sm.getState(), 'REQUEST_RECEIVED');

sm.transition('PLANNING');
assert.strictEqual(sm.getState(), 'PLANNING');

sm.transition('PLAN_READY');
assert.strictEqual(sm.getState(), 'PLAN_READY');

sm.transition('IMPLEMENTING');
assert.strictEqual(sm.getState(), 'IMPLEMENTING');

sm.transition('TESTING');
assert.strictEqual(sm.getState(), 'TESTING');

sm.transition('REVIEWING');
assert.strictEqual(sm.getState(), 'REVIEWING');

sm.transition('FINAL_CHECK');
assert.strictEqual(sm.getState(), 'FINAL_CHECK');

sm.transition('VERIFYING');
assert.strictEqual(sm.getState(), 'VERIFYING');

sm.transition('COMPLETED');
assert.strictEqual(sm.getState(), 'COMPLETED');

console.log('✔ Normal path state transitions passed');

// Test 2: Invalid transition throws error
const sm2 = new StateMachine('PLANNING');
assert.throws(() => {
  sm2.transition('COMPLETED');
}, /Invalid state transition/);

console.log('✔ Invalid state transition rejection passed');

// Test 3: Review loop limit
const sm3 = new StateMachine('REVIEWING');
sm3.incrementReviewRound(); // 1
sm3.transition('CHANGES_REQUESTED');
sm3.transition('FIXING');
sm3.transition('TESTING');
sm3.transition('REVIEWING');

sm3.incrementReviewRound(); // 2
sm3.transition('CHANGES_REQUESTED');
sm3.transition('FIXING');
sm3.transition('TESTING');
sm3.transition('REVIEWING');

sm3.incrementReviewRound(); // 3
sm3.transition('CHANGES_REQUESTED'); // Should hit boundary and transition to BLOCKED
assert.strictEqual(sm3.getState(), 'BLOCKED');

console.log('✔ Review round limit (3 rounds -> BLOCKED) passed');

// Test 4: Interruption
const sm4 = new StateMachine('IMPLEMENTING');
sm4.interrupt();
assert.strictEqual(sm4.getState(), 'INTERRUPTED');
console.log('✔ Interruption handling passed');

console.log('All State Machine unit tests PASSED! 🎉');
