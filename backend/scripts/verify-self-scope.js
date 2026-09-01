// Pure-function unit check for src/utils/selfScope.js — no DB needed.
// Run: node scripts/verify-self-scope.js
const { forceOwnInstructorId } = require('../src/utils/selfScope');

let pass = 0;
let fail = 0;

function check(label, condition) {
  if (condition) {
    pass++;
    console.log(`  PASS - ${label}`);
  } else {
    fail++;
    console.log(`  FAIL - ${label}`);
  }
}

console.log('Case 1: client tries to spoof a different instructorId');
const spoofed = forceOwnInstructorId({ title: 'x', instructorId: 'someone-elses-id' }, 'caller-id');
check('instructorId is overwritten to the caller id', spoofed.instructorId === 'caller-id');
check('other fields are preserved', spoofed.title === 'x');

console.log('\nCase 2: client omits instructorId entirely');
const omitted = forceOwnInstructorId({ title: 'y' }, 'caller-id');
check('instructorId is set to the caller id', omitted.instructorId === 'caller-id');

console.log('\nCase 3: body is null/undefined (malformed request)');
const empty = forceOwnInstructorId(undefined, 'caller-id');
check('does not throw, returns instructorId only', empty.instructorId === 'caller-id');

console.log('\nCase 4: original body object is not mutated');
const original = { instructorId: 'someone-elses-id' };
forceOwnInstructorId(original, 'caller-id');
check('original object left untouched', original.instructorId === 'someone-elses-id');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
