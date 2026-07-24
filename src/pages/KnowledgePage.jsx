import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import MetricCard from '../components/MetricCard';
import { useNotification } from '../contexts/NotificationContext';
import {
  fetchArticles,
  searchArticles,
  filterArticlesByCategory,
  getCategories,
  saveArticle,
  getCustomArticles,
  deleteCustomArticle
} from '../services/knowledgeService';

function KnowledgePage() {
  const { success, error, info } = useNotification();
  const [articles, setArticles] = useState([]);
  const [customArticles, setCustomArticles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [formData, setFormData] = useState({ title: '', category: '', content: '' });

  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    try {
      const data = await fetchArticles();
      setArticles(data);
      setCustomArticles(getCustomArticles());
    } catch (error) {
      console.error('Failed to load articles', error);
      error('Unable to load articles');
    }
  };

  const allArticles = useMemo(() => [...articles, ...customArticles], [articles, customArticles]);
  const categories = useMemo(() => getCategories(allArticles), [allArticles]);

  const filtered = useMemo(() => {
    let result = allArticles;
    if (selectedCategory !== 'All') {
      result = filterArticlesByCategory(result, selectedCategory);
    }
    if (searchQuery.trim()) {
      result = searchArticles(result, searchQuery);
    }
    return result;
  }, [allArticles, selectedCategory, searchQuery]);

  const featured = useMemo(() => filtered.slice(0, 3), [filtered]);
  const totalCategories = Math.max(0, categories.length - 1);
  const categoryCounts = useMemo(() => {
    const counts = { All: allArticles.length };
    allArticles.forEach((article) => {
      const category = article.category || 'General';
      counts[category] = (counts[category] || 0) + 1;
    });
    return counts;
  }, [allArticles]);

  const openArticle = (article) => {
    setSelectedArticle(article);
    setModalOpen(true);
  };

  const closeArticle = () => {
    setModalOpen(false);
    setSelectedArticle(null);
  };

  const handleAddArticle = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.category || !formData.content.trim()) {
      error('Please fill all fields');
      return;
    }

    try {
      const keywords = formData.content
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word.length > 3)
        .slice(0, 10);

      const newArticle = await saveArticle({
        title: formData.title,
        category: formData.category,
        content: formData.content,
        keywords
      });

      setCustomArticles((prev) => [...prev, newArticle]);
      setFormData({ title: '', category: '', content: '' });
      setAddModalOpen(false);
      success('Article added successfully');
    } catch (err) {
      console.error(err);
      error('Failed to add article');
    }
  };

  const handleDeleteArticle = (articleId) => {
    if (window.confirm('Are you sure you want to delete this article?')) {
      deleteCustomArticle(articleId);
      setCustomArticles((prev) => prev.filter((a) => a.id !== articleId));
      closeArticle();
      success('Article deleted');
    }
  };

  const handleCopyArticleLink = (article) => {
    const link = `${window.location.origin}${window.location.pathname}?article=${article.id}`;
    navigator.clipboard.writeText(link).then(() => {
      success('Link copied to clipboard');
    });
  };

  const handlePrintArticle = (article) => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>${article.title}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; max-width: 900px; }
            h1 { color: #1a365d; }
            .category { color: #667eea; font-weight: bold; }
            .content { line-height: 1.6; white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <h1>${article.title}</h1>
          <p><span class="category">${article.category}</span></p>
          <div class="content">${article.content}</div>
          <p style="margin-top: 40px; color: #999; font-size: 0.9em;">
            Printed from LiveSupport Knowledge Base
          </p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_32%),linear-gradient(135deg,_#f8fbff_0%,_#f4f7fb_100%)] text-slate-900">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar />

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6 lg:p-8">
          <div className="mb-6 overflow-hidden rounded-[32px] border border-slate-200/70 bg-slate-950 p-4 text-white shadow-[0_40px_90px_rgba(2,6,23,0.24)] sm:p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-200">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  LiveSupport knowledge center
                </div>
                <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">Knowledge Base</h1>
                <p className="mt-3 text-sm leading-7 text-slate-300 sm:text-base">
                  Guides and support documentation for LiveSupport workflows.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to="/knowledge/policies"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white transition-all hover:bg-white/20"
                >
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4a2 2 0 012 2v2h2a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2zm2 3v10h8V9H6z" />
                  </svg>
                  Open Policies
                </Link>
                <button
                  onClick={() => setAddModalOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white transition-all hover:bg-white/20"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
                  </svg>
                  Add Article
                </button>
              </div>
            </div>
            <div className="mt-6 grid gap-2 sm:grid-cols-3">
              <MetricCard
                icon={<svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" /><path d="M9 8h6" /><path d="M9 12h6" /><path d="M9 16h4" /></svg>}
                label="Total articles"
                value={allArticles.length}
                change={12.4}
                changeType="positive"
              />
              <MetricCard
                icon={<svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7.5h16" /><path d="M7 3.5h10" /><path d="M7 20.5h10" /><path d="M6 11.5h12" /></svg>}
                label="Categories"
                value={totalCategories}
                change={8.1}
                changeType="positive"
              />
              <MetricCard
                icon={<svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 4v16" /><path d="M4 12h16" /></svg>}
                label="Custom guides"
                value={customArticles.length}
                change={customArticles.length ? 5.3 : 0}
                changeType={customArticles.length ? 'positive' : 'negative'}
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="mb-6 overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/80 p-3 shadow-[0_20px_45px_-20px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/70">
              <div className="mb-2 flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Categories</h2>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {allArticles.length}
                </span>
              </div>
              <nav className="flex min-w-0 max-w-full gap-2 overflow-x-auto px-1 pb-1 snap-x snap-mandatory custom-scrollbar">
                {categories.map((cat) => {
                  const isActive = selectedCategory === cat;
                  const count = categoryCounts[cat] ?? 0;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`flex shrink-0 items-center justify-between gap-2 whitespace-nowrap rounded-2xl px-3 py-2.5 text-sm font-medium transition-all sm:px-4 sm:py-3 ${
                        isActive
                          ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/20'
                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span>{cat}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${isActive ? 'bg-white/15 text-white' : 'bg-slate-900/5 text-slate-500 dark:bg-slate-700/70 dark:text-slate-300'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="min-w-0 space-y-6">
              <div className="rounded-[28px] border border-slate-200/80 bg-white/80 p-4 shadow-[var(--shadow-theme-lg)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/70">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="relative flex-1">
                    <svg className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.9 3.6l4.7 4.7-1.4 1.4-4.7-4.7A6 6 0 012 8z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search articles, guides, and documentation..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50/80 pl-12 pr-4 text-sm font-medium text-slate-700 shadow-inner outline-none transition-all focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800/70">
                      Showing {filtered.length} results
                    </span>
                    <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
                      {selectedCategory}
                    </span>
                  </div>
                </div>
              </div>

              {featured.length > 0 && (
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-indigo-500">Spotlight</p>
                      <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Featured articles</h2>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {featured.map((article) => (
                      <div
                        key={article.id}
                        onClick={() => openArticle(article)}
                        className="group relative cursor-pointer overflow-hidden rounded-[24px] border border-slate-200/80 bg-gradient-to-br from-white via-white to-indigo-50/40 p-5 shadow-[var(--shadow-theme-md)] transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-theme-lg)] dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/40"
                      >
                        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-cyan-400 to-violet-500" />
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/15 to-cyan-400/15 text-xl text-indigo-600 dark:text-indigo-300">
                          📚
                        </div>
                        <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">{article.title}</h3>
                        <p className="mb-4 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
                          {article.content.substring(0, 100)}...
                        </p>
                        <div className="flex items-center justify-between gap-2">
                          <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200">
                            {article.category}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {article.custom ? 'Custom' : 'Standard'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-[28px] border border-slate-200/80 bg-white/70 p-4 shadow-[var(--shadow-theme-md)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/70">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Library</p>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                      {searchQuery || selectedCategory !== 'All' ? 'Search results' : 'All articles'} ({filtered.length})
                    </h2>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
                    {selectedCategory}
                  </div>
                </div>
                <div className="space-y-3">
                  {filtered.length > 0 ? (
                    filtered.map((article) => (
                      <div
                        key={article.id}
                        onClick={() => openArticle(article)}
                        className="group flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-white hover:shadow-[var(--shadow-theme-md)] dark:border-slate-800 dark:bg-slate-950/70 dark:hover:border-indigo-500/60 dark:hover:bg-slate-900"
                      >
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/15 to-cyan-400/15 text-lg text-indigo-600 dark:text-indigo-300">
                            ✦
                          </div>
                          <div className="min-w-0">
                            <h3 className="mb-1 font-semibold text-slate-900 dark:text-slate-100">{article.title}</h3>
                            <p className="line-clamp-1 text-sm text-slate-600 dark:text-slate-400">
                              {article.content.substring(0, 150)}...
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            {article.category}
                          </span>
                          <svg className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 dark:text-slate-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" />
                          </svg>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 py-10 text-center dark:border-slate-700 dark:bg-slate-950/70">
                      <p className="text-slate-600 dark:text-slate-400">No articles found. Try a different search or category.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default KnowledgePage;
