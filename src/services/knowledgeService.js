export async function fetchArticles() {
  const res = await fetch('/knowledge-base.json', { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Failed to load articles');
  return res.json();
}

export function searchArticles(articles, query) {
  const lowercaseQuery = query.toLowerCase();
  return articles.filter((article) => {
    const matchesTitle = article.title.toLowerCase().includes(lowercaseQuery);
    const matchesContent = article.content.toLowerCase().includes(lowercaseQuery);
    const matchesKeywords = (article.keywords || []).some((kw) => kw.toLowerCase().includes(lowercaseQuery));
    return matchesTitle || matchesContent || matchesKeywords;
  });
}

export function filterArticlesByCategory(articles, category) {
  if (!category || category === 'all') return articles;
  return articles.filter((article) => article.category.toLowerCase() === category.toLowerCase());
}

export function getCategories(articles) {
  const categories = new Set(articles.map((article) => article.category));
  return ['All', ...Array.from(categories).sort()];
}

export async function saveArticle(payload) {
  // In production, this would POST to a backend endpoint
  // For now, store in localStorage for demo purposes
  const articles = JSON.parse(localStorage.getItem('customArticles') || '[]');
  const newArticle = {
    id: `custom-${Date.now()}`,
    title: payload.title,
    category: payload.category,
    content: payload.content,
    keywords: payload.keywords || [],
    custom: true
  };
  articles.push(newArticle);
  localStorage.setItem('customArticles', JSON.stringify(articles));
  return newArticle;
}

export function getCustomArticles() {
  return JSON.parse(localStorage.getItem('customArticles') || '[]');
}

export function deleteCustomArticle(articleId) {
  const articles = JSON.parse(localStorage.getItem('customArticles') || '[]');
  const filtered = articles.filter((a) => a.id !== articleId);
  localStorage.setItem('customArticles', JSON.stringify(filtered));
}
