import { searchPosts } from '../src/data/search.js';

async function main() {
  const query = process.argv.slice(2).join(' ').trim();
  if (query.length < 2) {
    console.log('Usage: pnpm search:try "your search"');
    return;
  }

  const started = Date.now();
  const { results, suggestions, topics } = await searchPosts(query);
  const highlight = (parts: { text: string; highlight: boolean }[]) =>
    parts.map((part) => (part.highlight ? `[${part.text}]` : part.text)).join('');

  console.log(`\n"${query}": ${results.length} result(s) in ${Date.now() - started} ms\n`);
  for (const result of results) {
    const where = result.heading ? `${result.postTitle} › ${result.heading}` : result.postTitle;
    console.log(`  ${where}   (${result.matchedBy.join(' + ')})`);
    console.log(`     ${highlight(result.snippet)}`);
    console.log(`     ${result.url}\n`);
  }

  if (results.length === 0 && suggestions.length > 0) {
    console.log('  No results. Closest by meaning:');
    for (const suggestion of suggestions) console.log(`   · ${suggestion.postTitle} › ${suggestion.heading || 'Introduction'}`);
    console.log();
  }
  if (topics.length > 0) console.log(`  Topics: ${topics.map((topic) => `${topic.name} (${topic.count})`).join(', ')}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});