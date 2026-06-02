// netlify/plugins/generate-cms-index/index.js
// This Netlify Build Plugin automatically generates index.json files
// from the markdown files that Decap CMS creates.
// It runs every time you publish content from the admin panel.

const fs = require('fs');
const path = require('path');

// Parse frontmatter from markdown files (no dependencies needed)
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const yaml = match[1];
  const result = {};
  yaml.split('\n').forEach(line => {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) return;
    const key = line.slice(0, colonIdx).trim();
    let val = line.slice(colonIdx + 1).trim();
    // Remove surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    // Boolean
    if (val === 'true') val = true;
    else if (val === 'false') val = false;
    result[key] = val;
  });
  return result;
}

// Parse list items (tools: [Power BI, Excel] or - Power BI)
function parseList(content, key) {
  const inlineMatch = content.match(new RegExp(`${key}:\\s*\\[([^\\]]+)\\]`));
  if (inlineMatch) return inlineMatch[1].split(',').map(s => s.trim());
  const blockMatch = content.match(new RegExp(`${key}:\\n((?:\\s*-\\s*.+\\n?)+)`));
  if (blockMatch) return blockMatch[1].match(/- (.+)/g).map(s => s.replace('- ', '').trim());
  return [];
}

module.exports = {
  onPostBuild: ({ utils }) => {
    try {
      // Generate portfolio index
      const projectsDir = path.join(process.cwd(), '_projects');
      if (fs.existsSync(projectsDir)) {
        const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.md'));
        const projects = files.map(file => {
          const content = fs.readFileSync(path.join(projectsDir, file), 'utf8');
          const data = parseFrontmatter(content);
          data.tools = parseList(content, 'tools') || [];
          data.slug = file.replace('.md', '');
          return data;
        }).filter(p => p.published !== false);

        const outDir = path.join(process.cwd(), 'public', '_projects');
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(projects, null, 2));
        console.log(`✅ Generated portfolio index: ${projects.length} projects`);
      }

      // Generate blog index
      const postsDir = path.join(process.cwd(), '_posts');
      if (fs.existsSync(postsDir)) {
        const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));
        const posts = files.map(file => {
          const content = fs.readFileSync(path.join(postsDir, file), 'utf8');
          const data = parseFrontmatter(content);
          data.slug = file.replace('.md', '');
          // Extract date from filename (YYYY-MM-DD-slug format)
          const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})/);
          if (dateMatch) data.date = dateMatch[1];
          return data;
        }).filter(p => p.published !== false)
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        const outDir = path.join(process.cwd(), 'public', '_posts');
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(posts, null, 2));
        console.log(`✅ Generated blog index: ${posts.length} posts`);
      }

    } catch (err) {
      console.error('CMS index generation error:', err);
    }
  }
};
