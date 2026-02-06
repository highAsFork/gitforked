export const name = 'hello';

export async function execute(args, context) {
  const name = args[0] || 'world';
  return `Hello, ${name}! This is from the hello plugin.`;
}