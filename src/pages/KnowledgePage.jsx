import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
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
  const [articles, setArticles] = useState([]);
  const [customArticles, setCustomArticles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [notification, setNotification] = useState('');
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
      showNotification('Unable to load articles');
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

  const showNotification = (message) => {
    setNotification(message);
    window.setTimeout(() => setNotification(''), 3000);
  };

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
      showNotification('Please fill all fields');
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
      showNotification('Article added successfully!');
    } catch (error) {
      console.error(error);
      showNotification('Failed to add article');
    }
  };

  const handleDeleteArticle = (articleId) => {
    if (window.confirm('Are you sure you want to delete this article?')) {
      deleteCustomArticle(articleId);
      setCustomArticles((prev) => prev.filter((a) => a.id !== articleId));
      closeArticle();
      showNotification('Article deleted');
    }
  };

  const handleCopyArticleLink = (article) => {
    const link = `${window.location.origin}${window.location.pathname}?article=${article.id}`;
    navigator.clipboard.writeText(link).then(() => {
      showNotification('Link copied to clipboard');
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
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar />

        {/* Header */}
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Knowledge Base</h1>
            <p className="text-slate-600 mb-6">
              Comprehensive guides and documentation for LiveSupport
            </p>
            <div className="flex gap-8">
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-slate-900">
                  {allArticles.length}
                </span>
                <span className="text-sm text-slate-600">Total Articles</span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-slate-900">
                  {categories.length - 1}
                </span>
                <span className="text-sm text-slate-600">Categories</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notification */}
        {notification && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm">
            {notification}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
              <aside className="lg:sticky lg:top-24">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-900 mb-4">Categories</h2>
                  <div className="space-y-2">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-medium transition-colors ${
                          selectedCategory === cat
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </aside>

              <div className="space-y-8">
                <div className="space-y-6">
                  <div>
                    <input
                      type="text"
                      placeholder="Search articles, guides, and documentation..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="text-sm text-slate-600">
                      Showing {filtered.length} articles in “{selectedCategory}”
                    </div>
                    <button
                      onClick={() => setAddModalOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
                      </svg>
                      Add Article
                    </button>
                  </div>
                </div>

                {featured.length > 0 && (
                  <div className="mb-12">
                    <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
                      <span className="text-2xl">⭐</span> Featured Articles
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {featured.map((article) => (
                        <div
                          key={article.id}
                          onClick={() => openArticle(article)}
                          className="bg-white rounded-lg border border-slate-200 p-6 hover:shadow-lg hover:border-indigo-300 transition-all cursor-pointer"
                        >
                          <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4 text-indigo-600 text-xl">
                            📚
                          </div>
                          <h3 className="text-lg font-semibold text-slate-900 mb-2">{article.title}</h3>
                          <p className="text-sm text-slate-600 line-clamp-2 mb-4">
                            {article.content.substring(0, 100)}...
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-medium">
                              {article.category}
                            </span>
                            <span className="text-xs text-slate-500">
                              {article.custom ? '👤 Custom' : '📖 Standard'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-6">
                    {searchQuery || selectedCategory !== 'All' ? 'Search Results' : 'All Articles'} ({filtered.length})
                  </h2>
                  <div className="space-y-3">
                    {filtered.length > 0 ? (
                      filtered.map((article) => (
                        <div
                          key={article.id}
                          onClick={() => openArticle(article)}
                          className="bg-white rounded-lg border border-slate-200 p-4 hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-slate-900 mb-1">{article.title}</h3>
                              <p className="text-sm text-slate-600 line-clamp-1">
                                {article.content.substring(0, 150)}...
                              </p>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded whitespace-nowrap">
                                {article.category}
                              </span>
                              <svg className="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
                        <p className="text-slate-600">No articles found. Try a different search or category.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Article Modal */}
      {modalOpen && selectedArticle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white">
              <h2 className="text-2xl font-bold text-slate-900">{selectedArticle.title}</h2>
              <button
                onClick={closeArticle}
                className="text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4 pb-4 border-b border-slate-200">
                <span className="inline-block bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium">
                  {selectedArticle.category}
                </span>
                {selectedArticle.custom && (
                  <span className="ml-2 inline-block bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm font-medium">
                    Custom Article
                  </span>
                )}
              </div>
              <div className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">
                {selectedArticle.content}
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  onClick={() => handlePrintArticle(selectedArticle)}
                  className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm font-medium transition-colors"
                >
                  Print
                </button>
                <button
                  onClick={() => handleCopyArticleLink(selectedArticle)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-medium transition-colors"
                >
                  Share Link
                </button>
                {selectedArticle.custom && (
                  <button
                    onClick={() => handleDeleteArticle(selectedArticle.id)}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-medium transition-colors ml-auto"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Article Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white">
              <h2 className="text-2xl font-bold text-slate-900">Add New Article</h2>
              <button
                onClick={() => setAddModalOpen(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddArticle} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Article title"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select category</option>
                  {categories
                    .filter((c) => c !== 'All')
                    .map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">Content</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Article content"
                  rows="6"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                >
                  Add Article
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default KnowledgePage;
