const { expect } = require('chai');
const { codeTools } = require('../tools/code-tools.js');

describe('CodeTools Tests', function() {
  describe('Run Function', function() {
    it('should run simple JavaScript code', async function() {
      const result = await codeTools.run('console.log("Hello World");', 'javascript');
      expect(result).to.include('Hello World');
    });

    it('should run simple Python code', async function() {
      const result = await codeTools.run('print("Hello World")', 'python');
      expect(result).to.include('Hello World');
    });

    it('should handle invalid code gracefully', async function() {
      try {
        await codeTools.run('console.log("Hello World', 'javascript');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Execution error');
      }
    });
  });

  describe('Test Function', function() {
    it('should run simple Jest tests', async function() {
      const testCode = `
const sum = (a, b) =u003e a + b;

 test('adds 1 + 2 to equal 3', () =u003e {
   expect(sum(1, 2)).toBe(3);
 });
      `;
      
      const result = await codeTools.test([`
test.js`], 'jest');
      expect(result).to.include('Test Suites');
    });

    it('should handle missing test files gracefully', async function() {
      try {
        await codeTools.test([`
nonexistent.js`], 'jest');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Test execution error');
      }
    });
  });

  describe('Analyze Function', function() {
    it('should analyze JavaScript code', async function() {
      const code = `
var x = 10;
var y = 20;
console.log(x + y);
      `;
      const result = await codeTools.analyze(code, 'javascript');
      expect(result).to.include('Use \u0027let\u0027 or \u0027const\u0027 instead of \u0027var\u0027');
    });

    it('should analyze Python code', async function() {
      const code = `
print 'Hello World'
      `;
      const result = await codeTools.analyze(code, 'python');
      expect(result).to.include('Use print() function instead of print statement');
    });

    it('should handle empty code gracefully', async function() {
      try {
        await codeTools.analyze('', 'javascript');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Code to analyze is required');
      }
    });
  });

  describe('Debug Function', function() {
    it('should debug JavaScript code', async function() {
      const code = `
function add(a, b) {
  return a + b
console.log(add(2, 3));
      `;
      const result = await codeTools.debug(code, 'javascript');
      expect(result).to.include('Missing closing brace');
    });

    it('should debug Python code', async function() {
      const code = `
if x > 5:
  print('x is greater than 5')
      `;
      const result = await codeTools.debug(code, 'python');
      expect(result).to.include('Colon used outside function definition');
    });

    it('should handle empty code gracefully', async function() {
      try {
        await codeTools.debug('', 'javascript');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Code to debug is required');
      }
    });
  });
});